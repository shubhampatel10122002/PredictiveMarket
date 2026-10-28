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

   Nothing is declared at the top level: the API is window.LJ_ANALYTICS
   (module.exports under node), so no other script's declarations can
   collide with this one's.
   ===================================================================== */

(function(){
  "use strict";
  const DAY = 864e5;
  const M   = ["visits","visitors","timeSec","plays","watchSec","completes","investOpens","pledges","amount","shares","comments","buzz"];
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
  const rng = (id, s) => mulberry32(hash(id + "|" + s));   /* ASCII on purpose: the seed must not depend on how a page decodes this file */
  /* a stream's first n draws, one per day from the listing day */
  function uniforms(id, s, n){ const r = rng(id, s), o = new Float64Array(n); for(let i = 0; i < n; i++) o[i] = r(); return o; }
  /* Uniform rather than log-normal: the same spread and a mean of exactly
     1, never negative for the spreads used here (under .5), and no log or
     exp per value, which matters when there are 30,000 of them to draw
     before the page can show anything. */
  function wobble(id, s, n, sd){
    const r = rng(id, s), o = new Float64Array(n), k = sd * 3.4641;   /* 2*sqrt(3)*sd: the width of a uniform with that sd */
    for(let i = 0; i < n; i++) o[i] = 1 + k*(r() - .5);
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
       run, lead  the run-up into a trending week: over `run` days the
                  history climbs to `lead` times the week's first day, so a
                  surge grows out of the weeks before it instead of
                  appearing from nowhere.
       ev      what happened, and when. kind is case (something the case
               did: a filing, a ruling, talks), news (coverage of the
               case), issue (news about the issue, not the case) or social
               (the case's own content travelling). Each is one pulse of
               width w: pull is extra backing on the shape's scale, crowd
               extra visitors who convert at the falling rate beta sets,
               buzz extra mentions. The label is what the analytics page
               names as the cause, "Head: what happened", written so the
               part after the colon reads after "when".
       week    the same for the trending week, which is always the last
               seven days and so has no fixed date. Its numbers come from
               the case's own trending badge.
     Day numbers are days since listing; the comments give the date each
     one stands for. */
  const PROFILES = {
    /* Listed 21 Apr. The hero film went round in the first fortnight and
       did most of the work: half the goal in under three weeks, mostly
       from the Watch feed, people who decide fast and give small. A quiet
       summer, then the court's September pause, a week of national
       coverage of no-cause evictions and the October hearing brought it
       back. */
    "maple-evictions": {conv:.08, vr:1.24, time:66, play:3.5, invest:1.9, done:.44, share:.026, beta:.4,
      src:{watch:22, player:2, cases:18, trending:12, link:10, mine:6, other:5}, run:70, lead:.8,
      shape: t => burst(t, 820, 7.5, 1.6) + 7 + 14*Math.exp(-t/40),
      ev:[{at:0, kind:"social", buzz:3.2, w:7, label:"Launch: the 60-second film spread on social media"},   /* 21 Apr */
          {at:145, kind:"case", pull:6, buzz:1, w:6, label:"Court order: the court paused all forty evictions"},          /* 13 Sep */
          {at:163, kind:"issue", crowd:.9, buzz:1.6, w:4, label:"National news: no-cause evictions made the headlines"}],         /* 1 Oct */
      week:{kind:"case", buzz:1.2, label:"Injunction hearing: the court kept the pause in place until trial"}},

    /* Listed 14 Feb. No launch spike to speak of: a steady climb that
       steepens as the case moves, with bumps for the FOIA production
       (mid-March), the filing (mid-June) and the coalition statement
       (July). The backlog itself made the national news in September,
       which brought readers more than backers. People read it properly. */
    "asylum-backlog": {conv:.058, vr:1.36, time:142, play:2.3, invest:2.3, done:.56, share:.012, beta:.5,
      src:{watch:16, player:4, cases:30, trending:22, link:8, mine:10, other:5}, run:30, lead:.85,
      shape: t => burst(t, 50, 10, 2) + 34 + .3*t,
      ev:[{at:27, kind:"case", pull:26, buzz:1.2, w:9, label:"FOIA production: the agency's own records showed a seven-year queue"},   /* 13 Mar */
          {at:118, kind:"case", pull:40, buzz:1.5, w:8, label:"Filing: the complaint went in to federal court"},              /* 12 Jun */
          {at:152, kind:"case", pull:16, buzz:.8, w:10, label:"Joint statement: 41 organisations signed on"},          /* 16 Jul */
          {at:205, kind:"issue", crowd:1.3, buzz:2.2, w:5, label:"National news: the immigration court backlog made the headlines"}],    /* 7 Sep */
      week:{kind:"case", buzz:.6, label:"Backers rallied: the government's answer came due"}},

    /* Listed 3 Mar. Funding moves in steps, each one after coverage: the
       independent testing in mid-March, the records requests in July, the
       withheld permit files in September. Each spike brings a crowd that
       converts poorly, and leaves the base a little higher. */
    "riverside-water": {conv:.046, vr:1.3, time:104, play:2.0, invest:2.4, done:.5, share:.016, beta:.55,
      src:{watch:12, player:4, cases:27, trending:17, link:16, mine:8, other:6},
      shape: t => burst(t, 30, 9, 2) + 26*(1 + .45*step(t, 14) + .35*step(t, 125) + .2*step(t, 189)) * Math.exp(-t/230),
      ev:[{at:13, kind:"news", crowd:2.4, buzz:3, w:4, label:"Press: independent tests showed 3.4× the nitrate limit"},   /* 16 Mar */
          {at:124, kind:"news", crowd:1.9, buzz:2.4, w:5, label:"Press: reporters picked up the renewal memo"},     /* 5 Jul */
          {at:188, kind:"news", crowd:1.6, buzz:2, w:4, label:"Press: the withheld permit files came out"}],               /* 7 Sep */
      week:{kind:"news", label:"In the news: three outlets covered the permit challenge"}},

    /* Listed 18 Sep 2025. A long steady climber that lost pace in its
       second half-year while discovery dragged, picked up when mediation
       began in May, and is now in a settlement-talks surge. */
    "transit-access": {conv:.05, vr:1.3, time:118, play:2.1, invest:2.2, done:.52, share:.014, beta:.5,
      src:{watch:13, player:4, cases:33, trending:20, link:8, mine:12, other:7}, run:21, lead:.72,
      shape: t => burst(t, 60, 14, 2) + 54*(1 - .62*step(t, 160, 25)) + 26*step(t, 232, 8),
      ev:[{at:152, kind:"case", pull:24, buzz:1.1, w:12, label:"Discovery: the authority's ramp-failure logs came out"},   /* 17 Feb */
          {at:232, kind:"case", buzz:.8, w:8, label:"Mediation: talks began with the authority"}],                          /* 8 May */
      week:{kind:"case", buzz:1, label:"Settlement talks: the authority agreed to publish repair times"}},

    /* Listed 9 Nov 2025. The slow burner: a small launch, small bumps when
       the motion to dismiss was denied (March) and the collective was
       certified (June), and a long fade. A July heat wave put farmworkers
       in the national news, which brought a crowd the case did nothing
       to keep. Few visitors, short visits, low conversion, and almost
       nothing in the last month. */
    "farmworker-wages": {conv:.03, vr:1.22, time:74, play:1.6, invest:2.6, done:.33, share:.008, beta:.5,
      src:{watch:10, player:3, cases:46, trending:6, link:8, mine:14, other:8},
      shape: t => burst(t, 40, 12, 2) + 30*Math.exp(-t/120) + .9,
      ev:[{at:122, kind:"case", pull:14, buzz:1, w:8, label:"Ruling: the court denied the motion to dismiss"},                              /* 11 Mar */
          {at:213, kind:"case", pull:11, buzz:1, w:8, label:"Ruling: the court certified the collective"},                    /* 10 Jun */
          {at:250, kind:"issue", crowd:1.5, buzz:3, w:5, label:"National news: a heat wave put farmworkers in the headlines"}, /* 17 Jul */
          {at:272, kind:"case", pull:5, buzz:.6, w:6, label:"Notice: 312 workers were told in three languages"}]},                 /* 8 Aug */

    /* Listed 2 Aug. Watched, not funded: a strong launch, a bump when the
       vendor contract came back in September, coverage when state
       legislators cited it in October, and now a news spike as the
       district paused the rollout. The longest time on page and the best
       clip completion on the platform, and the worst conversion. */
    "school-facial-rec": {conv:.02, vr:1.3, time:173, play:2.5, invest:3, done:.66, share:.02, beta:.62,
      src:{watch:16, player:4, cases:22, trending:18, link:18, mine:4, other:6},
      shape: t => burst(t, 110, 9, 1.5) + 14,
      ev:[{at:0, kind:"news", buzz:2.2, w:6, label:"Launch: national technology press picked it up"},                /* 2 Aug */
          {at:37, kind:"case", pull:22, buzz:1.4, w:6, label:"Records: the vendor contract showed faces kept for seven years"},  /* 8 Sep */
          {at:67, kind:"news", crowd:1.8, buzz:2.2, w:4, label:"Press: two state legislators cited the case"}],        /* 8 Oct */
      week:{kind:"news", label:"In the news: the district paused the rollout"}}
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

  /* Every profile in one shape, so the day loops see one kind of object
     (V8 throws away optimised code when a second shape turns up). An
     event's pull is folded into the shape here, so the shape is the whole
     of a case's backing intensity. */
  const SRC0 = {watch: 0, player: 0, cases: 0, trending: 0, link: 0, mine: 0, other: 0};
  const EV0 = {at: 0, kind: "case", label: "", pull: 0, crowd: 0, buzz: 0, w: 6};
  const profile = p => {
    const ev = arr(p.ev).map(e => ({...EV0, ...e})), pulls = ev.filter(e => e.pull > 0);
    return {conv: p.conv, vr: p.vr, time: p.time, play: p.play, invest: p.invest, done: p.done, share: p.share,
      beta: p.beta ?? .5, run: p.run || 30, lead: p.lead || .8, ev, week: p.week || null, src: {...SRC0, ...p.src},
      shape: pulls.length ? t => { let s = p.shape(t); for(const e of pulls) s += e.pull * pulse(t, e.at, e.w); return s; } : p.shape};
  };

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
     listing day (o) to today (N-1). It runs in phases, each a small
     function with one loop over the days: the pledges, the dollars on
     them, the attention that produced them, where that attention came
     from, and the clips it watched.
     --------------------------------------------------------------------- */

  /* Phase 1. sm is expected pledges per day before rounding; visitors,
     invest opens and comments all hang off it, so they move together. Pl
     is the pledges themselves, whole, adding up to baseBackers. m is
     attention that money does not follow one for one: news brings a
     crowd, and conversion falls as m^-beta while visits rise as m. */
  function pledgesOf(c, id, P, L, d0, B){
    const beta = P.beta, tr = c.trending && typeof c.trending === "object" ? c.trending : null, kind = tr && tr.kind;
    const spark = tr && arr(tr.spark).length ? arr(tr.spark).map(pos) : null;
    const W = Math.min(7, L), H = L - W, tail = i => spark[clamp(spark.length - W + i, 0, spark.length-1)];
    const n7 = (kind === "backing" || kind === "talk") ? weekCount(tr.reason) : null, week = n7 != null || (kind === "news" && !!spark);

    const m = new Float64Array(L).fill(1);
    for(const e of P.ev) if(e.crowd > 0) for(let t = Math.max(0, e.at); t < L; t++) m[t] += e.crowd * pulse(t, e.at, e.w);
    /* the quietest of the week's first four days is the level before the
       story broke; the week's event is dated to the first day at 1.8 times it */
    let nw = null, rise = -1;
    if(spark){
      const s0 = Math.max(0, spark.length-7), lo0 = Math.min(...spark.slice(s0, s0 + 4)), lo = Number.isFinite(lo0) && lo0 > 0 ? lo0 : 1;
      for(let i = 0; i < W && rise < 0; i++) if(tail(i) >= 1.8*lo) rise = i;
      if(kind === "news"){ nw = new Float64Array(L).fill(1); for(let i = 0; i < W; i++) m[H+i] *= nw[H+i] = Math.max(1, tail(i)/lo); }
    }
    const sm = new Float64Array(L);
    for(let t = 0; t < L; t++) sm[t] = Math.max(1e-6, P.shape(t, L)) * (week && t >= H ? 1 : WEEK[(d0 + t + 4) % 7]) * (m[t] === 1 ? 1 : Math.pow(m[t], 1 - beta));
    const scale = (a, b, total) => { let s = 0; for(let t = a; t < b; t++) s += sm[t]; for(let t = a; t < b; t++) sm[t] = s > 0 ? sm[t]*total/s : 0; };
    const noisy = (a, b) => { const n = wobble(id, "pledges", L, .14), w = new Float64Array(b - a); for(let t = a; t < b; t++) w[t-a] = sm[t]*n[t]; return w; };

    const Pl = zeros(L);
    if(n7 != null){
      /* The badge's number is exactly the last seven days, shaped by its
         sparkline. A case younger than a week can only show baseBackers. */
      const n7c = H > 0 ? Math.min(n7, B) : B, wk = [];
      const sw = Array.from({length: W}, (_, i) => spark ? tail(i) : 1), ss = sw.reduce((a, b) => a + b, 0);
      for(let i = 0; i < W; i++) wk.push(ss > 0 ? n7c * sw[i]/ss : n7c/W);
      if(H > 0){
        /* Bend the run-up so the day before the week sits at lead x its
           first day: solve for k in sm*(1 + k*r), after rescaling. */
        const Ht = B - n7c, run = Math.max(1, Math.min(P.run, H)), target = P.lead * wk[0];
        const r = t => { const u = (t - (H - 1 - run)) / run; return u > 0 ? u*u : 0; };
        let S0 = 0, S1 = 0; for(let t = 0; t < H; t++){ S0 += sm[t]; S1 += sm[t]*r(t); }
        const e0 = sm[H-1], den = Ht*e0 - target*S1;
        const k = Ht > 0 ? clamp(den > 0 ? (target*S0 - Ht*e0)/den : 40, -.85, 40) : 0;
        for(let t = 0; t < H; t++) sm[t] *= 1 + k*r(t);
        scale(0, H, Ht);
        apportion(Ht, noisy(0, H), Pl, 0);
      }
      for(let i = 0; i < W; i++) sm[H+i] = wk[i];
      apportion(n7c, wk, Pl, H);
    }else if(B > 0){
      scale(0, L, B);
      apportion(B, noisy(0, L), Pl, 0);
    }else{
      /* Nobody has backed it yet: the attention its "watching now" count
         implies, and no money. */
      scale(0, L, pos(c.watching) * 12 * P.conv);
    }
    let smMean = 0; for(let t = 0; t < L; t++) smMean += sm[t];
    return {m, sm, Pl, beta, smMean: smMean/L || 1, nw, week: tr && spark ? H + Math.max(0, rise) : -1};
  }

  /* Phase 2. Dollars ride on pledges, adding up to baseRaised. The first
     backers of a case give a little more; a surge brings smaller, quicker
     pledges. */
  function dollarsOf(id, L, R, g){
    const {Pl, sm, smMean} = g, nA = wobble(id, "avg", L, .1), aw = new Float64Array(L); let awS = 0;
    for(let t = 0; t < L; t++){ aw[t] = Pl[t] * (1 + .12*Math.exp(-t/30)) * Math.pow(Math.max(sm[t], 1e-9)/smMean, -.07) * nA[t]; awS += aw[t]; }
    if(!(awS > 0)){ aw.set(sm); if(!sm.some(v => v > 0)) aw.fill(1); }   /* money with no backers on record: spread it anyway */
    return apportion(R, aw, zeros(L));
  }

  /* Phase 3. Attention, from pledges back through conversion, and the
     comments: the discussion total the case page shows, spread half by
     backing and half by traffic, since people argue as much as they give. */
  function attentionOf(x, o, id, P, L, g, Am, B, discussion){
    const {m, sm, Pl, beta} = g, X = x.m, V = new Float64Array(L);
    const nV = wobble(id, "visitors", L, .09), nR = wobble(id, "repeat", L, .04), nT = wobble(id, "time", L, .06),
          nPl = wobble(id, "plays", L, .07), nI = wobble(id, "invest", L, .1), nS = wobble(id, "shares", L, .22), nC = wobble(id, "comments", L, .25);
    const XV = X.visits, XU = X.visitors, XT = X.timeSec, XP = X.plays, XI = X.investOpens, XL = X.pledges, XA = X.amount, XS = X.shares;
    let svS = 0, smS = 0;
    for(let t = 0; t < L; t++){
      const i = o + t, mt = m[t], conv = mt === 1 ? P.conv : P.conv * Math.pow(mt, -beta);
      const v = Math.max(Pl[t], Math.round(sm[t]/conv * nV[t])), vis = Math.max(v, Math.round(v * P.vr * nR[t]));
      V[t] = v; XU[i] = v; XV[i] = vis;
      XT[i] = Math.round(vis * P.time * (mt === 1 ? 1 : Math.pow(mt, -.05)) * nT[t]);
      XP[i] = Math.round(vis * P.play * nPl[t]);
      XI[i] = Math.max(Pl[t], Math.round(sm[t] * P.invest * nI[t]));
      XL[i] = Pl[t]; XA[i] = Am[t];
      XS[i] = Math.round(v * P.share * (mt === 1 ? 1 : Math.pow(mt, .3)) * nS[t]);
      svS += v; smS += sm[t];
    }
    const dt = discussion && discussion[id] && +discussion[id].total;
    const CT = Number.isFinite(dt) && dt >= 0 ? Math.round(dt) : Math.round(B * .55), cw = new Float64Array(L);
    for(let t = 0; t < L; t++) cw[t] = ((smS ? sm[t]/smS : 0) + (svS ? V[t]/svS : 0)) * nC[t];
    apportion(CT, cw, X.comments, o);
  }

  /* Phase 4. Where visits came from. Trending exposure follows how hot
     the case is; news brings links; "mine" is backers coming back, so it
     grows with the number of backers so far. */
  function sourcesOf(x, o, id, P, L, g, B){
    const {m, sm, Pl, smMean} = g, S = P.src, nu = uniforms(id, "sources", L), sw = new Float64Array(7), part = zeros(7);
    const VV = VIA.map(k => x.via[k]), XV = x.m.visits;
    let cum = 0;
    for(let t = 0; t < L; t++){
      const h = Math.sqrt(sm[t]/smMean); cum += Pl[t];
      sw[0] = S.watch; sw[1] = S.player; sw[2] = S.cases; sw[3] = S.trending * (h < .4 ? .4 : h > 1.8 ? 1.8 : h);
      sw[4] = S.link * (m[t] === 1 ? 1 : Math.pow(m[t], .9)); sw[5] = S.mine * (.35 + (B ? cum/B : 0)); sw[6] = S.other;
      sourceDay(sw, part, VV, o + t, XV[o+t], nu[t]);
    }
  }
  /* The same unbiased rounding as the clips, with the cases list, the one
     steady source, taking what is left. Seven small wobbles come from the
     day's one draw. */
  function sourceDay(sw, part, VV, i, all, u){
    let s = 0, left = all;
    for(let k = 0; k < 7; k++){ const a = u * (k*7919 + 104729); s += sw[k] *= .9 + .2*(a - Math.floor(a)); }
    for(let k = 0; k < 7; k++) if(k !== 2){ const a = u * (k*15485863 + 7919), p = Math.floor(all * sw[k] / s + a - Math.floor(a)); part[k] = p; left -= p; }
    if(left >= 0) part[2] = left; else apportion(all, sw, part, 0, u);
    for(let k = 0; k < 7; k++) VV[k][i] = part[k];
  }

  /* Phase 5. Clips. The hero takes the largest share of plays and later
     clips less, except one, picked by the seed, that clearly outperforms:
     more plays than its place suggests, better completion, and more
     people going on to the case. A visit that came from the Watch feed or
     the player came from some reel, so the clips' toCase adds up to those
     two sources exactly. Returns plays per clip, to weight retention. */
  const KIND = {file:1.06, card:.96, embed:.78};
  function clipsOf(x, o, id, P, L){
    const rc = rng(id, "clips"), K = x.clips.length, star = K > 1 ? 1 + Math.floor(rc() * (K - 1)) : 0;
    const sh = [], q = [], dw = [], rw = [], iw = [], rep = [], rets = [];
    /* A case's reels send on (watch + player visits) / plays of their plays
       on average; no clip is let past about 12%, however good. */
    const S = P.src, sS = S.watch + S.player + S.cases + S.trending + S.link + S.mine + S.other;
    const rwMax = Math.max(1, .118 / Math.max(1e-9, (S.watch + S.player) / (sS || 1) / P.play));
    x.clips.forEach((cl, k) => {
      const lead = k === star && k > 0;
      const s = k === 0 ? 1 : .62 * Math.pow(.8, k-1) * (.85 + .3*rc());
      const qk = clamp(P.done * KIND[cl.kind] * Math.pow(60/cl.dur, .2) * (.9 + .2*rc()) + (lead ? .1 : 0), .2, .75);
      /* An early drop (people who swiped on), then steady decay, then a
         last small drop before the end. Embeds lose more up front. */
      const e = clamp(.1 + .18*(1 - qk) + (cl.kind === "embed" ? .05 : 0), .08, .3), lam = -Math.log(qk / (.93 * (1 - e))) / .9;
      const ret = Array.from({length: 11}, (_, j) => j === 0 ? 1 : (1 - e) * Math.exp(-lam * (j/10 - .1)) * (j === 10 ? .93 : 1));
      let a = 0; for(let j = 0; j < 10; j++) a += (ret[j] + ret[j+1])/20;
      sh.push(lead ? Math.min(.9, s * 1.75) : s); q.push(qk); dw.push(cl.dur * a); rets.push(ret); rep.push(1.12 + .25*qk);
      rw.push(Math.min(rwMax, (lead ? 1.5 : 1) * (.9 + .2*rc()))); iw.push(.85 + .3*rc());
    });
    /* Pass 1, day by day: the two splits that must add up exactly, plays
       to the case's plays and toCase to its Watch and player visits. Each
       later clip's part is rounded up or down at random in proportion to
       its fraction, which is unbiased, and the hero, always the largest,
       takes what is left; only a day too small for that falls back to
       apportion(). The draws are kept in nz for pass 2. */
    const nz = x.clips.map((_, k) => uniforms(id, "clip" + k, L)), nu = uniforms(id, "split", L), sp = {pw: new Float64Array(K), tw: new Float64Array(K), cp: zeros(K), ct: zeros(K)};
    const col = k => x.clips.map(cl => cl.m[k]), cP = col("plays"), cT = col("toCase");
    const X = x.m, XP = X.plays, XI = X.investOpens, XV = X.visits, XW = X.watchSec, XC = X.completes, wa = x.via.watch, pa = x.via.player;
    for(let t = 0; t < L; t++){ const i = o + t; splitDay(sp, K, t, i, nu[t], XP[i], wa[i] + pa[i], sh, rw, nz, cP, cT); }
    /* Pass 2, clip by clip: everything else follows from a clip's own
       plays and that day's draw. A clip watched further is finished more
       often, so watch time and completions move together. Invest opens
       from a reel are the case's invest opens in the same proportion as
       its visits from reels, rounded without bias; they answer to no
       published total, so they need not add up. */
    const ir = new Float64Array(L);
    for(let t = 0; t < L; t++) ir[t] = XV[o+t] > 0 ? XI[o+t] / XV[o+t] : 0;
    const synth = x.clips.map((cl, k) => clipDays(cl.m, nz[k], ir, XW, XC, o, L, dw[k], q[k], 1/rep[k], iw[k]));
    return {rets, synth};
  }
  /* one day's two splits (pass 1); on its own so the engine optimises it early */
  function splitDay(sp, K, t, i, u, all, toC, sh, rw, nz, cP, cT){
    const {pw, tw, cp, ct} = sp;
    let sw = 0, st = 0, left = all;
    for(let k = 0; k < K; k++) sw += pw[k] = sh[k] * (.72 + .56*nz[k][t]);
    for(let k = 1; k < K; k++){ const r = nz[k][t] * 7919, p = Math.floor(all * pw[k] / sw + r - Math.floor(r)); cp[k] = p; left -= p; }
    if(left >= 0) cp[0] = left; else apportion(all, pw, cp, 0, u);
    for(let k = 0; k < K; k++){ cP[k][i] = cp[k]; st += tw[k] = cp[k] * rw[k]; }
    left = toC;
    for(let k = 1; k < K; k++){ const r = nz[k][t] * 104729, c = st > 0 ? Math.floor(toC * tw[k] / st + r - Math.floor(r)) : 0; ct[k] = c; left -= c; }
    if(left >= 0) ct[0] = left; else apportion(toC, tw, ct, 0, u);
    for(let k = 0; k < K; k++) cT[k][i] = ct[k];
  }
  /* one clip's days; small and on its own so the engine optimises it early */
  function clipDays(m, z_, ir, XW, XC, o, L, dk, qk, rk, ik){
    const p_ = m.plays, v_ = m.viewers, w_ = m.watchSec, c_ = m.completes, t_ = m.toCase, i_ = m.toInvest;
    let n = 0;
    for(let t = 0; t < L; t++){
      const i = o + t, p = p_[i]; if(!p) continue;
      const v = z_[t], c = v * 15485863, watch = Math.round(p * dk * (.92 + .16*v)), d = Math.round(p * qk * (.94 + .12*v)), vv = Math.round(p * rk * (1.04 - .08*v));
      const done = d < p ? d : p;
      v_[i] = vv < 1 ? 1 : vv > p ? p : vv; w_[i] = watch; c_[i] = done;
      i_[i] = Math.floor(t_[i] * ik * ir[t] + c - Math.floor(c));
      XW[i] += watch; XC[i] += done; n += p;
    }
    return n;
  }

  /* Phase 6. What happened, and the buzz it made. The events are the
     profile's own, plus the trending week, dated to the day its badge's
     sparkline took off and named by the profile, or by the badge itself
     ("Settlement talks — 1,204 joined this week") for any other case. */
  function eventsOf(c, P, L, g){
    const out = P.ev.filter(e => e.at >= 0 && e.at < L);
    if(g.week >= 0){
      const k = c.trending.kind, wk = P.week || {};
      out.push({...EV0, at: g.week, w: 4, buzz: wk.buzz || 0, label: wk.label || String(c.trending.reason),
        kind: wk.kind || (k === "news" ? "news" : k === "talk" ? "case" : "backing")});
    }
    return out.sort((p, q) => p.at - q.at);
  }
  /* Buzz is news and social mentions of the case or its issue, per day,
     the way a listening service counts them. The level follows the case's
     own "Public attention" score; each event lifts it, a news week lifts it
     as far as the badge's sparkline does, and backing lifts it a little,
     because backers share what they back. */
  const publicAttention = c => { const f = arr(c.impact && c.impact.factors).find(f => /public attention/i.test(f && f.label || ""));
    return f && Number.isFinite(+f.score) ? clamp(+f.score, 0, 100) : 50; };
  function buzzOf(x, o, id, L, g, evs){
    const base = 3 * Math.exp(publicAttention(x.c) / 22), n = wobble(id, "buzz", L, .18), Z = x.m.buzz, {sm, smMean, nw} = g;
    const lift = evs.filter(e => e.buzz > 0);
    for(let t = 0; t < L; t++){
      let k = 1; for(const e of lift) k += e.buzz * pulse(t, e.at, e.w);
      Z[o+t] = Math.round(base * k * (nw ? nw[t] : 1) * Math.pow(Math.max(sm[t], 1e-9)/smMean, .3) * n[t]);
    }
  }

  function baseline(x, o, N, d0, discussion){
    const c = x.c, id = x.id, L = N - o; if(L <= 0) return null;
    const P = profile(PROFILES[id] || derive(c, L));
    const B = Math.max(0, Math.round(+c.baseBackers || 0)), R = Math.max(0, Math.round(+c.baseRaised || 0));
    const g = pledgesOf(c, id, P, L, d0, B);
    attentionOf(x, o, id, P, L, g, dollarsOf(id, L, R, g), B, discussion);
    sourcesOf(x, o, id, P, L, g, B);
    const evs = eventsOf(c, P, L, g);
    buzzOf(x, o, id, L, g, evs);
    x.events = evs.map(e => ({i: o + e.at, kind: e.kind, label: e.label}));
    return clipsOf(x, o, id, P, L);
  }

  /* ---------------------------------------------------------------------
     build(opts) → the model. See the contract at the end of this file.
     --------------------------------------------------------------------- */
  function build(opts={}){
    const asked = opts.now == null ? null : opts.now instanceof Date ? opts.now : new Date(opts.now);
    const now = asked && Number.isFinite(asked.getTime()) ? asked : new Date();
    const today = dayNum(now), demo = opts.demo !== false, real = opts.real && typeof opts.real === "object" ? opts.real : null;
    const cats = opts.cats || (typeof CATS !== "undefined" ? CATS : globalThis.CATS) || {};
    const discussion = opts.discussion || (typeof DISCUSSION !== "undefined" ? DISCUSSION : globalThis.DISCUSSION) || {};
    const listed = opts.listed || {};
    const cs = arr(opts.cases).filter(c => c && c.id != null);

    /* The listing day: the case's own "vetted" date when it reads as a
       date, else the admin's override, else sixty days ago. vetted comes
       first so that saving an edited demo case (a new row, a new
       created_at) cannot move its history. Never later than today, and
       never more than five years back: "2002" for "2026" would otherwise
       quietly build twenty-four years of days for every case. */
    const lday = cs.map(c => {
      let d = dayNum(c.vetted); if(!sane(d)) d = dayNum(listed[c.id]); if(!sane(d)) d = today - 60;
      return clamp(d, today - 1826, today);
    });
    const start = cs.length ? Math.min(...lday) : today, N = today - start + 1;
    const days = Array.from({length: N}, (_, i) => iso(start + i));

    const syn = [];   /* per case: the baseline's retention curves and plays per clip */
    const cases = cs.map((c, j) => {
      const cat = cats[c.cat];
      const x = {id: String(c.id), c, title: c.title || c.head || String(c.id), color: cat && cat.color || "#5B6675", listedIdx: lday[j] - start,
        m: Object.fromEntries(M.map(k => [k, zeros(N)])), via: Object.fromEntries(VIA.map(k => [k, zeros(N)])),
        clips: reels(c).map(r => ({...r, m: Object.fromEntries(CM.map(k => [k, zeros(N)])), retention: null})),
        events: [], f: standing(c, discussion)};
      syn.push(demo ? baseline(x, x.listedIdx, N, lday[j], discussion) : null);
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
          const acc = reach.get(cl) || {n: 0, r: zeros(10)}, rr = Array.from({length: 10}, (_, j) => Math.min(p, pos(r.reach[j])));
          acc.n += p; for(let j = 0; j < 10; j++) acc.r[j] += rr[j];
          reach.set(cl, acc);
          (cl.realReach || (cl.realReach = [])).push({i, p, r: rr});   /* by day, so a range can have its own curve */
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
    /* one row per pledge or comment, or a day's total with n */
    const many = r => r.n != null ? pos(r.n) : 1;
    for(const p of arr(opts.pledges)){
      const h = row(p); if(!h) continue; const k = many(p);
      h[0].m.pledges[h[1]] += k; h[0].m.amount[h[1]] += pos(p.amount); realPledges += k;
    }
    for(const cm of arr(opts.comments)){
      const h = row(cm); if(!h) continue; const k = many(cm);
      h[0].m.comments[h[1]] += k; realComments += k;
    }

    /* A clip's retention is one curve: the baseline's, weighted by its
       plays, blended with real reach, weighted by real plays. */
    cases.forEach((x, j) => x.clips.forEach((cl, k) => {
      const s = syn[j], sn = s ? s.synth[k] : 0, sr = s && s.rets[k], rl = reach.get(cl) || {n: 0, r: zeros(10)}, n = sn + rl.n;
      cl.synRet = sn ? sr : null;
      /* no plays, no curve: nothing is known about where viewers stop */
      cl.retention = n > 0 ? Array.from({length: 11}, (_, i) => i === 0 ? 1 : clamp(((sn ? sn * sr[i] : 0) + rl.r[i-1]) / n, 0, 1)) : null;
    }));

    /* The feed of real things that happened, newest first. */
    const t = v => { const n = Date.parse(v); return Number.isFinite(n) ? n : 0; };
    /* the same rule as the counts: a known case, on a day inside the history */
    const keep = (r, at) => r && byId.has(String(r.case_id)) && row({case_id: r.case_id, d: at});
    const recent = [
      ...arr(real && real.recent).filter(r => keep(r, r.at)).map(r => ({...r})),
      ...arr(opts.recentPledges ?? opts.pledges).filter(p => keep(p, p.created_at)).map(p => ({at: p.created_at, kind: "pledge", case_id: p.case_id,
        clip: null, via: null, seconds: null, pct: null, actor_id: p.actor_id ?? null, amount: pos(p.amount), name: p.display_name ?? null})),
      ...arr(opts.recentComments ?? opts.comments).filter(cm => keep(cm, cm.created_at)).map(cm => ({at: cm.created_at, kind: "comment", case_id: cm.case_id,
        clip: null, via: null, seconds: null, pct: null, actor_id: cm.actor_id ?? null, name: cm.name ?? null}))
    ].sort((a, b) => t(b.at) - t(a.at)).slice(0, 40);

    /* Buzz has no real source yet: until a listening service is connected,
       only the demo history has any. */
    const hasBuzz = cases.some(x => x.m.buzz.some(v => v > 0));
    return {now, today: iso(today), days, demo, hasBuzz, cats, realEvents, realPledges, realComments, recent, cases};
  }

  /* ---------------------------------------------------------------------
     A case's standing: what its own page tells a backer before they
     decide. Chance to win and social impact are data.js's own scores when
     it is loaded (the same rule otherwise); the rest is read off the case.
     A missing value is null, never a guess, and leaves the case out of
     that comparison.
       merit    chance to win, 1 to 99
       base     how often similar cases win, the score's starting point
       record   counsel's record: the firm's "Relief obtained" share
       ret      what a dollar is expected to come back as, odds-weighted
       lock     years the money is locked in
       impact   social impact, 1 to 99
       support  the supportive share of the discussion
     --------------------------------------------------------------------- */
  const fin = v => v != null && v !== "" && Number.isFinite(+v) ? +v : null;
  const ownMerit  = c => clamp(Math.round(+c.merit.base + arr(c.merit.factors).reduce((s, f) => s + (+f.delta || 0), 0)), 1, 99);
  const ownImpact = c => clamp(Math.round(arr(c.impact.factors).reduce((s, f) => s + (+f.weight || 0) * (+f.score || 0), 0)), 1, 99);
  const score = (fn, own, c) => { try{ return fin(typeof fn === "function" ? fn(c) : own(c)); }catch(e){ return null; } };
  function standing(c, discussion){
    const o = c.outcomes || {}, [w, wm, s, sm] = [o.win, o.winMult, o.settle, o.settleMult].map(fin);
    const months = arr(c.stageMonths).reduce((a, m) => a + (fin(m) || 0), 0);
    const rel = arr(c.people && c.people.firm && c.people.firm.stats).find(r => Array.isArray(r) && /relief|won|success/i.test(String(r[0])));
    const relief = rel ? parseFloat(String(rel[1]).replace(/,/g, "")) : NaN;
    const pulse_ = discussion && discussion[c.id] && discussion[c.id].pulse, said = pulse_ ? (+pulse_.support || 0) + (+pulse_.question || 0) + (+pulse_.skeptical || 0) : 0;
    return {
      merit: score(typeof meritScore !== "undefined" ? meritScore : null, ownMerit, c),
      base: fin(c.merit && c.merit.base),
      record: Number.isFinite(relief) && relief >= 0 && relief <= 100 ? relief : null,
      ret: w != null && wm > 0 && s != null && sm != null ? w*wm + s*sm : null,
      lock: months > 0 ? months / 12 : null,
      impact: score(typeof impactScore !== "undefined" ? impactScore : null, ownImpact, c),
      support: said > 0 ? (+pulse_.support || 0) / said : null
    };
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
    const platform = blank(), prev = blank(), series = {amount: zeros(n), pledges: zeros(n), visits: zeros(n), visitors: zeros(n), plays: zeros(n), watchSec: zeros(n), buzz: zeros(n)};
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
      return {id: x.id, title: x.title, color: x.color, c: x.c, f: x.f, listedIdx: o, daysLive, liveIn, totals, prev: pv,
        raised, backers, goal, fundedPct: raised/goal, velocity7, velocityPrev, momentum, trend, milestones, etaDays,
        attentionMin, attentionPerDay: ratio(attentionMin, liveIn), moneyPerDay: ratio(totals.amount, liveIn),
        visitorsPerDay: ratio(totals.visitors, liveIn), buzzPerDay: ratio(totals.buzz, liveIn), minPerVisitor: ratio(attentionMin, totals.visitors),
        cumulative, spark: Array.from({length: 14}, (_, k) => { const i = b - 13 + k; return i >= 0 ? A[i] : 0; })};
    });
    const out = {range: {from: a, to: b, days: n}, platform: Object.assign(finish(platform), {prev: finish(prev)}), series, cases};
    Object.defineProperty(out, "model", {value: model, enumerable: false});   /* lets the analyses below look at clips, sources and events */
    return out;
  }

  /* The drop-off curve for one range: the baseline's shape weighted by its
     plays in the range, blended with the real reach recorded on those days.
     null when nothing was played. */
  function rangeRetention(cl, plays, a, b){
    let rp = 0; const R = zeros(10);
    for(const q of cl.realReach || []) if(q.i >= a && q.i <= b){ rp += q.p; for(let j = 0; j < 10; j++) R[j] += q.r[j]; }
    const sp = cl.synRet ? Math.max(0, plays - rp) : 0, n = sp + rp;
    if(!(n > 0)) return null;
    return Array.from({length: 11}, (_, i) => i === 0 ? 1 : clamp(((sp ? sp * cl.synRet[i] : 0) + R[i-1]) / n, 0, 1));
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
          retention: rangeRetention(cl, s.plays, a, b)});
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
     drivers(summary): what goes with investment. Every factor is held up
     against three outcomes across the live cases:
       reach  visitors a day               does it bring people in
       rate   the share of them who invest does it make them back the case
       avg    the average investment       does it make them put in more
     by rank (Spearman), so one runaway case cannot make a pattern on its
     own. The standing factors are the case's own page (standing() above);
     buzz and time spent are the range's. A case with under 50 visitors in
     the range is too quiet to say anything about, and a factor is only
     compared across four or more cases. With six cases this shows a
     direction to test, not proof, and the page says so.
     --------------------------------------------------------------------- */
  const FACTORS = [
    {key: "merit",   label: "Chance to win",           group: "Case strength", unit: ""},
    {key: "base",    label: "Similar cases' win rate", group: "Historical performance", unit: "%"},
    {key: "record",  label: "Counsel's track record",  group: "Historical performance", unit: "%"},
    {key: "ret",     label: "Expected return",         group: "Financial",    unit: "×"},
    {key: "lock",    label: "Lock-in",                 group: "Financial",    unit: " yrs"},
    {key: "impact",  label: "Social impact",           group: "Social impact", unit: ""},
    {key: "buzz",    label: "Social buzz",             group: "Public sentiment", unit: "/day"},
    {key: "support", label: "Supportive discussion",   group: "Public sentiment", unit: "%"},
    {key: "time",    label: "Time spent per visitor",  group: "Attention",    unit: " min"}
  ];
  const OUTCOMES = [{key: "reach", label: "Brings visitors"}, {key: "rate", label: "Turns them into investors"}, {key: "avg", label: "Bigger investments"}];
  function ranks(v){
    const s = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Array(v.length);
    for(let i = 0; i < s.length;){ let j = i; while(j + 1 < s.length && s[j+1][0] === s[i][0]) j++;
      for(let k = i; k <= j; k++) r[s[k][1]] = (i + j)/2 + 1; i = j + 1; }
    return r;
  }
  function spearman(x, y){
    const n = x.length; if(n < 4) return null;
    const rx = ranks(x), ry = ranks(y), m = (n + 1)/2; let sxy = 0, sxx = 0, syy = 0;
    for(let i = 0; i < n; i++){ sxy += (rx[i]-m)*(ry[i]-m); sxx += (rx[i]-m)**2; syy += (ry[i]-m)**2; }
    return sxx > 0 && syy > 0 ? sxy/Math.sqrt(sxx*syy) : null;
  }
  const strength = r => r == null ? "n/a" : Math.abs(r) >= .7 ? "Strong" : Math.abs(r) >= .4 ? "Moderate" : Math.abs(r) >= .2 ? "Weak" : "None";

  function drivers(summary){
    const model = summary.model, cs = summary.cases.filter(x => x.totals.visitors >= 50 && x.liveIn >= 3);
    const factor = (x, k) => k === "buzz" ? (model && model.hasBuzz ? x.buzzPerDay : null) : k === "time" ? (x.totals.visitors ? x.minPerVisitor : null) : x.f ? x.f[k] : null;
    const outcome = (x, k) => k === "reach" ? x.visitorsPerDay : k === "rate" ? x.totals.conversion : x.totals.pledges >= 10 ? x.totals.avgPledge : null;
    /* the halves, for saying it in words: the top half by the factor
       against the bottom half, the middle case left out when there is
       one. Rates and averages are pooled over people, reach is per case. */
    const pool = (g, k) => k === "reach" ? g.reduce((s, x) => s + x.visitorsPerDay, 0)/g.length
      : k === "rate" ? ratio(g.reduce((s, x) => s + x.totals.pledges, 0), g.reduce((s, x) => s + x.totals.visitors, 0))
      : ratio(g.reduce((s, x) => s + x.totals.amount, 0), g.reduce((s, x) => s + x.totals.pledges, 0));
    const rows = FACTORS.map(F => {
      const has = cs.filter(x => fin(factor(x, F.key)) != null), vals = Object.fromEntries(has.map(x => [x.id, factor(x, F.key)]));
      const cells = Object.fromEntries(OUTCOMES.map(O => {
        const both = has.filter(x => fin(outcome(x, O.key)) != null);
        const rho = spearman(both.map(x => vals[x.id]), both.map(x => outcome(x, O.key)));
        const by = [...both].sort((p, q) => vals[q.id] - vals[p.id] || (p.id < q.id ? -1 : 1)), h = both.length >> 1;
        const top = by.slice(0, h), bottom = by.slice(both.length - h);
        return [O.key, {rho, n: both.length, label: strength(rho), top: top.map(x => x.id), bottom: bottom.map(x => x.id),
          hi: h ? pool(top, O.key) : null, lo: h ? pool(bottom, O.key) : null}];
      }));
      return {...F, n: has.length, vals, cells};
    }).filter(r => r.n >= 4);
    const key = r => r.cells.rate.rho == null ? -1 : Math.abs(r.cells.rate.rho) + .001*Math.abs(r.cells.reach.rho || 0);
    rows.sort((p, q) => key(q) - key(p));
    const outcomes = Object.fromEntries(cs.map(x => [x.id, Object.fromEntries(OUTCOMES.map(O => [O.key, outcome(x, O.key)]))]));
    return {n: cs.length, cases: cs.map(x => x.id), rows, outcomes, OUTCOMES};
  }

  /* ---------------------------------------------------------------------
     spikes(model, caseId|null, from, to): days a case drew far more than
     usual, and what was behind them. A day is hot when its visits reach
     1.8 times the median of the 28 days before (and at least 20 more), or
     its money twice the usual (and at least $250 more); hot days with no
     more than one quiet day between them are one spike, of two weeks at
     most, measured against the days before it began. Each day is judged
     against its own 28 days, so a slow climb never reads as a spike. What
     caused it is, in order: an event of
     the case's from three days before it began to its last day, a jump in
     buzz, or the visit source that brought most of the extra visitors,
     with the clip behind them when that source was a reel. Biggest first,
     by extra visits.
     --------------------------------------------------------------------- */
  /* the usual day before day i: medians of the 28 days before it, and
     with full, the sources and clips too (only needed once a spike starts) */
  function usual(x, o, i, full){
    const a = Math.max(o, i - 28), X = x.m, med = s => median(Array.prototype.slice.call(s, a, i));
    const u = {visits: med(X.visits), amount: med(X.amount)};
    return full ? Object.assign(u, {buzz: med(X.buzz), conv: ratio(sumF(X.pledges, a, i-1), sumF(X.visitors, a, i-1)),
      via: Object.fromEntries(VIA.map(k => [k, med(x.via[k])])), toCase: x.clips.map(cl => med(cl.m.toCase))}) : u;
  }
  function spikes(model, caseId, from, to){
    const [a, b] = span(model, from, to), out = [];
    for(const x of model.cases){
      if(caseId != null && x.id !== String(caseId)) continue;
      const X = x.m, o = Math.max(0, x.listedIdx);
      let ep = null;
      for(let i = Math.max(a, o + 7); i <= b + 1; i++){
        const u = i <= b ? usual(x, o, i) : null;
        const hot = i <= b && ((X.visits[i] >= 1.8*u.visits && X.visits[i] - u.visits >= 20) || (X.amount[i] >= 2*u.amount && X.amount[i] - u.amount >= 250));
        if(ep && (!hot && i - ep.e > 1 || i > b || hot && i - ep.s >= 14)){ out.push(spike(model, x, ep.s, ep.e, ep.u)); ep = null; }
        if(hot){ if(ep) ep.e = i; else ep = {s: i, e: i, u: usual(x, o, i, true)}; }
      }
    }
    return out.sort((p, q) => q.extra - p.extra);
  }
  function spike(model, x, s, e, u){
    const X = x.m, d = e - s + 1, tot = k => sumF(X[k], s, e);
    let peak = s; for(let i = s; i <= e; i++) if(X.visits[i]/(u.visits || 1) > X.visits[peak]/(u.visits || 1)) peak = i;
    const extra = tot("visits") - u.visits*d, conv = ratio(tot("pledges"), tot("visitors"));
    /* where the extra visits came from */
    const ex = VIA.map(k => [k, sumF(x.via[k], s, e) - u.via[k]*d]), plus = ex.reduce((t, [, v]) => t + Math.max(0, v), 0);
    const [top, topN] = ex.sort((p, q) => q[1] - p[1])[0];
    let clip = null;
    if(top === "watch" || top === "player"){
      const cx = x.clips.map((cl, k) => [cl, sumF(cl.m.toCase, s, e) - u.toCase[k]*d]).sort((p, q) => q[1] - p[1])[0];
      if(cx && cx[1] > 0) clip = {key: cx[0].key, title: cx[0].title};
    }
    const ev = x.events.filter(v => v.i >= s - 3 && v.i <= e).sort((p, q) => Math.abs(p.i - s) - Math.abs(q.i - s))[0] || null;
    const bx = model.hasBuzz && u.buzz > 0 ? tot("buzz")/(u.buzz*d) : null, share = plus > 0 ? Math.max(0, topN)/plus : 0;
    const cause = ev ? {type: "event", kind: ev.kind, label: ev.label, at: ev.i}
      : bx != null && bx >= 2 ? {type: "buzz"} : share >= .35 ? {type: "source"} : {type: "unknown"};
    return {caseId: x.id, title: x.title, color: x.color, c: x.c, from: s, to: e, peak, days: d, extra,
      extraMoney: tot("amount") - u.amount*d, visitsX: ratio(tot("visits"), u.visits*d), moneyX: u.amount > 0 ? tot("amount")/(u.amount*d) : null,
      buzzX: bx, convX: u.conv > 0 ? conv/u.conv : null, conv, usualConv: u.conv, cause, source: top, sourceShare: share, clip};
  }

  /* ---------------------------------------------------------------------
     issues(summary): the cases grouped by what they are about, each
     issue's share of the platform's attention (minutes on clips and case
     pages) set against its share of the money, and how it converts.
     --------------------------------------------------------------------- */
  function issues(summary){
    const cats = summary.model && summary.model.cats || {}, by = new Map(), P = summary.platform;
    const attTotal = (P.watchSec + P.timeSec)/60;
    for(const x of summary.cases){
      const k = x.c.cat in cats ? x.c.cat : "other";
      let g = by.get(k); if(!g) by.set(k, g = {key: k, label: cats[k] ? cats[k].label : "Other", cases: [], T: blank(), prev: 0});
      g.cases.push(x); for(const m of M) g.T[m] += x.totals[m]; g.prev += x.prev.amount;
    }
    return [...by.values()].map(g => { const T = finish(g.T), att = (T.watchSec + T.timeSec)/60;
      return {key: g.key, label: g.label, cases: g.cases.map(x => x.id), visitors: T.visitors, attentionMin: att, amount: T.amount, pledges: T.pledges,
        buzz: T.buzz, conversion: T.conversion, avgPledge: T.avgPledge, prevAmount: g.prev, change: g.prev > 0 ? T.amount/g.prev - 1 : null,
        attentionShare: ratio(att, attTotal), moneyShare: ratio(T.amount, P.amount), visitorShare: ratio(T.visitors, P.visitors), buzzShare: ratio(T.buzz, P.buzz)};
    }).sort((p, q) => q.moneyShare - p.moneyShare);
  }

  /* ---------------------------------------------------------------------
     backing(model, rows): which issues the same people back. rows are
     pledges, one each, with actor_id and case_id, as admin_pledges()
     returns them; a backer is an actor. The demo history adds an overlap
     of its own: backers lean towards cases that are alike to back (chance
     to win, expected return, social impact), scaled so that about a
     quarter of all backers back more than one case.
     --------------------------------------------------------------------- */
  function backing(model, rows){
    const cats = model.cats || {}, cs = model.cases, issue = x => x.c.cat in cats ? x.c.cat : "other";
    const backers = {}, both = {}, pair = (p, q) => p < q ? p + "|" + q : q + "|" + p;
    let total = 0, multi = 0;
    if(model.demo){
      const B = cs.map(x => Math.max(0, +x.c.baseBackers || 0)), keys = ["merit", "ret", "impact"];
      const z = keys.map(k => { const v = cs.map(x => fin(x.f[k])).filter(v => v != null), m = v.reduce((s, y) => s + y, 0)/(v.length || 1),
        sd = Math.sqrt(v.reduce((s, y) => s + (y - m)**2, 0)/(v.length || 1)) || 1; return x => fin(x.f[k]) == null ? 0 : (x.f[k] - m)/sd; });
      const sim = [], S = []; let sS = 0;
      cs.forEach((x, i) => cs.forEach((y, j) => { if(j <= i) return;
        const d2 = z.reduce((s, f) => s + (f(x) - f(y))**2, 0), w = Math.sqrt(B[i]*B[j]) * Math.exp(-d2/4); sim.push([i, j, w]); sS += w; }));
      const all = B.reduce((s, v) => s + v, 0), k = sS > 0 ? .25*all/1.25/sS : 0;
      cs.forEach((x, i) => { backers[issue(x)] = (backers[issue(x)] || 0) + B[i]; });
      for(const [i, j, w] of sim){ const o = Math.round(k*w), p = issue(cs[i]), q = issue(cs[j]); multi += o;
        if(p !== q) both[pair(p, q)] = (both[pair(p, q)] || 0) + o; }
      total = all - multi;
    }
    /* real backers, on top */
    const byId = new Map(cs.map(x => [x.id, x])), who = new Map();
    for(const r of arr(rows)){ const x = r && byId.get(String(r.case_id)); if(!x || !r.actor_id) continue;
      const s = who.get(r.actor_id) || {cases: new Set(), issues: new Set()}; s.cases.add(x.id); s.issues.add(issue(x)); who.set(r.actor_id, s); }
    for(const s of who.values()){
      total++; if(s.cases.size > 1) multi++;
      const is = [...s.issues]; is.forEach(p => { backers[p] = (backers[p] || 0) + 1; });
      is.forEach((p, i) => is.slice(i + 1).forEach(q => { both[pair(p, q)] = (both[pair(p, q)] || 0) + 1; }));
    }
    const keys = Object.keys(backers).filter(k => backers[k] > 0);
    const share = (p, q) => p === q || !backers[p] ? null : ratio(both[pair(p, q)] || 0, backers[p]);
    return {issues: keys.map(k => ({key: k, label: cats[k] ? cats[k].label : "Other", backers: backers[k]})), share,
      both: (p, q) => both[pair(p, q)] || 0, total, multi, repeatShare: ratio(multi, total), realBackers: who.size};
  }

  /* ---------------------------------------------------------------------
     discussion(comments): what people talk about, and who says it. Each
     comment is {case_id, text, stance (support, question, skeptical or
     null), backer, likes, answered (null when not known)}. A theme is a
     set of words, so this is a reading by rule, not by a model: it is the
     part a language model will do properly once one is connected.
     --------------------------------------------------------------------- */
  const THEMES = [
    {key: "odds", label: "Odds and legal risk",
      re: /\bodds\b|\bscore\b|\b\d\d% (is|with)\b|generous|circuits?\b|deference|immunity|precedent in (the|this) state|no controlling|appeals? everything|would sink|denied three|\bmoot\b|collectab|thinnest|standard of review/i},
    {key: "returns", label: "Returns and lock-in",
      re: /\breturns?\b|lock-?in|payout|fee award|fee-shifting|backer share|backers? (actually )?get|money back|surplus|upside|funding proposition|thin next to/i},
    {key: "process", label: "How it would play out",
      re: /what happens|how does|how strong|what stops|any risk|sticking point|does the (pause|deletion)|if the (court|case)|if they settle|class definition|actual plan/i},
    {key: "evidence", label: "The evidence",
      re: /evidence|\bfoia\b|\brecords?\b|\blogs?\b|logging|receipts|notebooks|\bmemo\b|contract\b|tickets|samples?\b|chain of custody|exhibit|audit|permits?\b|\bpayroll\b(?!s)|minutes\b|agenda/i},
    {key: "people", label: "The people in it",
      re: /\bmy (mother|father|brother|sister|parents|daughter|son|family)\b|our daughter|plaintiff|petitioner|raised two|children|families|\bI work\b|thirty-one years|\bI wrote\b/i},
    {key: "reach", label: "How far it reaches",
      re: /\bas a precedent\b|precedent matters|countywide|every (future|district)\b|\d[\d,]* (people|families|workers|riders|districts|students|households|organisations|payrolls|growers)\b|eleven (other )?(growers|payrolls)|hundred thousand|nowhere for|coalition|lasting/i},
    {key: "clips", label: "The clips", re: /\bclips?\b|\bfilm\b|\bvideo\b/i}
  ];
  function discussion(comments){
    const cs = arr(comments).filter(c => c && c.text), out = THEMES.map(t => ({key: t.key, label: t.label, n: 0, backers: 0, others: 0,
      stance: {support: 0, question: 0, skeptical: 0}}));
    let backers = 0, stance = {support: 0, question: 0, skeptical: 0};
    for(const c of cs){
      if(c.backer) backers++; if(c.stance in stance) stance[c.stance]++;
      THEMES.forEach((t, k) => { if(!t.re.test(c.text)) return; const o = out[k];
        o.n++; c.backer ? o.backers++ : o.others++; if(c.stance in o.stance) o.stance[c.stance]++; });
    }
    const unanswered = cs.filter(c => c.stance === "question" && c.answered === false).sort((p, q) => (q.likes || 0) - (p.likes || 0));
    /* how many comments of a kind touch any of some themes: the analyst
       asks, say, how many doubts are about the odds or the return */
    const tags = cs.map(c => THEMES.filter(t => t.re.test(c.text)).map(t => t.key));
    const count = (keep, keys) => cs.reduce((s, c, i) => s + (keep(c) && (!keys || tags[i].some(k => keys.includes(k))) ? 1 : 0), 0);
    return {n: cs.length, backers, others: cs.length - backers, stance, themes: out.filter(t => t.n > 0), unanswered, count,
      themesOf: text => THEMES.filter(t => t.re.test(text)).map(t => t.key)};
  }

  /* ---------------------------------------------------------------------
     analyst(summary, inputs): the AI analyst's reading of a range, for
     the platform or, with inputs.caseId, for one case: why things moved
     and what to try, not what happened. Today it is written by rule from
     the analyses above, so every sentence carries its numbers and can be
     checked against the charts. A model connected later is handed the
     same inputs, which are plain data, and asked for the same shape:
       {headline, findings: [{tone, caseId, title, why, act}]}
     inputs: {drivers, spikes, issues, backing, talk, clips, caseId}
     --------------------------------------------------------------------- */
  /* thousands by hand: an Intl.NumberFormat costs ~15ms to build on first load, for commas */
  const int = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const money = n => n >= 1e6 ? "$" + (n/1e6).toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "M"
    : n >= 1e5 ? "$" + Math.round(n/1e3) + "k" : n >= 1e3 ? "$" + int(Math.round(n/100)*100) : "$" + int(n);
  const pct = x => x < .1 ? (x*100).toFixed(1) + "%" : Math.round(x*100) + "%";
  const times = x => x >= 10 ? Math.round(x) + "×" : x.toFixed(1) + "×";
  const rh = r => (r < 0 ? "−" : "") + Math.abs(r).toFixed(2);
  const rhs = rs => { const lo = Math.min(...rs), hi = Math.max(...rs); return lo === hi ? rh(lo) + (rs.length > 1 ? " each" : "") : rh(lo) + " to " + rh(hi); };
  const list = (a, and = "and") => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " " + and + " " + a[a.length-1];
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const an = w => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
  /* "Court order: the court paused all forty evictions" → "Court order", and
     what happened, to follow "when"; a label in any other form is quoted */
  const headOf = l => String(l).split(":")[0].trim();
  const what = l => { const s = String(l), k = s.indexOf(":"); return k < 0 ? `“${s}”` : s.slice(k + 1).trim(); };
  const NOUN = {merit: "chance to win", base: "how often similar cases win", record: "counsel's track record", ret: "expected return",
    lock: "lock-in", impact: "social impact", buzz: "buzz", support: "a supportive discussion", time: "time spent"};
  const fval = (k, v) => v == null ? "–" : k === "base" || k === "record" ? Math.round(v) + "%" : k === "ret" ? v.toFixed(2) + "×"
    : k === "lock" ? v.toFixed(1) + " years" : k === "buzz" ? int(v) + " mentions a day" : k === "support" ? pct(v)
    : k === "time" ? v.toFixed(1) + " min" : String(Math.round(v));
  /* what to try when a factor goes with investing and a case is short of it */
  const LEVER = {
    merit: "Put the chance to win, and what would move it, next to the invest button and in the first clip; it is what decides people.",
    base: "Show how cases like this one have gone: a known record reads as confidence.",
    record: "Lead with counsel's record, the cases won and the relief obtained, on the case page and in the clips.",
    ret: "Say what a dollar comes back as in a settlement and in a win, in plain numbers, before people have to ask.",
    support: "Answer the questions and the doubts in the thread, in public; a discussion where counsel replies reads as confidence.",
    lock: "Say how long the money is locked in, and what could end it early, up front."
  };
  const SOURCE = {watch: "The Watch feed", player: "The clip player", cases: "The cases list", trending: "The trending rail",
    link: "Shared links", mine: "Returning backers", other: "Other places"};
  const CAUSE = {case: "the case's own news", news: "press coverage", issue: "news about the issue", social: "its own content travelling", backing: "backers"};
  const causeOf = s => s.cause.type === "buzz" ? "news" : s.cause.type === "event" ? s.cause.kind : null;

  function analyst(summary, inp = {}){
    const model = summary && summary.model;
    if(!model || !arr(summary.cases).length) return {headline: "", findings: []};
    const P = summary.platform, cs = summary.cases, b = summary.range.to, dr = inp.drivers, sp = arr(inp.spikes), is = arr(inp.issues);
    const bk = inp.backing, talk = inp.talk, one = inp.caseId != null ? cs.find(x => x.id === String(inp.caseId)) : null;
    const out = [], push = (score, tone, caseId, title, why, act, key) => out.push({score, tone, caseId, title, why, act, key: key || title});
    const lead = {};   /* the case's headline: where it stands, then its spike or its silence */
    const day = i => { const s = model.days[i] || ""; return +s.slice(8, 10) + " " + MON3[+s.slice(5, 7) - 1]; };
    const when = s => s.days > 1 ? `${day(s.from)} to ${day(s.to)}` : day(s.from);
    const wavg = (g, k) => { g = g.filter(s => s[k] != null); const w = g.reduce((t, s) => t + Math.max(1, s.extra), 0);
      return w ? g.reduce((t, s) => t + s[k]*Math.max(1, s.extra), 0)/w : null; };
    const busy = cs.filter(x => x.totals.visitors >= 50);

    /* which factors go with investing, and which only with visitors */
    const rows = dr && dr.n >= 4 ? dr.rows : [], row = k => rows.find(r => r.key === k);
    const pos = rows.filter(r => r.cells.rate.rho != null && r.cells.rate.rho >= .6);
    const crowd = ["time", "impact", "buzz"].map(row).filter(r => r && r.cells.reach.rho != null && r.cells.reach.rho >= .4 && Math.abs(r.cells.rate.rho ?? 0) < .4);
    const keyRows = rows.filter(r => Math.abs(r.cells.rate.rho ?? 0) >= .4 && !["time", "impact", "buzz"].includes(r.key));
    /* a case's place on a factor, best first in the direction that goes with investing */
    const place = (r, id) => { const up = (r.cells.rate.rho ?? 0) >= 0, ids = Object.keys(r.vals).sort((p, q) => up ? r.vals[q] - r.vals[p] : r.vals[p] - r.vals[q]);
      return {pos: ids.indexOf(id) + 1, n: ids.length}; };
    const placeText = p => p.pos === p.n ? `last of ${p.n}` : p.pos === 1 ? `first of ${p.n}` : `${ord(p.pos)} of ${p.n}`;
    /* [[row, place], …] → "last of 6 on chance to win (39) and counsel's track record (48%), 5th of 6 on …" */
    const places = (rs, id, vals = true) => { const by = new Map();
      for(const [r, p] of rs){ const t = placeText(p); by.set(t, [...(by.get(t) || []), NOUN[r.key] + (vals ? ` (${fval(r.key, r.vals[id])})` : "")]); }
      return list([...by].map(([t, ns]) => `${t} on ${list(ns)}`)); };

    if(!one && pos.length){
      const top = pos[0], c = top.cells.rate, names = pos.slice(0, 3).map(r => NOUN[r.key]);
      push(100, "info", null, `Investment follows ${list(names.slice(0, 2))}`,
        `Across the ${dr.n} live cases, the share of visitors who invest rises with ${list(names)} (ρ ${rhs(pos.slice(0, 3).map(r => r.cells.rate.rho))}).` +
        (c.hi != null && c.lo != null ? ` The ${c.top.length} cases highest on ${NOUN[top.key]} turn ${pct(c.hi)} of their visitors into investors; the other ${c.bottom.length}, ${pct(c.lo)}.` : ""),
        LEVER[top.key] || "", "drivers");
    }
    if(!one && crowd.length){
      const nouns = crowd.map(r => NOUN[r.key]), t = [...busy].sort((p, q) => q.minPerVisitor - p.minPerVisitor)[0];
      push(96, "warn", null, `${cap(list(nouns))} bring visitors, not investors`,
        `Cases with more ${list(nouns)} draw more visitors (ρ ${rhs(crowd.map(r => r.cells.reach.rho))}), but no larger share of them invest (ρ ${rhs(crowd.map(r => r.cells.rate.rho))}).` +
        (t ? ` ${t.title} holds people longest, ${t.minPerVisitor.toFixed(1)} minutes a visitor, and ${pct(t.totals.conversion)} of them invest, against ${pct(P.conversion)} across the platform.` : ""),
        "Judge clips and pages by how many viewers go on to invest, not by watch time or reach, and put the ask and the odds where the attention already is.", "crowd");
    }

    /* news against the case's own news */
    const news = sp.filter(s => ["news", "issue"].includes(causeOf(s)) && s.convX != null);
    const own = sp.filter(s => ["case", "backing", "social"].includes(causeOf(s)) && s.convX != null);
    const nc = wavg(news, "convX");
    if(!one && news.length && nc < .8){
      push(94, "warn", null, "News brings crowds that rarely invest",
        `${news.length === 1 ? `The news spike in this period, on ${news[0].title} (${day(news[0].from)}),` : `The ${news.length} news spikes in this period, the biggest on ${news[0].title} (${day(news[0].from)}),`} brought ${times(wavg(news, "visitsX"))} the usual visitors but ${times(wavg(news, "moneyX") || 0)} the money: people who came with the news invested at ${pct(nc)} of the usual rate.` +
        (own.length ? ` Spikes that followed a case's own news, a hearing, talks or a ruling, held it at ${pct(wavg(own, "convX"))}.` : ""),
        "When a story breaks, put the evidence and the invest button at the top of the case page, and write to the new visitors a week later, once the story has settled.", "news");
    }

    /* watched, not backed */
    const gap = !one && busy.filter(x => x.totals.conversion < .6*P.conversion && x.totals.visitors >= median(busy.map(y => y.totals.visitors)))
      .sort((p, q) => q.totals.visitors - p.totals.visitors)[0];
    if(gap){
      const weak = keyRows.filter(r => r.vals[gap.id] != null).map(r => [r, place(r, gap.id)]).filter(([, p]) => p.pos > p.n*2/3);
      push(90, "warn", gap.id, "Watched, not backed",
        `${gap.title} drew ${pct(ratio(gap.totals.visitors, P.visitors))} of the platform's visitors and held them ${gap.minPerVisitor.toFixed(1)} minutes each, yet ${pct(gap.totals.conversion)} invested, against ${pct(P.conversion)} across the platform.` +
        (weak.length ? ` It is ${places(weak.slice(0, 3), gap.id)}: the things that go with investing.` : ""),
        weak.length && LEVER[weak[0][0].key] || "Look at the invest step itself: the amounts, the lock-in wording and the odds shown beside them.", "gap");
    }

    /* the cases' own news, moving money */
    const recent = sp.filter(s => s.to >= b - 13 && s.cause.type === "event" && !["news", "issue"].includes(s.cause.kind));
    const up = cs.filter(x => x.trend === "accelerating" && x.momentum != null && x.velocity7 >= .005*x.goal && (!one || x === one))
      .map(x => [x, recent.filter(s => s.caseId === x.id).sort((p, q) => q.extraMoney - p.extraMoney)[0]]).filter(([, s]) => s)
      .sort((p, q) => q[1].extraMoney - p[1].extraMoney).slice(0, 3);
    if(up.length && !(one && sp[0] && up[0][1] === sp[0])){
      const held = wavg(up.map(([, s]) => s), "convX");
      push(one ? 84 : 86, "good", up.length === 1 ? up[0][0].id : null, up.length === 1 ? `Gaining on ${headOf(up[0][1].cause.label).toLowerCase()}` : "Gaining on their own news",
        up.map(([x, s], i) => (i ? `${x.title}, ${money(x.velocity7)} (${times(x.momentum)})` : `${one ? "It" : x.title} raised ${money(x.velocity7)} in the last 7 days, ${times(x.momentum)} its usual week`) +
          `, after ${what(s.cause.label)} on ${day(s.cause.at)}`).join("; ") +
        `. Those visitors invested at ${pct(held)} of the usual rate: progress on the case itself converts.`,
        `Send the update to the case's backers and to backers of the issues they also back, while it is fresh.`, "up");
    }

    /* gone quiet: was raising in the month before, and has slowed or stopped */
    const quiet = cs.filter(x => (x.trend === "stalled" || x.trend === "slowing") && x.velocityPrev > 0 && x.fundedPct < 1 && (!one || x === one))
      .sort((p, q) => q.daysLive - p.daysLive)[0];
    if(quiet){
      const ev = model.cases.find(y => y.id === quiet.id).events.filter(e => e.i <= b).pop();
      const low = model.hasBuzz && cs.every(y => y === quiet || y.buzzPerDay >= quiet.buzzPerDay);
      if(one && ev) lead.quiet = `nothing has moved it since ${day(ev.i)}, ${b - ev.i} days ago`;
      push(80, "warn", quiet.id, "Gone quiet",
        `${one ? "It" : quiet.title} raised ${money(quiet.velocity7)} in the last 7 days and is ${pct(quiet.fundedPct)} funded after ${quiet.daysLive} days.` +
        (ev ? ` The last thing that moved it was on ${day(ev.i)}, ${b - ev.i} days ago, when ${what(ev.label)}.` : "") +
        (model.hasBuzz ? ` ${low ? "Its buzz is the lowest on the platform, " : "Its buzz is "}${int(quiet.buzzPerDay)} mentions a day.` : ""),
        `Give people a reason to look again: a case update, a clip from the people in it, or a press push. When visitors do come, ${pct(quiet.totals.conversion)} of them invest.`, "quiet");
    }

    /* issues: attention against money */
    if(!one && is.length > 1){
      const gapOf = i => i.attentionShare - i.moneyShare;
      const over = [...is].filter(i => i.attentionShare >= .08).sort((p, q) => gapOf(q) - gapOf(p))[0];
      const under = [...is].sort((p, q) => gapOf(p) - gapOf(q))[0];
      if(over && under && over !== under && gapOf(over) >= .08){
        const top = pos[0], avg = i => { const v = i.cases.map(id => top && top.vals[id]).filter(v => v != null); return v.length ? v.reduce((s, y) => s + y, 0)/v.length : null; };
        const a = top && avg(over), z = top && avg(under);
        push(88, "info", over.cases.length === 1 ? over.cases[0] : null, `${over.label} gets the attention, ${under.label} the money`,
          `${over.label} drew ${pct(over.attentionShare)} of the time people spent on the platform and ${pct(over.moneyShare)} of the money; ${under.label}, ${pct(under.attentionShare)} and ${pct(under.moneyShare)}.` +
          (a != null && z != null ? ` ${over.label}'s ${over.cases.length > 1 ? "cases average" : "case has"} ${fval(top.key, a)} on ${NOUN[top.key]}, against ${fval(top.key, z)} for ${under.label}.` : ""),
          top ? `The issue alone doesn't decide it: give ${over.label} cases what converts elsewhere, ${NOUN[top.key]} up front, rather than more footage.` : "", "issues");
      }
    }

    /* who backs what */
    if(!one && bk && bk.issues.length > 1){
      let best = null; const lone = [];
      for(const p of bk.issues){ let mx = 0;
        for(const q of bk.issues){ const s = bk.share(p.key, q.key); if(s == null) continue; mx = Math.max(mx, s);
          if(p.backers >= 20 && (!best || s > best.s)) best = {p, q, s}; }
        lone.push([p, mx]); }
      const alone = lone.filter(([p]) => p.backers >= 20).sort((p, q) => p[1] - q[1])[0];
      if(best && best.s >= .1) push(76, "info", null, `${pct(best.s)} of ${best.p.label} backers also back ${best.q.label}`,
        `${pct(bk.repeatShare)} of backers have backed more than one case, and they keep to a kind: ${best.p.label} backers turn to ${best.q.label} more than to anything else.` +
        (alone && alone[0] !== best.p && alone[1] < .1 ? ` ${alone[0].label} backers rarely back anything else (${pct(alone[1])} at most): they came for one case.` : ""),
        `Tell ${best.p.label} backers first when ${an(best.q.label)} case launches, and show "backers of this case also back" on the case page.`, "backers");
    }

    /* what the discussion says */
    if(talk && talk.n >= 6){
      const sk = talk.stance.skeptical, skOR = talk.count(c => c.stance === "skeptical", ["odds", "returns"]);
      const odds = talk.count(() => true, ["odds"]), oddsB = talk.count(c => c.backer, ["odds"]);
      const ev = talk.count(c => c.backer, ["evidence"]), pe = talk.count(c => c.backer, ["people"]), open = talk.unanswered;
      const q = open[0] && (open[0].text.length > 90 ? open[0].text.slice(0, 88).replace(/\s+\S*$/, "") + "…" : open[0].text);
      if((sk >= 2 && skOR/sk >= .5) || open.length) push(one ? 78 : 84, "info", one ? one.id : null,
        sk >= 2 && skOR/sk >= .5 ? "Doubters ask about the odds; backers talk about the evidence" : "Questions waiting for an answer",
        (sk >= 2 ? `${skOR === sk ? (sk === 2 ? "Both" : `All ${sk}`) : `${skOR} of the ${sk}`} sceptical comments are about the odds or the return` +
          (odds && !oddsB ? `, and none of the ${odds} comments on the odds came from a backer` : "") + "." +
          (ev + pe >= 4 ? ` Backers write about the evidence (${ev}) and the people in the case (${pe}).` : "") : "") +
        (open.length ? ` ${open.length === 1 ? "One question has" : `${open.length} questions have`} no answer from counsel yet` +
          (one ? `: “${q}”${/[.?!…]$/.test(q) ? "" : "."}` : ".") : ""),
        "Answer the odds and the return on the case page itself, where doubters read, and reply to the open questions in the thread.", "talk");
    }

    /* the case on its own: where it stands, and its biggest spike */
    if(one){
      const rel = ratio(one.totals.conversion, P.conversion);
      const ranked = keyRows.filter(r => r.vals[one.id] != null).map(r => [r, place(r, one.id)]);
      const weak = ranked.filter(([, p]) => p.pos > p.n*2/3), strong = ranked.filter(([, p]) => p.pos <= Math.max(1, Math.floor(p.n/3)));
      const draw = crowd.filter(r => r.vals[one.id] != null).map(r => [r, place({...r, cells: {rate: {rho: 1}}}, one.id)]).filter(([, p]) => p.pos <= 2);
      lead.stand = (rel < .8 ? `few of its visitors invest, ${pct(one.totals.conversion)} against ${pct(P.conversion)} across the platform` +
          (weak.length ? `, and it is ${weak.slice(0, 3).every(([, p]) => p.pos === p.n) ? "last" : "near the bottom"} on ${list(weak.slice(0, 3).map(([r]) => NOUN[r.key]))}` : "")
        : rel > 1.2 ? `its visitors invest at ${times(rel)} the platform's rate` + (strong.length ? `, and it leads on ${list(strong.slice(0, 2).map(([r]) => NOUN[r.key]))}` : "")
        : `its visitors invest at about the platform's rate, ${pct(one.totals.conversion)}`);
      if(ranked.length) push(100, rel < .8 ? "warn" : rel > 1.2 ? "good" : "info", one.id,
        rel < .8 ? "Why few of its visitors invest" : rel > 1.2 ? "Why its visitors invest" : "Where it stands",
        `It turns ${pct(one.totals.conversion)} of visitors into investors, against ${pct(P.conversion)} across the platform.` +
        (weak.length ? ` On the things that go with investing it is ${places(weak.slice(0, 3), one.id)}.` : "") +
        (strong.length ? ` It is ${places(strong.slice(0, 3), one.id)}.` : "") +
        (!weak.length && !strong.length && ranked.length ? ` It is ${places(ranked.slice(0, 2), one.id)}: the middle of the field on the things that go with investing, and its rate sits there too.` : "") +
        (draw.length ? ` Its ${list(draw.map(([r]) => NOUN[r.key]))} ${draw.length > 1 ? "bring" : "brings"} people in, but across the platform ${draw.length > 1 ? "they don't" : "that doesn't"} make them invest.` : ""),
        weak.length ? LEVER[weak[0][0].key] : strong.length ? `Keep ${list(strong.slice(0, 2).map(([r]) => NOUN[r.key]))} at the top of the page and in the first clip: ${strong.length > 1 ? "they are" : "it is"} why people back it.`
          : ranked.length ? LEVER[[...ranked].sort((p, q) => q[1].pos/q[1].n - p[1].pos/p[1].n)[0][0].key] || "" : "", "stand");
      const s = sp[0];
      if(s){
        const k = causeOf(s), newsy = k === "news" || k === "issue";
        lead.next = (newsy && s.convX != null ? `its biggest spike came from the news, and those visitors invested at ${pct(s.convX)} of the usual rate`
          : k && s.convX != null ? `its own news moves money: from ${day(s.from)} it drew ${times(s.visitsX)} the usual visitors, investing at ${pct(s.convX)} of the usual rate`
          : `its biggest spike, from ${day(s.from)}, brought ${times(s.visitsX)} the usual visitors`);
        push(92, newsy && s.convX < .8 ? "warn" : "good", one.id, newsy ? "Its biggest spike came from the news" : k ? "Its own news moves money" : "Its biggest spike",
          `From ${when(s)} visits ran ${times(s.visitsX)} the usual${s.moneyX != null ? ` and money ${times(s.moneyX)}` : ""}${s.buzzX != null ? `, with buzz at ${times(s.buzzX)}` : ""}. ` +
          (s.cause.type === "event" ? `It came when ${what(s.cause.label)} (${CAUSE[s.cause.kind] || "an event"})` : s.cause.type === "buzz" ? "News and social mentions jumped first"
            : s.cause.type === "source" ? `${SOURCE[s.source]} brought ${pct(s.sourceShare)} of the extra visitors${s.clip ? `, most through “${s.clip.title}”` : ""}` : "Nothing on record explains it") +
          (s.convX != null ? `, and those visitors invested at ${pct(s.convX)} of the usual rate.` : "."),
          newsy ? "Have the case page ready for the next story: the evidence and the invest button first, and a follow-up to new visitors a week on."
            : "Progress on the case is what moves money here: tell backers about every step, the day it happens.", "spike");
      }
      if(bk){
        const mine = one.c.cat in (model.cats || {}) ? one.c.cat : "other", near = bk.issues.filter(q => q.key !== mine)
          .map(q => [q, bk.share(mine, q.key)]).filter(([, s]) => s != null).sort((p, q) => q[1] - p[1])[0];
        const me = bk.issues.find(q => q.key === mine);
        if(near && me && near[1] >= .1) push(70, "info", one.id, `Its backers also back ${near[0].label}`,
          `${pct(near[1])} of ${me.label} backers have also backed ${an(near[0].label)} case, more than any other issue.`,
          `Show this case to ${near[0].label} backers, and put ${an(near[0].label)} case under "backers also back" on its page.`, "near");
        else if(near && me) push(70, "info", one.id, "Its backers back nothing else",
          `At most ${pct(near[1])} of ${me.label} backers have backed a case in another issue (${near[0].label} is the most): they came for this one.`,
          "When it closes, write to them about a case like it; they have shown they back one case at a time.", "near");
      }
    }

    /* one clip that pulls people through to the case */
    if(inp.clips){
      const clips = arr(inp.clips), by = new Map();
      for(const k of clips){ const g = by.get(k.caseId) || {p: 0, c: 0}; g.p += k.plays; g.c += k.toCase; by.set(k.caseId, g); }
      let best = null;
      for(const k of clips){
        const g = by.get(k.caseId), rp = g.p - k.plays, rest = ratio(g.c - k.toCase, rp);
        if(k.plays < 30 || k.plays < .05*g.p || rest <= 0) continue;
        const lift = k.toCaseRate/rest;
        if(lift >= 1.3 && (!best || lift > best.lift)) best = {k, lift, rest};
      }
      if(best){
        const k = best.k, name = k.key === "hero" ? `The 60-second clip${one ? "" : ` for ${k.caseTitle}`}` : `“${k.title}”${one ? "" : ` (${k.caseTitle})`}`;
        push(60, "info", k.caseId, "One clip pulls people through",
          `${name} sends ${pct(k.toCaseRate)} of its plays on to the case page, against ${pct(best.rest)} for the case's other clips.`,
          "Lead with it in the case's reel and in Watch, and make the next clip the same way.", "clip");
      }
    }

    /* close to the goal: get the next step ready */
    const near = cs.filter(x => x.fundedPct >= .8 && x.fundedPct < 1 && x.etaDays != null && x.etaDays <= 45 && (!one || x === one)).sort((p, q) => p.etaDays - q.etaDays)[0];
    if(near) push(50, "good", near.id, "Close to fully funded",
      `${one ? "It" : near.title} is ${Math.floor(near.fundedPct*100)}% funded and, at the last fortnight's pace, closes the remaining ${money(near.goal - near.raised)} in about ${near.etaDays} day${near.etaDays === 1 ? "" : "s"}.`,
      "Have the funded update for backers ready, and decide where its traffic goes next.", "near-goal");

    out.sort((p, q) => q.score - p.score);
    const per = new Map(), keys = new Set(), picked = [];
    for(const it of out){
      if(picked.length >= (one ? 6 : 9)) break;
      const k = it.caseId ?? "", c = per.get(k) || 0;
      if(keys.has(it.key) || (!one && it.caseId != null && c >= 2)) continue;
      per.set(k, c + 1); keys.add(it.key); picked.push(it);
    }
    const findings = picked.map(({score, key, ...it}) => it);

    /* the headline: the finding in a sentence or two */
    let headline = "";
    if(!one){
      const h = [];
      if(pos.length) h.push(`Investment followed ${list(pos.slice(0, 2).map(r => NOUN[r.key]))}` + (crowd.length ? `, not ${list(crowd.map(r => NOUN[r.key]), "or")}` : ""));
      if(news.length && nc < .8) h.push(`news brought the biggest crowds, and they invested at ${pct(nc)} of the usual rate`);
      if(up.length) h.push(up.length > 1 ? `${["", "", "two", "three"][up.length]} cases are gaining on their own news, and those visitors invest at the usual rate`
        : `${up[0][0].title} is gaining on its own news`);
      headline = h.slice(0, 3).map(cap).join(". ") + (h.length ? "." : "");
    } else { const h = [lead.stand, lead.quiet || lead.next].filter(Boolean); headline = h.map(cap).join(". ") + (h.length ? "." : ""); }
    return {headline, findings};
  }

  /* Contract, for admin/analytics.js:
     build({cases, listed?, now?, demo?, cats?, discussion?, real?, pledges?, comments?}) →
       {now, today, days, demo, hasBuzz, cats, realEvents, realPledges, realComments, recent,
        cases:[{id, c, title, color, listedIdx, f:{…standing}, events:[{i, kind, label}],
                m:{…12 daily arrays}, via:{…7 daily arrays},
                clips:[{key, title, kind, dur, m:{plays, viewers, watchSec, completes, toCase, toInvest}, retention}]}]}
     summarize(model, from, to), clipStats(model, caseId|null, from, to),
     sources(model, caseId|null, from, to), funnel(model, caseId|null, from, to),
     drivers(summary), spikes(model, caseId|null, from, to), issues(summary),
     backing(model, pledgeRows), discussion(comments),
     analyst(summary, {drivers, spikes, issues, backing, talk, clips, caseId?}).
     METRICS, SOURCES, FACTORS and THEMES are the key lists; dayNum and iso convert days. */
  const LJ_ANALYTICS = {build, summarize, clipStats, sources, funnel, drivers, spikes, issues, backing, discussion, analyst,
    METRICS: M, SOURCES: VIA, FACTORS, THEMES, dayNum, iso};
  if(typeof window !== "undefined") window.LJ_ANALYTICS = LJ_ANALYTICS;
  if(typeof module !== "undefined" && module.exports) module.exports = LJ_ANALYTICS;
})();
