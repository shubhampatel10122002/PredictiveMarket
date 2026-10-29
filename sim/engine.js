/* =====================================================================
   LaunchJustice Live — the engine
   ---------------------------------------------------------------------
   Arithmetic over the scenario and nothing else: no DOM, no clock, no
   storage. Give it a moment and it says what every case is worth, how much
   of each round has been raised, and what a set of trades comes to.
   sim.js owns the clock and the screens. The simulated investors on the
   leaderboard run through exactly the same functions as the person
   playing, which is what makes the comparison fair.

   A stake's price is what it is expected to pay, moved by the crowd:

     price = (win × winMult + settle × settleMult) × (1 + mood) × (1 + noise)

   The first part is the model's value at the current odds, and it eases
   to new odds over a few seconds rather than jumping. Mood is how the
   crowd took the latest news: it arrives with an event and fades with a
   45-second half-life, so a stake can run hot after a headline and drift
   back towards the model. Noise is a small, smooth wobble that is the same
   on every run, so the line moves like a market between events. When a
   case ends, the price is simply what it pays.
   ===================================================================== */

const SimEngine = (() => {
  const EASE = 4;     /* seconds new odds take to work into the price */
  const HALF = 45;    /* half-life of a mood, in seconds */
  const RAMP = 2.5;   /* seconds a mood takes to arrive */
  const FADE = 120;   /* half-life of the crowd an event draws in */

  const clamp01 = k => Math.max(0, Math.min(1, k));
  const easeOut = k => 1 - Math.pow(1 - clamp01(k), 3);
  const decay = (dt, half=HALF) => Math.pow(0.5, dt / half);

  /* The scenario in the shape the engine reads: each case holding its own
     events in time order, every event holding a clip. Majors take the
     placeholder clips in turn so two big moments in a row never share one;
     minors take them in turn from the other end. */
  function compile(scn){
    const ids = scn.cases.map(c => c.id), cases = {};
    scn.cases.forEach((c, k) => {
      cases[c.id] = {...c, events: [], k,
        phase: [...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7) / 97};
    });
    const events = scn.events.map((e, i) => ({...e, id: e.id || "ev" + i})).sort((a, b) => a.t - b.t);
    let maj = 0, min = 0;
    events.forEach(e => {
      if(!cases[e.c]) throw new Error("Event " + e.id + " names a case that does not exist: " + e.c);
      if(!e.embed) e.embed = scn.clips[e.major ? maj++ % scn.clips.length : scn.clips.length - 1 - min++ % scn.clips.length];
      cases[e.c].events.push(e);
    });
    ids.forEach(id => {
      const c = cases[id];
      c.end = c.events.find(e => e.end) || null;
      c.crowdFundedAt = fundedAt(c, 0);
    });
    return {scn, cases, ids, events, length: scn.length};
  }

  /* ---------------------------------------------------------------------
     Funding
     --------------------------------------------------------------------- */
  /* the share of the target the crowd has put in by t */
  function crowdShare(c, t){
    const r = c.raise;
    if(t <= r[0][0]) return r[0][1];
    for(let i = 1; i < r.length; i++){
      const [t0, f0] = r[i-1], [t1, f1] = r[i];
      if(t <= t1) return f0 + (f1 - f0) * (t - t0) / ((t1 - t0) || 1);
    }
    return r[r.length - 1][1];
  }
  const crowdRaised = (c, t) => c.target * crowdShare(c, t);

  /* When a round fills, given `extra` credits already in from outside the
     crowd: the first moment the crowd plus the extra reaches the target.
     Infinity if it never does. */
  function fundedAt(c, extra){
    const need = 1 - (extra || 0) / c.target, r = c.raise;
    if(need <= r[0][1] + 1e-9) return r[0][0];
    for(let i = 1; i < r.length; i++){
      const [t0, f0] = r[i-1], [t1, f1] = r[i];
      if(f1 >= need - 1e-9) return f1 > f0 ? t0 + (need - f0) / (f1 - f0) * (t1 - t0) : t1;
    }
    return Infinity;
  }
  /* when every round closes if nobody but the crowd invests */
  const crowdOpens = m => Object.fromEntries(m.ids.map(id => [id, m.cases[id].crowdFundedAt]));

  /* ---------------------------------------------------------------------
     Value
     --------------------------------------------------------------------- */
  const evOf = (c, o) => o.win * c.winMult + o.settle * c.settleMult;
  const payoutOf = c => !c.end ? null : c.end.end === "win" ? c.winMult : c.end.end === "settle" ? c.settleMult : 0;

  /* The odds in force at t, the value they imply, and the value the price
     is actually carrying while it eases from the old odds to the new.
     The market opens at 1 (what the round paid) and eases to the opening
     odds from there. Odds set before the market opens just become the
     opening odds. */
  function valueAt(c, t, open){
    let odds = c.odds, from = 1, to = evOf(c, c.odds), at = open;
    for(const e of c.events){
      if(e.t > t) break;
      if(!e.odds) continue;
      if(!(e.t > open)){ odds = e.odds; to = evOf(c, odds); continue; }
      from = from + (to - from) * easeOut((e.t - at) / EASE);
      odds = e.odds; to = evOf(c, odds); at = e.t;
    }
    return {odds, ev: to, model: from + (to - from) * easeOut((t - at) / EASE)};
  }

  function moodAt(c, t, open){
    let s = (c.launchMood || 0) * decay(t - open) * easeOut((t - open) / RAMP);
    for(const e of c.events){
      if(e.t > t) break;
      if(e.mood && e.t >= open) s += e.mood * decay(t - e.t) * easeOut((t - e.t) / RAMP);
    }
    return s;
  }

  /* a small smooth wobble, fixed per case, louder while the crowd is worked up */
  function noiseAt(c, t, mood){
    const p = c.phase;
    return (c.vol || .01) * (1 + 2 * Math.abs(mood)) *
      (.55 * Math.sin(t * .83 + p) + .30 * Math.sin(t * 2.17 + p * 1.7) + .15 * Math.sin(t * 5.3 + p * 2.3));
  }

  /* What one credit put into the round is worth at t, given when the round
     closed: 1 while it raises, the market while it runs, the payout once
     it is over. */
  function priceAt(m, id, t, open){
    const c = m.cases[id];
    if(open == null || !(t >= open)) return 1;
    if(c.end && t >= c.end.t) return payoutOf(c);
    const v = valueAt(c, t, open), mood = moodAt(c, t, open);
    return Math.max(.02, v.model * (1 + mood) * (1 + noiseAt(c, t, mood)));
  }
  /* selling early: to someone on the waitlist, at a discount */
  const bidAt = (m, id, t, open) => priceAt(m, id, t, open) * (1 - m.scn.exitDiscount);

  /* Everything the screens show about one case at one moment. */
  function caseAt(m, id, t, open){
    const c = m.cases[id];
    let stage = 0, last = null, lastMajor = null;
    const impacts = [];
    for(const e of c.events){
      if(e.t > t) break;
      if(e.stage != null) stage = e.stage;
      last = e;
      if(e.major) lastMajor = e;
      if(e.impact) impacts.push(e);
    }
    const ended = !!(c.end && t >= c.end.t);
    const live = !ended && open != null && t >= open;
    const status = ended ? {win:"won", settle:"settled", lose:"lost"}[c.end.end] : live ? "live" : "raising";
    if(live && stage === 0) stage = 1;
    const v = valueAt(c, t, live ? open : Infinity);
    const mood = live ? moodAt(c, t, open) : 0;
    return {c, id, status, live, ended, stage, odds: v.odds, ev: v.ev, mood,
            chance: ended ? (c.end.end === "lose" ? 0 : 100) : Math.round((v.odds.win + v.odds.settle) * 100),
            price: priceAt(m, id, t, open), payout: ended ? payoutOf(c) : null,
            last, lastMajor, impacts};
  }

  /* What one event did: the chance to win and the price, just before it
     and once it has worked through. */
  function effectOf(m, e, open){
    const c = m.cases[e.c];
    const before = e.t - .01, after = c.end && c.end.t >= e.t && c.end.t <= e.t + EASE + 1 ? c.end.t : e.t + EASE + 1;
    const a = caseAt(m, e.c, before, open), b = caseAt(m, e.c, after, open);
    return {chance: [a.chance, b.chance], price: [a.price, b.price], live: a.live || b.live};
  }

  /* The people around a case, for the numbers that make it feel inhabited.
     Backers follow the money; watchers, the waitlist and the sellers follow
     the news and fade after it. */
  function crowdAt(m, id, t, open, raised){
    const c = m.cases[id], s = caseAt(m, id, t, open);
    let watching = (c.crowd && c.crowd.watching) || 1000, waitlist = 0, sellers = 0, joined = 0;
    for(const e of c.events){
      if(e.t > t) break;
      const k = e.crowd || {}, f = decay(t - e.t, FADE);
      watching += (k.watching || 0) * f;
      waitlist += (k.waitlist || 0) * f;
      sellers += (k.sellers || 0) * f;
      joined += (k.waitlist || 0) * .3;
    }
    if(s.live){
      waitlist += Math.max(0, s.mood) * 900;
      sellers += Math.max(0, -s.mood) * 700;
    }
    const wobble = 1 + .03 * Math.sin(t * .7 + c.phase);
    return {
      backers: Math.round((s.status === "raising" ? raised : c.target) / c.ticket + (s.status === "raising" ? 0 : joined)),
      watching: Math.round(watching * (1 + Math.abs(s.mood)) * wobble),
      waitlist: s.ended ? 0 : Math.round(waitlist),
      sellers: s.ended ? 0 : Math.round(sellers)
    };
  }

  /* ---------------------------------------------------------------------
     Books: what an investor holds. A stake is counted in units, one unit
     being one credit's worth of the round, so buying from an exiting
     backer at 1.40 gets 1/1.40 of a unit per credit. Credits move in
     whole numbers; units do not have to.
     --------------------------------------------------------------------- */
  /* invested and returned are lifetime totals; basis is what the units
     still held cost, which is what a sale is measured against */
  const book = credits => ({cash: credits, pos: {}, txns: []});
  const stake = (b, id) => b.pos[id] || (b.pos[id] = {units: 0, invested: 0, returned: 0, basis: 0});

  /* kind is "round" (at 1, while the round is open) or "buy" (from an
     exiting backer, at the market) */
  function buy(b, id, credits, price, t, kind){
    credits = Math.floor(Math.min(credits, b.cash));
    if(!(credits > 0) || !(price > 0)) return null;
    const s = stake(b, id), units = credits / price;
    s.units += units; s.invested += credits; s.basis += credits; b.cash -= credits;
    const tx = {t, c: id, kind, credits, price, units};
    b.txns.push(tx);
    return tx;
  }
  function sell(b, id, share, price, t){
    const s = b.pos[id];
    if(!s || !(s.units > 0)) return null;
    const k = clamp01(share), units = s.units * k, credits = Math.round(units * price), basis = s.basis * k;
    s.units -= units; s.basis -= basis;
    if(s.units < 1e-6){ s.units = 0; s.basis = 0; }
    s.returned += credits; b.cash += credits;
    const tx = {t, c: id, kind: "sell", credits, price, units, basis};
    b.txns.push(tx);
    return tx;
  }
  /* the case is over: every unit pays the multiple, which may be nothing */
  function payout(b, id, mult, t){
    const s = b.pos[id];
    if(!s || !(s.units > 0)) return null;
    const units = s.units, credits = Math.round(units * mult);
    s.units = 0; s.basis = 0; s.returned += credits; b.cash += credits;
    const tx = {t, c: id, kind: "payout", credits, price: mult, units};
    b.txns.push(tx);
    return tx;
  }
  /* cash plus every open stake at its price */
  function worth(m, b, t, opens){
    return b.cash + m.ids.reduce((s, id) =>
      s + (b.pos[id] && b.pos[id].units ? b.pos[id].units * priceAt(m, id, t, opens[id]) : 0), 0);
  }

  /* ---------------------------------------------------------------------
     Plans: a list of moves played out against the script. The leaderboard's
     investors are plans, and so is every member of the crowd the final
     score is ranked against. A plan invests alongside the crowd, so it
     never moves when a round closes.
     --------------------------------------------------------------------- */
  function runPlan(m, moves, upto=Infinity){
    const b = book(m.scn.credits), opens = crowdOpens(m);
    const steps = moves.map(mv => ({t: mv[0], mv}))
      .concat(m.ids.map(id => m.cases[id].end).filter(Boolean).map(e => ({t: e.t, end: e})))
      .filter(s => s.t <= upto)
      .sort((a, b) => a.t - b.t || (a.end ? 1 : 0) - (b.end ? 1 : 0));
    for(const s of steps){
      if(s.end){ payout(b, s.end.c, payoutOf(m.cases[s.end.c]), s.t); continue; }
      const [t, id, act, amt] = s.mv, c = m.cases[id], open = opens[id];
      if(c.end && t >= c.end.t) continue;
      if(act === "in"){
        const credits = amt === "all" ? b.cash : amt === "half" ? Math.floor(b.cash / 2) : amt;
        const raising = t < open;
        buy(b, id, credits, raising ? 1 : priceAt(m, id, t, open), t, raising ? "round" : "buy");
      } else if(act === "out") sell(b, id, amt, bidAt(m, id, t, open), t);
    }
    return {b, value: worth(m, b, Math.min(upto, m.length), opens)};
  }

  /* mulberry32: a small seeded generator, so the crowd is the same crowd
     on every run and only the person playing changes */
  function rng(seed){
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* A crowd of ordinary investors: some spread out, some go all in, some
     keep cash back; afterwards some react to the big moments, selling on
     bad news or buying it, chasing good news or taking profit. None of them
     know how a case ends. Returns every final total, sorted. */
  function crowdFinals(m, n=2000, seed=20261028){
    const r = rng(seed), ids = m.ids, out = [];
    const news = m.events.filter(e => e.major && e.mood && !(m.cases[e.c].end && e.t >= m.cases[e.c].end.t));
    for(let i = 0; i < n; i++){
      const t0 = Math.round(r() * 70), budget = Math.round(m.scn.credits * (.3 + .7 * r()));
      const w = ids.map(() => -Math.log(1 - r() * .999));
      if(r() < .3) w[Math.floor(r() * ids.length)] = 0;
      const sum = w.reduce((a, b) => a + b, 0) || 1, moves = [];
      ids.forEach((id, k) => { const amt = Math.floor(budget * w[k] / sum); if(amt > 0) moves.push([t0, id, "in", amt]); });
      for(let h = Math.floor(r() * 3); h > 0; h--){
        const e = news[Math.floor(r() * news.length)], t = e.t + 2 + r() * 10, x = r();
        if(e.mood < 0) moves.push(x < .55 ? [t, e.c, "out", r() < .5 ? 1 : .5] : [t, e.c, "in", "half"]);
        else moves.push(x < .6 ? [t, e.c, "in", "half"] : [t, e.c, "out", .5]);
      }
      moves.sort((a, b) => a[0] - b[0]);
      out.push(Math.round(runPlan(m, moves).value));
    }
    return out.sort((a, b) => a - b);
  }
  /* the share of a sorted list strictly below x, ties counted half */
  function rankIn(sorted, x){
    let below = 0, same = 0;
    for(const v of sorted){ if(v < x) below++; else if(v === x) same++; else break; }
    return (below + same / 2) / (sorted.length || 1);
  }

  /* Every trade in a book, judged by what actually became of it. A sale
     takes the same share of every unit held, so each buy collects its share
     of whatever was sold, plus what its remaining units paid at the end
     (or are worth today, if the case is still open). A sale is judged
     against holding on instead. */
  function judge(m, b, t, opens){
    const out = [], held = {};
    for(const x of [...b.txns].sort((a, c) => a.t - c.t)){
      if(x.kind === "payout") continue;
      const lots = held[x.c] || (held[x.c] = []);
      if(x.kind === "sell"){
        const total = lots.reduce((s, y) => s + y.held, 0) || 1;
        lots.forEach(y => {
          const k = y.held / total;
          y.realized += x.credits * k; y.sold += x.units * k; y.held = Math.max(0, y.held - x.units * k);
        });
        out.push({...x});
      } else {
        const y = {...x, held: x.units, realized: 0, sold: 0};
        lots.push(y); out.push(y);
      }
    }
    out.forEach(y => {
      const c = m.cases[y.c];
      y.ended = !!(c.end && t >= c.end.t);
      y.final = y.ended ? payoutOf(c) : priceAt(m, y.c, t, opens[y.c]);
      if(y.kind === "sell") y.gain = y.credits - y.units * y.final;
      else {
        y.realized += y.held * y.final;
        y.soldShare = y.sold / y.units;
        y.gain = y.realized - y.credits;
      }
    });
    return out;
  }

  /* the calendar: four years onto ten minutes */
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function dateAt(m, t){
    const cal = m.scn.calendar;
    const k = Math.min(cal.months - 1, Math.max(0, Math.floor(t / m.length * cal.months))) + cal.month;
    return {label: MONTHS[k % 12] + " " + (cal.year + Math.floor(k / 12)), year: Math.floor((k - cal.month) / 12) + 1,
            month: MONTHS[k % 12], y: cal.year + Math.floor(k / 12)};
  }

  return {compile, crowdShare, crowdRaised, fundedAt, crowdOpens, evOf, payoutOf, valueAt, moodAt,
          priceAt, bidAt, caseAt, effectOf, crowdAt, book, stake, buy, sell, payout, worth,
          runPlan, crowdFinals, rankIn, judge, dateAt, EASE};
})();

if(typeof module !== "undefined") module.exports = SimEngine;
