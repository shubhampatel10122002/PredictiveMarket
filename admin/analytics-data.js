/* =====================================================================
   analytics-data.js — the numbers behind Analytics in /admin
   ---------------------------------------------------------------------
   The platform has very few real visitors yet, so Analytics is built from
   two layers that never mix in the code:

     1. A demo baseline: a synthetic day-by-day history for every case,
        from the day it was listed to today. It is not invented free-hand.
        Every series is the case's own published totals spread over a
        shape, so it agrees with what the site shows: baseline dollars add
        up to baseRaised to the dollar, pledges to baseBackers, comments to
        the discussion total, and a "+1,842 backers this week" badge is
        exactly the last seven days, drawn to the badge's own sparkline.
     2. Real activity: tracked events, pledges and comments, added on top
        day by day. With the baseline switched off this is all there is.

   The baseline is deterministic. Each case seeds its own generator from a
   hash of its id and draws one value per day per stream, starting on the
   listing day, so a date's wobble never depends on how many days follow
   it and a reload always shows the same numbers. The shapes are written
   in days since listing, so a news spike stays on its date. What does move
   as "now" advances is the scale (the totals are fixed, the days are not)
   and the trending week, which is always the last seven days.

   This file draws nothing and never touches the DOM: build() makes a
   model, and the functions below it answer questions about a date range.
   admin/analytics.js does the drawing.
   ===================================================================== */

const LJ_ANALYTICS = (() => {
  "use strict";
  const DAY = 864e5;
  const M   = ["visits","visitors","timeSec","plays","watchSec","completes","investOpens","pledges","amount","shares","comments"];
  const VIA = ["watch","player","cases","trending","link","mine","other"];
  const CM  = ["plays","viewers","watchSec","completes","toCase","toInvest"];
  const MON = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  const clamp = (n,lo,hi) => Math.max(lo, Math.min(hi, n));
  const arr   = v => Array.isArray(v) ? v : [];
  const pos   = v => { const x = +v; return Number.isFinite(x) && x > 0 ? x : 0; };   /* real rows: never negative, never NaN */
  const ratio = (a,b) => b > 0 ? a/b : 0;
  const zeros = n => new Array(n).fill(0);
  const sumF  = (s,a,b) => { let x = 0; for(let i = Math.max(0,a); i <= b; i++) x += s[i]; return x; };
  const median = xs => { const s = [...xs].sort((a,b) => a-b), n = s.length; return n ? (n%2 ? s[n>>1] : (s[n/2-1]+s[n/2])/2) : 0; };

  /* ---------------------------------------------------------------------
     Days. Everything is a whole UTC day, held as a day number internally
     and shown as 'YYYY-MM-DD'. "14 Feb 2026" is how data.js and the admin
     write a listing date, so it is parsed by hand rather than left to
     Date.parse, which would read it in the browser's time zone.
     --------------------------------------------------------------------- */
  function dayNum(v){
    if(v instanceof Date) return Math.floor(v.getTime()/DAY);
    if(typeof v === "number") return Number.isFinite(v) ? Math.floor(v/DAY) : NaN;
    const s = String(v ?? "").trim(); let m;
    if((m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s))) return Date.UTC(+m[1], m[2]-1, +m[3])/DAY;
    if((m = /^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/i.exec(s)) && MON[m[2].toLowerCase()] != null)
      return Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1])/DAY;
    if((m = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s)) && MON[m[1].toLowerCase()] != null)
      return Date.UTC(+m[3], MON[m[1].toLowerCase()], +m[2])/DAY;
    const t = /\d{4}-\d\d-\d\dT/.test(s) ? Date.parse(s) : NaN;   /* ISO timestamps only; nothing locale-dependent */
    return Number.isFinite(t) ? Math.floor(t/DAY) : NaN;
  }
  const iso = d => new Date(d*DAY).toISOString().slice(0,10);
  const sane = d => Number.isFinite(d) && d > 10957 && d < 47482;   /* 2000 to 2100: a parse that lands elsewhere is a typo */

  /* ---------------------------------------------------------------------
     Seeded randomness. FNV-1a for the seed, mulberry32 for the stream.
     wobble() is one multiplicative factor per day with mean 1, drawn in
     date order from the listing day.
     --------------------------------------------------------------------- */
  function hash(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a){ return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const rng = (id, s) => mulberry32(hash(id + "␟" + s));
  /* z: one draw, roughly a standard normal (a logistic with the same
     spread, clipped at 3), which is all noise on a daily count needs */
  const z = u => { const v = Math.log(u/(1 - u)) * .5513; return v < -3 ? -3 : v > 3 ? 3 : v; };
  function wobble(id, s, n, sd){
    const r = rng(id, s), o = new Float64Array(n), k = sd*sd/2;
    for(let i = 0; i < n; i++) o[i] = Math.exp(sd*z(r()) - k);
    return o;
  }

  /* Split a whole number over weights so the parts are whole and add back
     to it exactly. This is how every total in the baseline lands on the
     published number to the unit, with no day ever pushed negative to
     absorb the rounding. The units left after rounding down go out by
     systematic sampling over the fractions: each part gets one with
     probability equal to its fraction, so a small daily total split five
     ways does not always land on the biggest clip. u is the sampling
     offset; without one it is fixed at .5. */
  const FR = new Float64Array(64);
  function apportion(total, w, out, at=0, u=.5){
    const n = w.length; let s = 0;
    for(let i = 0; i < n; i++) if(w[i] > 0) s += w[i];
    total = Math.round(total);
    if(!(total > 0) || !(s > 0)){ for(let i = 0; i < n; i++) out[at+i] = 0; return out; }
    const fr = n <= 64 ? FR : new Float64Array(n); let left = total;
    for(let i = 0; i < n; i++){ const q = (w[i] > 0 ? w[i] : 0) * total / s, f = Math.floor(q); out[at+i] = f; left -= f; fr[i] = q - f; }
    let F = 0, p = u, last = -1;
    for(let i = 0; i < n && left > 0; i++){
      if(w[i] > 0) last = i;
      F += fr[i]; if(p < F){ out[at+i]++; left--; p++; }
    }
    if(left > 0 && last >= 0) out[at+last] += left;   /* floating-point crumbs only */
    return out;
  }

  /* ---------------------------------------------------------------------
     Shapes. A profile's shape is pledge intensity per day, in days since
     listing, in no particular unit: the generator scales it to the case's
     totals. burst() is a launch that takes a day or two to peak and then
     fades; pulse() is one news cycle; step() is a level that rises and
     stays risen.
     --------------------------------------------------------------------- */
  const burst = (t, a, tau, rise=1.5) => a * (1 - Math.exp(-(t+1)/rise)) * Math.exp(-t/tau);
  const pulse = (t, at, w) => t < at ? 0 : (1 - Math.exp(-(t-at+1)/1.2)) * Math.exp(-(t-at)/w);
  const step  = (t, at, w=3) => 1/(1 + Math.exp(-(t-at)/w));
  /* Sunday first. People browse and back less at the weekend. */
  const WEEK = [.8, 1, 1.03, 1.04, 1.02, .97, .85];

  /* The six demo cases each tell a different story, so the dashboard has
     something to find. Fields:
       conv    pledges per visitor            vr      visits per visitor
       time    seconds on the case page       play    clip plays per case visit
       invest  invest-sheet opens per pledge  done    typical clip completion
       share   shares per visitor             src     visit sources, relative
       beta    how far conversion falls when news brings casual visitors
       news    [day, height, width]: visit spikes from coverage
       run, lead  the run-up into a trending week: over `run` days the
                  history climbs to `lead` times the week's first day, so a
                  surge grows out of the weeks before it instead of
                  appearing from nowhere.
     Day numbers in shapes are days since listing; the comments give the
     date each one stands for. */
  const PROFILES = {
    /* Listed 21 Apr. The hero film went round in the first fortnight and
       did most of the work: half the goal in under three weeks, mostly
       from the Watch feed, people who decide fast and give small. A quiet
       summer, then the court's September pause and the October hearing
       brought it back. */
    "maple-evictions": {conv:.08, vr:1.24, time:66, play:3.4, invest:1.9, done:.44, share:.026, beta:.4,
      src:{watch:31, player:3, cases:16, trending:15, link:17, mine:6, other:5}, run:70, lead:.8,
      shape: t => burst(t, 820, 7.5, 1.6) + 7 + 14*Math.exp(-t/40)},

    /* Listed 14 Feb. No launch spike to speak of: a steady climb that
       steepens as the case moves, with bumps for the FOIA production
       (mid-March) and the filing (mid-June). People read it properly. */
    "asylum-backlog": {conv:.058, vr:1.36, time:142, play:2.3, invest:2.3, done:.56, share:.012, beta:.5,
      src:{watch:12, player:4, cases:30, trending:22, link:13, mine:10, other:5}, run:30, lead:.85,
      shape: t => burst(t, 50, 10, 2) + 34 + .3*t + 26*pulse(t, 27, 9) + 40*pulse(t, 118, 8) + 16*pulse(t, 152, 10)},

    /* Listed 3 Mar. Funding moves in steps, each one after coverage: the
       independent testing in mid-March, the records requests in July, the
       withheld permit files in September. Each spike brings a crowd that
       converts poorly, and leaves the base a little higher. */
    "riverside-water": {conv:.046, vr:1.3, time:104, play:2.0, invest:2.4, done:.5, share:.016, beta:.55,
      src:{watch:10, player:4, cases:27, trending:17, link:28, mine:8, other:6},
      news:[[13, 2.4, 4], [124, 1.9, 5], [188, 1.6, 4]],
      shape: t => burst(t, 30, 9, 2) + 26*(1 + .45*step(t, 14) + .35*step(t, 125) + .2*step(t, 189)) * Math.exp(-t/230)},

    /* Listed 18 Sep 2025. A long steady climber that lost pace in its
       second half-year while discovery dragged, picked up when mediation
       began in May, and is now in a settlement-talks surge. */
    "transit-access": {conv:.05, vr:1.3, time:118, play:2.1, invest:2.2, done:.52, share:.014, beta:.5,
      src:{watch:10, player:4, cases:33, trending:20, link:14, mine:12, other:7}, run:21, lead:.72,
      shape: t => burst(t, 60, 14, 2) + 54*(1 - .62*step(t, 160, 25)) + 24*pulse(t, 152, 12) + 26*step(t, 232, 8)},

    /* Listed 9 Nov 2025. The slow burner: a small launch, small bumps when
       the motion to dismiss was denied (March) and the collective was
       certified (June), and a long fade. Few visitors, short visits, low
       conversion, and almost nothing in the last month. */
    "farmworker-wages": {conv:.03, vr:1.22, time:74, play:1.6, invest:2.6, done:.33, share:.008, beta:.5,
      src:{watch:7, player:3, cases:46, trending:6, link:16, mine:14, other:8},
      shape: t => burst(t, 40, 12, 2) + 30*Math.exp(-t/120) + 14*pulse(t, 122, 8) + 11*pulse(t, 213, 8) + 5*pulse(t, 272, 6) + .9},

    /* Listed 2 Aug. Watched, not funded: a strong launch, a bump when the
       vendor contract came back in September, and now a news spike as the
       district paused the rollout. The longest time on page and the best
       clip completion on the platform, and the worst conversion. */
    "school-facial-rec": {conv:.02, vr:1.3, time:173, play:2.5, invest:3, done:.66, share:.02, beta:.62,
      src:{watch:15, player:4, cases:22, trending:18, link:26, mine:4, other:6},
      shape: t => burst(t, 110, 9, 1.5) + 14 + 22*pulse(t, 37, 6)}
  };

  /* Any other case gets a profile from its own numbers. pace is the share
     of the goal raised per four months live: a fast case had a launch it
     is still living off and converts better; a slow one fades. */
  function derive(c, L){
    const r = rng(c.id, "profile"), f = c.goal > 0 ? (+c.baseRaised || 0)/c.goal : 0;
    const pace = f * 120 / Math.max(L, 21), hot = clamp(pace - .5, 0, 1), n = arr(c.clips).length;
    const tau = 6 + 8*r(), fade = 60 + 120*r(), time = 75 + 85*r(), vr = 1.22 + .2*r(), invest = 1.9 + .9*r(), done = .38 + .25*r();
    return {conv: clamp(.02 + .035*pace, .015, .085), vr, time, invest, done, beta:.5,
      play: clamp(1.6 + .25*n*(.5 + hot), 1.5, 3.4), share: .01 + .012*hot,
      src: {watch: 10 + 14*hot, player: 4, cases: 30 - 8*hot, trending: 14, link: 16, mine: 8, other: 6}, run: 30, lead: .8,
      shape: t => burst(t, 4 + 30*hot, tau, 1.6) + 1 + 1.2*Math.exp(-t/fade)};
  }

  /* "+1,842 backers this week", "Settlement talks — 1,204 joined this week" */
  const weekCount = s => { const m = /(\d[\d,]*)/.exec(String(s || "")); return m ? +m[1].replace(/,/g, "") : null; };

  /* A case's reels, in the order the player shows them, keyed the way
     app.js names them in the events table. An embed wins over a file
     because that is what the feed plays. */
  const kindOf = (embed, file) => embed ? "embed" : file ? "file" : "card";
  function reels(c){
    return [{key:"hero", title:"60-second clip", kind: kindOf(c.embed, c.video), dur: 60},
      ...arr(c.clips).map((cl, k) => ({key: String(cl && cl.id || k), title: String(cl && cl.title || "Clip "+(k+1)),
        kind: kindOf(cl && cl.embed, cl && (cl.src || cl.video)), dur: Math.max(1, +(cl && cl.secs) || 60)}))];
  }

  /* ---------------------------------------------------------------------
     The baseline for one case, written into its model arrays from its
     listing day (o) to today (N-1).
     --------------------------------------------------------------------- */
  function baseline(x, o, N, d0, discussion){
    const c = x.c, id = String(c.id), L = N - o; if(L <= 0) return;
    const P = PROFILES[id] || derive(c, L), beta = P.beta ?? .5;
    const B = Math.max(0, Math.round(+c.baseBackers || 0)), R = Math.max(0, Math.round(+c.baseRaised || 0));
    const tr = c.trending && typeof c.trending === "object" ? c.trending : null, kind = tr && tr.kind;
    const spark = tr && arr(tr.spark).length ? arr(tr.spark).map(pos) : null;
    const W = Math.min(7, L), H = L - W, tail = i => spark[clamp(spark.length - W + i, 0, spark.length-1)];
    const n7 = (kind === "backing" || kind === "talk") ? weekCount(tr.reason) : null, week = n7 != null || (kind === "news" && spark);

    /* m is attention that money does not follow one for one: news brings
       a crowd, and conversion falls as m^-beta while visits rise as m. */
    const m = new Float64Array(L).fill(1);
    for(const [at, h, w] of arr(P.news)) for(let t = at; t < L; t++) m[t] += h * pulse(t, at, w);
    if(kind === "news" && spark){
      /* the quietest of the week's first four days is the level before the story broke */
      const s0 = Math.max(0, spark.length-7), lo0 = Math.min(...spark.slice(s0, s0 + 4)), lo = Number.isFinite(lo0) && lo0 > 0 ? lo0 : 1;
      for(let i = 0; i < W; i++) m[H+i] *= Math.max(1, tail(i)/lo);
    }

    /* sm: expected pledges per day, before rounding. Visitors, invest opens
       and comments all hang off it, so they move together. */
    const sm = new Float64Array(L);
    for(let t = 0; t < L; t++) sm[t] = Math.max(1e-6, P.shape(t, L)) * (week && t >= H ? 1 : WEEK[(d0 + t + 4) % 7]) * Math.pow(m[t], 1 - beta);
    const scale = (a, b, total) => { let s = 0; for(let t = a; t < b; t++) s += sm[t]; for(let t = a; t < b; t++) sm[t] = s > 0 ? sm[t]*total/s : 0; };

    const Pl = zeros(L), nP = wobble(id, "pledges", L, .14), wk = [];
    let n7c = 0;
    if(n7 != null){
      /* The badge's number is exactly the last seven days, shaped by its
         sparkline. A case younger than a week can only show baseBackers. */
      n7c = H > 0 ? Math.min(n7, B) : B;
      const sw = Array.from({length: W}, (_, i) => spark ? tail(i) : 1), ss = sw.reduce((a, b) => a + b, 0);
      for(let i = 0; i < W; i++) wk.push(ss > 0 ? n7c * sw[i]/ss : n7c/W);
      if(H > 0){
        /* Bend the run-up so the day before the week sits at lead x its
           first day. Closed form for k in sm*(1 + k*r), after rescaling. */
        const Ht = B - n7c, run = Math.max(1, Math.min(P.run || 30, H)), target = (P.lead || .8) * wk[0];
        const r = t => { const u = (t - (H - 1 - run)) / run; return u > 0 ? u*u : 0; };
        let S0 = 0, S1 = 0; for(let t = 0; t < H; t++){ S0 += sm[t]; S1 += sm[t]*r(t); }
        const e0 = sm[H-1], den = Ht*e0 - target*S1;
        const k = Ht > 0 ? clamp(den > 0 ? (target*S0 - Ht*e0)/den : 40, -.85, 40) : 0;
        for(let t = 0; t < H; t++) sm[t] *= 1 + k*r(t);
        scale(0, H, Ht);
        apportion(Ht, Float64Array.from({length: H}, (_, t) => sm[t]*nP[t]), Pl, 0);
      }
      for(let i = 0; i < W; i++) sm[H+i] = wk[i];
      apportion(n7c, wk, Pl, H);
    }else if(B > 0){
      scale(0, L, B);
      apportion(B, Float64Array.from({length: L}, (_, t) => sm[t]*nP[t]), Pl, 0);
    }else{
      /* Nobody has backed it yet. Give it the attention its "watching now"
         count implies, and no money. */
      scale(0, L, pos(c.watching) * 12 * P.conv);
    }

    /* Dollars ride on pledges. The first backers of a case give a little
       more; a surge brings smaller, quicker pledges. */
    let smMean = 0; for(let t = 0; t < L; t++) smMean += sm[t]; smMean = smMean/L || 1;
    const nA = wobble(id, "avg", L, .1), aw = new Float64Array(L); let awS = 0;
    for(let t = 0; t < L; t++){ aw[t] = Pl[t] * (1 + .12*Math.exp(-t/30)) * Math.pow(Math.max(sm[t], 1e-9)/smMean, -.07) * nA[t]; awS += aw[t]; }
    if(!(awS > 0)){ aw.set(sm); if(!sm.some(v => v > 0)) aw.fill(1); }   /* money with no backers on record: spread it anyway */
    const Am = apportion(R, aw, zeros(L));

    /* Attention, from pledges back through conversion. */
    const nV = wobble(id, "visitors", L, .09), nR = wobble(id, "repeat", L, .04), nT = wobble(id, "time", L, .06),
          nPl = wobble(id, "plays", L, .07), nI = wobble(id, "invest", L, .1), nS = wobble(id, "shares", L, .22), nC = wobble(id, "comments", L, .25);
    const X = x.m, V = zeros(L);
    let svS = 0, smS = 0;
    for(let t = 0; t < L; t++){
      const i = o + t, conv = P.conv * Math.pow(m[t], -beta);
      const v = V[t] = Math.max(Pl[t], Math.round(sm[t]/conv * nV[t])), vis = Math.max(v, Math.round(v * P.vr * nR[t]));
      X.visitors[i] = v; X.visits[i] = vis;
      X.timeSec[i] = Math.round(vis * P.time * Math.pow(m[t], -.05) * nT[t]);
      X.plays[i] = Math.round(vis * P.play * nPl[t]);
      X.investOpens[i] = Math.max(Pl[t], Math.round(sm[t] * P.invest * nI[t]));
      X.pledges[i] = Pl[t]; X.amount[i] = Am[t];
      X.shares[i] = Math.round(v * P.share * Math.pow(m[t], .3) * nS[t]);
      svS += v; smS += sm[t];
    }
    /* Comments: the discussion total the case page shows, spread half by
       backing and half by traffic, since people argue as much as they give. */
    const dt = discussion && discussion[id] && +discussion[id].total;
    const CT = Number.isFinite(dt) && dt >= 0 ? Math.round(dt) : Math.round(B * .55);
    const cw = Float64Array.from({length: L}, (_, t) => ((smS ? sm[t]/smS : 0) + (svS ? V[t]/svS : 0)) * nC[t]);
    const Cm = apportion(CT, cw, zeros(L));
    for(let t = 0; t < L; t++) X.comments[o+t] = Cm[t];

    /* Where visits came from. Trending exposure follows how hot the case
       is; news brings links; "mine" is backers coming back, so it grows
       with the number of backers so far. */
    const S = P.src, rs = rng(id, "sources"), sw7 = new Float64Array(7), part = zeros(7), VV = VIA.map(k => x.via[k]), XV = X.visits;
    let cum = 0;
    for(let t = 0; t < L; t++){
      const hot = sm[t]/smMean, u = rs(); cum += Pl[t];
      sw7[0] = S.watch; sw7[1] = S.player; sw7[2] = S.cases; sw7[3] = S.trending * clamp(Math.sqrt(hot), .4, 1.8);
      sw7[4] = S.link * (m[t] === 1 ? 1 : Math.pow(m[t], .9)); sw7[5] = S.mine * (.35 + (B ? cum/B : 0)); sw7[6] = S.other;
      for(let k = 0; k < 7; k++) sw7[k] *= .9 + .2*((u * (k*7919 + 104729)) % 1);   /* seven wobbles from one draw */
      apportion(XV[o+t], sw7, part, 0, (u * 15485863) % 1);
      for(let k = 0; k < 7; k++) VV[k][o+t] = part[k];
    }

    /* Clips. The hero takes the largest share of plays and later clips
       less, except one, picked by the seed, that clearly outperforms:
       more plays than its place suggests, better completion, and more
       people going on to the case. A visit that came from the Watch feed
       or the player came from some reel, so the clips' toCase adds up to
       those two sources exactly. */
    const rc = rng(id, "clips"), K = x.clips.length, star = K > 1 ? 1 + Math.floor(rc() * (K - 1)) : 0;
    const KIND = {file:1.06, card:.96, embed:.78};
    const sh = [], q = [], wf = [], rw = [], iw = [], rep = [], rets = [];
    x.clips.forEach((cl, k) => {
      let s = k === 0 ? 1 : .62 * Math.pow(.8, k-1) * (.85 + .3*rc());
      if(k === star && k > 0) s = Math.min(.9, s * 1.75);
      const qk = clamp(P.done * KIND[cl.kind] * Math.pow(60/cl.dur, .2) * (.9 + .2*rc()) + (k === star && k > 0 ? .1 : 0), .2, .75);
      /* An early drop (people who swiped on), then steady decay, then a
         last small drop before the end. Embeds lose more up front. */
      const e = clamp(.1 + .18*(1 - qk) + (cl.kind === "embed" ? .05 : 0), .08, .3);
      const lam = -Math.log(qk / (.93 * (1 - e))) / .9;
      const ret = Array.from({length: 11}, (_, j) => j === 0 ? 1 : (1 - e) * Math.exp(-lam * (j/10 - .1)) * (j === 10 ? .93 : 1));
      let a = 0; for(let j = 0; j < 10; j++) a += (ret[j] + ret[j+1])/2/10;
      sh.push(s); q.push(qk); wf.push(a); rets.push(ret); rep.push(1.12 + .25*qk);
      rw.push((k === star && k > 0 ? 1.75 : 1) * (.85 + .3*rc())); iw.push(.8 + .4*rc());
    });
    const rr = x.clips.map((_, k) => rng(id, "clip" + k)), pw = new Float64Array(K), cp = zeros(K), tw = new Float64Array(K), tp = zeros(K), ti = zeros(K);
    const synth = zeros(K), ru = rng(id, "split");
    for(let t = 0; t < L; t++){
      const i = o + t, u1 = ru(), u2 = ru(), u3 = ru();
      for(let k = 0; k < K; k++){ const r = rr[k]; pw[k] = sh[k] * Math.exp(.16*((r()+r()+r()-1.5)*2)); }
      apportion(X.plays[i], pw, cp, 0, u1);
      const toC = x.via.watch[i] + x.via.player[i], toI = Math.min(X.investOpens[i], Math.round(X.investOpens[i] * ratio(toC, X.visits[i])));
      for(let k = 0; k < K; k++) tw[k] = cp[k] * rw[k];
      apportion(toC, tw, tp, 0, u2);
      for(let k = 0; k < K; k++) tw[k] = cp[k] * rw[k] * iw[k];
      apportion(toI, tw, ti, 0, u3);
      let ws = 0, cs = 0;
      for(let k = 0; k < K; k++){
        const cl = x.clips[k], r = rr[k], p = cp[k], u1 = r(), u2 = r(), u3 = r();
        const watch = Math.round(p * cl.dur * wf[k] * (.9 + .2*u2)), done = Math.min(p, Math.round(p * q[k] * (.9 + .2*u3)));
        cl.m.plays[i] = p; cl.m.viewers[i] = p ? clamp(Math.round(p / rep[k] * (.95 + .1*u1)), 1, p) : 0;
        cl.m.watchSec[i] = watch; cl.m.completes[i] = done; cl.m.toCase[i] = tp[k]; cl.m.toInvest[i] = ti[k];
        ws += watch; cs += done; synth[k] += p;
      }
      X.watchSec[i] = ws; X.completes[i] = cs;
    }
    x.clips.forEach((cl, k) => { cl._ret = rets[k]; cl._n = synth[k]; });
  }

  /* ---------------------------------------------------------------------
     build(opts) → the model. See the contract at the end of this file.
     --------------------------------------------------------------------- */
  function build(opts={}){
    const now = opts.now instanceof Date && Number.isFinite(opts.now.getTime()) ? opts.now : new Date();
    const today = dayNum(now), demo = opts.demo !== false, real = opts.real && typeof opts.real === "object" ? opts.real : null;
    const cats = opts.cats || (typeof CATS !== "undefined" ? CATS : globalThis.CATS) || {};
    const discussion = opts.discussion || (typeof DISCUSSION !== "undefined" ? DISCUSSION : globalThis.DISCUSSION) || {};
    const listed = opts.listed || {};
    const cs = arr(opts.cases).filter(c => c && c.id != null);

    /* The listing day: the case's own "vetted" date when it reads as a
       date, else the admin's override, else sixty days ago. vetted comes
       first so that saving an edited demo case (a new row, a new
       created_at) cannot move its history. Never later than today. */
    const lday = cs.map(c => {
      let d = dayNum(c.vetted); if(!sane(d)) d = dayNum(listed[c.id]); if(!sane(d)) d = today - 60;
      return Math.min(d, today);
    });
    const start = cs.length ? Math.min(...lday) : today, N = today - start + 1;
    const days = Array.from({length: N}, (_, i) => iso(start + i));

    const cases = cs.map((c, j) => {
      const cat = cats[c.cat];
      const x = {id: String(c.id), c, title: c.title || c.head || String(c.id), color: cat && cat.color || "#5B6675", listedIdx: lday[j] - start,
        m: Object.fromEntries(M.map(k => [k, zeros(N)])), via: Object.fromEntries(VIA.map(k => [k, zeros(N)])),
        clips: reels(c).map(r => ({...r, m: Object.fromEntries(CM.map(k => [k, zeros(N)])), retention: null}))};
      if(demo) baseline(x, x.listedIdx, N, lday[j], discussion);
      return x;
    });

    /* Real activity, on top. Rows for unknown cases, unknown clips or days
       outside the history are dropped rather than guessed at. */
    const byId = new Map(cases.map(x => [x.id, x]));
    const at = d => { const n = dayNum(d) - start; return n >= 0 && n < N ? n : -1; };
    const row = r => { const x = r && byId.get(String(r.case_id)), i = x ? at(r.d ?? r.created_at) : -1; return i >= 0 ? [x, i] : null; };
    const clipOf = (x, key) => x.clips.find(cl => cl.key === String(key));
    const reach = new Map();
    let realEvents = 0, realPledges = 0, realComments = 0;
    if(real){
      for(const r of arr(real.daily)){
        const h = row(r); realEvents += pos(r && r.n); if(!h) continue;
        const [x, i] = h, n = pos(r.n), X = x.m;
        if(r.kind === "case_view"){ X.visits[i] += n; X.visitors[i] += pos(r.actors); }
        else if(r.kind === "case_time") X.timeSec[i] += pos(r.secs);
        else if(r.kind === "clip_watch"){ X.plays[i] += n; X.watchSec[i] += pos(r.secs); }
        else if(r.kind === "invest_open") X.investOpens[i] += n;
        else if(r.kind === "share") X.shares[i] += n;
      }
      for(const r of arr(real.clips)){
        const h = row(r), cl = h && clipOf(h[0], r.clip); if(!cl) continue;
        const [x, i] = h, p = pos(r.plays);
        cl.m.plays[i] += p; cl.m.viewers[i] += pos(r.viewers); cl.m.watchSec[i] += pos(r.secs);
        cl.m.completes[i] += pos(r.completes); x.m.completes[i] += pos(r.completes);
        if(arr(r.reach).length >= 10){
          const acc = reach.get(cl) || {n: 0, r: zeros(10)}; acc.n += p;
          for(let j = 0; j < 10; j++) acc.r[j] += Math.min(p, pos(r.reach[j]));
          reach.set(cl, acc);
        }
      }
      for(const r of arr(real.attrib)){
        const h = row(r), cl = h && clipOf(h[0], r.clip); if(!cl) continue;
        if(r.kind === "case_view") cl.m.toCase[h[1]] += pos(r.n);
        else if(r.kind === "invest_open") cl.m.toInvest[h[1]] += pos(r.n);
      }
      for(const r of arr(real.via)){
        const h = row(r); if(!h) continue;
        h[0].via[VIA.includes(r.via) ? r.via : "other"][h[1]] += pos(r.n);
      }
      if(Number.isFinite(+real.total) && real.total !== null) realEvents = +real.total;
    }
    for(const p of arr(opts.pledges)){
      const h = row(p); if(!h) continue;
      h[0].m.pledges[h[1]] += 1; h[0].m.amount[h[1]] += pos(p.amount); realPledges++;
    }
    for(const cm of arr(opts.comments)){
      const h = row(cm); if(!h) continue;
      h[0].m.comments[h[1]] += 1; realComments++;
    }

    /* A clip's retention is one curve: the baseline's, weighted by its
       plays, blended with real reach, weighted by real plays. */
    for(const x of cases) for(const cl of x.clips){
      const sn = demo && cl._ret ? cl._n : 0, rl = reach.get(cl) || {n: 0, r: zeros(10)}, n = sn + rl.n;
      cl.retention = Array.from({length: 11}, (_, j) => j === 0 ? 1 : n > 0 ? clamp((sn * cl._ret[j] + rl.r[j-1]) / n, 0, 1) : 0);
      delete cl._ret; delete cl._n;
    }

    /* The feed of real things that happened, newest first. */
    const t = v => { const n = Date.parse(v); return Number.isFinite(n) ? n : 0; };
    const recent = [
      ...arr(real && real.recent).filter(r => r && byId.has(String(r.case_id))).map(r => ({...r})),
      ...arr(opts.pledges).filter(p => p && byId.has(String(p.case_id))).map(p => ({at: p.created_at, kind: "pledge", case_id: p.case_id,
        clip: null, via: null, seconds: null, pct: null, actor_id: p.actor_id ?? null, amount: pos(p.amount), name: p.display_name ?? null})),
      ...arr(opts.comments).filter(cm => cm && byId.has(String(cm.case_id))).map(cm => ({at: cm.created_at, kind: "comment", case_id: cm.case_id,
        clip: null, via: null, seconds: null, pct: null, actor_id: cm.actor_id ?? null, name: cm.name ?? null}))
    ].sort((a, b) => t(b.at) - t(a.at)).slice(0, 40);

    return {now, today: iso(today), days, demo, realEvents, realPledges, realComments, recent, cases};
  }

  /* ---------------------------------------------------------------------
     Questions about a range. from and to are inclusive indices into
     model.days; out-of-range values are clamped, and a reversed range is
     turned round.
     --------------------------------------------------------------------- */
  function span(model, from, to){
    const N = model.days.length, f = Number.isFinite(+from) && from !== null ? Math.round(+from) : 0,
          g = Number.isFinite(+to) && to !== null ? Math.round(+to) : N-1;
    const a = clamp(f, 0, N-1), b = clamp(g, 0, N-1);
    return a <= b ? [a, b] : [b, a];
  }
  const blank = () => Object.fromEntries(M.map(k => [k, 0]));
  function add(T, X, a, b){ if(b >= a && b >= 0) for(const k of M) T[k] += sumF(X[k], a, b); return T; }
  function finish(T){
    return Object.assign(T, {avgTimeSec: ratio(T.timeSec, T.visits), completionRate: ratio(T.completes, T.plays),
      conversion: ratio(T.pledges, T.visitors), investRate: ratio(T.investOpens, T.visitors), closeRate: ratio(T.pledges, T.investOpens),
      avgPledge: ratio(T.amount, T.pledges), dollarsPerVisitor: ratio(T.amount, T.visitors)});
  }
  const MILESTONES = [10, 25, 50, 75, 100];

  function summarize(model, from, to){
    const [a, b] = span(model, from, to), n = b - a + 1, pa = a - n, pb = a - 1;
    const platform = blank(), prev = blank(), series = {amount: zeros(n), pledges: zeros(n), visits: zeros(n), plays: zeros(n), watchSec: zeros(n)};
    const cases = model.cases.map(x => {
      const X = x.m, o = x.listedIdx, goal = +x.c.goal > 0 ? +x.c.goal : 1;
      const totals = finish(add(blank(), X, a, b)), pv = finish(add(blank(), X, Math.max(0, pa), pb));
      add(platform, X, a, b); add(prev, X, Math.max(0, pa), pb);
      for(const k in series){ const s = X[k], d = series[k]; for(let i = a; i <= b; i++) d[i-a] += s[i]; }

      const A = X.amount, raised = sumF(A, 0, b), backers = sumF(X.pledges, 0, b);
      const cumulative = []; let run = sumF(A, 0, o-1);
      for(let i = Math.max(0, o); i <= b; i++){ run += A[i]; cumulative.push(run); }
      const milestones = {};
      for(const p of MILESTONES){ const j = cumulative.findIndex(v => v >= goal*p/100); milestones[p] = j < 0 ? null : j; }

      /* Pace. Velocity windows never reach back before the listing day,
         so a young case is compared with the weeks it has actually had. */
      const lo = Math.max(0, o), velocity7 = sumF(A, Math.max(lo, b-6), b);
      const pd = b - 7 - Math.max(lo, b-34) + 1, velocityPrev = pd > 0 ? sumF(A, Math.max(lo, b-34), b-7) * 7 / pd : 0;
      const momentum = velocityPrev > 0 ? velocity7/velocityPrev : null, daysLive = Math.max(0, b - o);
      const trend = daysLive < 14 ? "new"
        : velocity7 < .0025*goal || (momentum != null && momentum < .35) ? "stalled"
        : momentum == null || momentum >= 1.25 ? "accelerating" : momentum < .8 ? "slowing" : "steady";
      const d14 = Math.min(14, b - lo + 1), pace = d14 > 0 ? sumF(A, Math.max(lo, b-13), b) / d14 : 0;
      const etaDays = raised >= goal || !(pace > 0) ? null : Math.ceil((goal - raised)/pace);

      /* Per-day figures divide by the days of the range the case was
         live, so a case listed mid-range is not penalised for the days
         before it existed. */
      const liveIn = Math.max(0, b - Math.max(a, o) + 1), attentionMin = (totals.watchSec + totals.timeSec)/60;
      return {id: x.id, title: x.title, color: x.color, c: x.c, listedIdx: o, daysLive, totals, prev: pv,
        raised, backers, goal, fundedPct: raised/goal*100, velocity7, velocityPrev, momentum, trend, milestones, etaDays,
        attentionMin, attentionPerDay: ratio(attentionMin, liveIn), moneyPerDay: ratio(totals.amount, liveIn),
        cumulative, spark: Array.from({length: 14}, (_, k) => { const i = b - 13 + k; return i >= 0 ? A[i] : 0; })};
    });
    const out = {range: {from: a, to: b, days: n}, platform: Object.assign(finish(platform), {prev: finish(prev)}), series, cases};
    Object.defineProperty(out, "model", {value: model, enumerable: false});   /* lets insights() look at clips */
    return out;
  }

  function clipStats(model, caseId, from, to){
    const [a, b] = span(model, from, to), out = [];
    for(const x of model.cases){
      if(caseId != null && x.id !== String(caseId)) continue;
      for(const cl of x.clips){
        const s = Object.fromEntries(CM.map(k => [k, sumF(cl.m[k], a, b)])), avgWatchSec = ratio(s.watchSec, s.plays);
        out.push({caseId: x.id, caseTitle: x.title, color: x.color, key: cl.key, title: cl.title, kind: cl.kind, dur: cl.dur,
          plays: s.plays, viewers: s.viewers, watchSec: s.watchSec, completes: s.completes, avgWatchSec,
          avgPct: Math.min(1, ratio(avgWatchSec, cl.dur)), completeRate: ratio(s.completes, s.plays),
          toCase: s.toCase, toInvest: s.toInvest, toCaseRate: ratio(s.toCase, s.plays), toInvestRate: ratio(s.toInvest, s.plays),
          retention: cl.retention.slice()});
      }
    }
    return out.sort((p, q) => q.plays - p.plays);
  }

  function sources(model, caseId, from, to){
    const [a, b] = span(model, from, to), out = Object.fromEntries(VIA.map(k => [k, 0]));
    for(const x of model.cases) if(caseId == null || x.id === String(caseId)) for(const k of VIA) out[k] += sumF(x.via[k], a, b);
    out.total = VIA.reduce((s, k) => s + out[k], 0);
    return out;
  }

  function funnel(model, caseId, from, to){
    const [a, b] = span(model, from, to), T = blank();
    for(const x of model.cases) if(caseId == null || x.id === String(caseId)) add(T, x.m, a, b);
    return [{key: "plays", label: "Clip plays", n: T.plays}, {key: "visits", label: "Case visits", n: T.visits},
            {key: "investOpens", label: "Opened invest", n: T.investOpens}, {key: "pledges", label: "Invested", n: T.pledges}];
  }

  /* ---------------------------------------------------------------------
     insights(summary): a handful of findings worth acting on, each with
     its numbers, ranked. Every candidate is scored; at most two per case
     make the cut so one busy case cannot fill the list.
     --------------------------------------------------------------------- */
  const NF = new Intl.NumberFormat("en-US");
  const int = n => NF.format(Math.round(n));
  const money = n => n >= 1e6 ? "$" + (n/1e6).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M"
    : n >= 1e5 ? "$" + Math.round(n/1e3) + "k" : n >= 1e3 ? "$" + int(Math.round(n/100)*100) : "$" + int(n);
  const pct = x => x < .1 ? (x*100).toFixed(1) + "%" : Math.round(x*100) + "%";
  const mmss = s => { const r = Math.round(s); return Math.floor(r/60) + ":" + String(r%60).padStart(2, "0"); };
  const howLong = d => d < 60 ? d + " days" : d < 730 ? "about " + Math.round(d/30.4) + " months" : "about " + (d/365).toFixed(1) + " years";
  const times = x => x >= 10 ? Math.round(x) + "×" : x.toFixed(1) + "×";

  function insights(summary, model){
    if(!summary || !arr(summary.cases).length) return [];
    model = model || summary.model;
    const P = summary.platform, cs = summary.cases, n = summary.range.days, out = [];
    /* group: findings that are one idea told from different cases. Only
       the best-ranked one whose case still has room is kept. */
    const push = (score, tone, caseId, title, text, group) => out.push({score, tone, caseId, title, text, group: group || title});
    const busy = cs.filter(x => x.totals.visitors >= 50);

    /* Fastest to half funded: what got money in quickly. */
    const fifty = cs.filter(x => x.milestones[50] != null).sort((p, q) => p.milestones[50] - q.milestones[50]);
    if(fifty.length){
      const f = fifty[0], nx = fifty[1];
      push(90, "good", f.id, "Fastest to half funded",
        `${f.title} reached half of its ${money(f.goal)} goal ${f.milestones[50]} days after listing` +
        (nx ? `, the fastest on the platform; the next fastest, ${nx.title}, took ${nx.milestones[50]} days.` : ".") +
        ` What it put out in those first ${f.milestones[50]} days is the template for new launches.`);
    }

    /* Watched closely, rarely funded: attention without money. */
    const medAtt = median(busy.map(x => x.attentionMin));
    const wnf = busy.filter(x => x.attentionMin >= medAtt && x.totals.conversion < .6 * P.conversion)
      .sort((p, q) => q.attentionMin - p.attentionMin)[0];
    if(wnf){
      const t = wnf.totals;
      push(86, "warn", wnf.id, "Watched closely, rarely funded",
        `Visitors spend ${mmss(t.avgTimeSec)} on ${wnf.title} and finish ${pct(t.completionRate)} of its clip plays, yet only ${pct(t.conversion)} invest, against ${pct(P.conversion)} across the platform. The story lands; the ask does not` +
        (t.investRate < .6 * P.investRate ? `: few open the invest sheet at all (${pct(t.investRate)} of visitors), so the prompt is where to start.`
          : `: people open the invest sheet and leave, so look at the amounts and the lock-in wording.`));
    }

    /* Live longest, funded least: what is taking a long time. */
    const medLive = median(cs.map(x => x.daysLive));
    const lag = cs.filter(x => x.daysLive >= Math.max(90, medLive) && x.fundedPct < 60).sort((p, q) => p.fundedPct - q.fundedPct)[0];
    if(lag){
      const pace = lag.spark.reduce((s, v) => s + v, 0) / 14;
      push(80, "warn", lag.id, "Slowest to fund, longest live",
        `${lag.title} has been live ${lag.daysLive} days and is ${Math.round(lag.fundedPct)}% funded. ` +
        (lag.etaDays ? `At the last fortnight's pace of ${money(pace)} a day it would take ${howLong(lag.etaDays)} to reach its goal.`
          : `It has raised nothing in the last fortnight.`) + ` A new clip or a case update is the obvious lever.`);
    }

    /* Close to the goal: get the next step ready. */
    const near = cs.filter(x => x.fundedPct >= 80 && x.fundedPct < 100 && x.etaDays != null && x.etaDays <= 45).sort((p, q) => p.etaDays - q.etaDays);
    near.forEach((f, i) => {
      const nx = near.find(x => x !== f), days = d => `${d} day${d === 1 ? "" : "s"}`;
      push(76 - i, "good", f.id, "Close to fully funded",
        `${f.title} is ${Math.floor(f.fundedPct)}% funded and, at the last fortnight's pace, closes the remaining ${money(f.goal - f.raised)} in about ${days(f.etaDays)}` +
        (nx ? `; ${nx.title} is about ${days(nx.etaDays)} out.` : ".") + ` Have the funded update for backers ready.`);
    });

    /* Accelerating: the strongest week-on-month gain with real money in it. */
    const acc = cs.filter(x => x.trend === "accelerating" && x.momentum != null && x.velocity7 >= .005 * x.goal).sort((p, q) => q.momentum - p.momentum);
    acc.forEach((f, i) => {
      const also = acc.filter(x => x !== f).slice(0, 2).map(x => x.title);
      push(70 + Math.min(12, 3*f.momentum) - i, "good", f.id, "Accelerating this week",
        `${f.title} raised ${money(f.velocity7)} in the last 7 days, ${times(f.momentum)} its weekly average over the four weeks before.` +
        (also.length ? ` ${also.join(" and ")} ${also.length > 1 ? "are" : "is"} also picking up.` : ""));
    });

    /* Slowing: the biggest drop among cases that had been raising well. */
    const slow = cs.filter(x => x.trend === "slowing").sort((p, q) => q.velocityPrev - p.velocityPrev)[0];
    if(slow) push(64, "warn", slow.id, "Losing pace",
      `${slow.title} raised ${money(slow.velocity7)} in the last 7 days, ${Math.round((1 - slow.momentum)*100)}% below its weekly average for the four weeks before.`);

    /* Stalled but not old enough to be the laggard above. */
    const stall = cs.filter(x => x.trend === "stalled" && (!lag || x.id !== lag.id) && x.fundedPct < 100).sort((p, q) => q.daysLive - p.daysLive)[0];
    if(stall) push(62, "warn", stall.id, "Stalled",
      `${stall.title} raised ${money(stall.velocity7)} in the last 7 days, under a quarter of a percent of its goal. It is ${Math.round(stall.fundedPct)}% funded after ${stall.daysLive} days.`);

    /* Converts well, seen too little: worth promoting. */
    const medVis = median(busy.map(x => x.totals.visitors));
    const quiet = busy.filter(x => x.totals.visitors < medVis && x.totals.conversion >= 1.15 * P.conversion && x.fundedPct < 90)
      .sort((p, q) => q.totals.conversion - p.totals.conversion)[0];   /* promoting a case about to fill helps nobody */
    if(quiet) push(60, "info", quiet.id, "Converts well, seen too little",
      `${quiet.title} turns ${pct(quiet.totals.conversion)} of visitors into backers, above the platform's ${pct(P.conversion)}, but drew only ${pct(ratio(quiet.totals.visitors, P.visitors))} of the platform's visitors in this period. A place on the trending rail or earlier in Watch should pay back.`);

    /* One clip that pulls people through to the case. */
    if(model){
      const clips = clipStats(model, null, summary.range.from, summary.range.to), by = new Map();
      for(const k of clips){ const g = by.get(k.caseId) || {p: 0, c: 0}; g.p += k.plays; g.c += k.toCase; by.set(k.caseId, g); }
      let best = null;
      for(const k of clips){
        const g = by.get(k.caseId), rp = g.p - k.plays, rest = ratio(g.c - k.toCase, rp);
        if(k.plays < 30 || k.plays < .05 * g.p || rest <= 0) continue;
        const lift = k.toCaseRate / rest;
        if(lift >= 1.3 && (!best || lift > best.lift)) best = {k, lift, rest};
      }
      if(best){
        const k = best.k, name = k.key === "hero" ? `The 60-second clip for ${k.caseTitle}` : `“${k.title}” (${k.caseTitle})`;
        push(58, "info", k.caseId, "One clip pulls people through",
          `${name} sends ${pct(k.toCaseRate)} of its plays on to the case page, against ${pct(best.rest)} for the case's other clips. Lead with it in the case's reel and in Watch.`);
      }
    }

    /* The platform as a whole, against the period before. */
    if(P.amount > 0 || P.visits > 0){
      const d = P.prev.amount > 0 ? P.amount/P.prev.amount - 1 : null, src = sources(model || {cases: [], days: [""]}, null, summary.range.from, summary.range.to);
      const top = VIA.filter(k => src.total > 0).sort((p, q) => src[q] - src[p])[0];
      const NAMES = {watch: "the Watch feed", player: "the clip player", cases: "the cases list", trending: "the trending rail", link: "shared links", mine: "My investments", other: "elsewhere"};
      push(40, "info", null, "Across the platform",
        `The platform took ${money(P.amount)} from ${int(P.pledges)} investments in these ${n} days` +
        (d != null ? `, ${Math.abs(d) < .005 ? "level with" : `${Math.round(Math.abs(d)*100)}% ${d > 0 ? "up on" : "down on"}`} the ${n} days before.` : ".") +
        (top ? ` ${NAMES[top][0].toUpperCase() + NAMES[top].slice(1)} brought the most case visits, ${pct(src[top]/src.total)}.` : ""));
    }

    out.sort((p, q) => q.score - p.score);
    const per = new Map(), groups = new Set(), picked = [];
    for(const it of out){
      if(picked.length >= 7) break;
      const k = it.caseId ?? "", c = per.get(k) || 0;
      if(groups.has(it.group) || (it.caseId != null && c >= 2)) continue;
      per.set(k, c + 1); groups.add(it.group); picked.push(it);
    }
    return picked.map(({score, group, ...it}) => it);
  }

  return {build, summarize, clipStats, sources, funnel, insights, METRICS: M, SOURCES: VIA, dayNum, iso};
})();

/* Contract, for admin/analytics.js:
   build({cases, listed?, now?, demo?, cats?, discussion?, real?, pledges?, comments?}) →
     {now, today, days, demo, realEvents, realPledges, realComments, recent,
      cases:[{id, c, title, color, listedIdx, m:{…11 daily arrays}, via:{…7 daily arrays},
              clips:[{key, title, kind, dur, m:{plays, viewers, watchSec, completes, toCase, toInvest}, retention}]}]}
   summarize(model, from, to), clipStats(model, caseId|null, from, to),
   sources(model, caseId|null, from, to), funnel(model, caseId|null, from, to), insights(summary). */
if(typeof window !== "undefined") window.LJ_ANALYTICS = LJ_ANALYTICS;
if(typeof module !== "undefined" && module.exports) module.exports = LJ_ANALYTICS;
