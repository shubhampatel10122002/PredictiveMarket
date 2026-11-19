/* =====================================================================
   LaunchJustice Live
   ---------------------------------------------------------------------
   scenario.js  what happens, and when
   engine.js    what everything is worth at any moment
   sim.js       this file: the clock, the screens, and the person playing

   One investor, no account. What they do lives in this browser, so a
   refresh carries on where it left off, paused. Nothing is written to the
   database and nothing is tracked: the simulation never touches the live
   platform's data.

   URL flags, for whoever is presenting:
     ?reset        start again from nothing
     ?speed=2      start at a speed (0.5, 1, 2 or 4; anything up to 60 works,
                   which is for testing)
     ?jump=300     start paused at that second, everything before it
                   already played out
     ?autoplay     start the clock as the page opens
     ?noclips      show the clips' stills but never load a player
     #case=<id>    open on a case
   ===================================================================== */

const M = SimEngine.compile(SCENARIO);
const IDS = M.ids, LEN = M.length, CASE = M.cases, EVENTS = M.events;
const START = SCENARIO.credits;
const SPEEDS = [.5, 1, 2, 4];

/* ============ helpers ============ */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const MINUS = "−";
const cr = n => num(n) + " cr";
const crK = n => n >= 1e4 ? Math.round(n / 1e3) + "k" : num(n);
const mult = p => (p >= 10 ? p.toFixed(1) : p.toFixed(2)) + "×";
const signed = (n, f=num) => (Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? MINUS : "") + f(Math.abs(n));
const pctS = x => signed(x * 100, v => Math.round(v)) + "%";
const signOf = v => v > .004 ? "up" : v < -.004 ? "down" : "flat";
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const speedLabel = s => (s === .5 ? "½" : String(s)) + "×";
const dateOf = t => SimEngine.dateAt(M, t).label;
const ccol = id => `var(--c-${id})`;
const short = id => CASE[id].short;
const flags = new URLSearchParams(location.search);
const NOCLIPS = flags.has("noclips");

const toastEl = $("#toast"), srLive = $("#srLive");
let toastT;
function toast(m, ms=3400){
  toastEl.innerHTML = m; toastEl.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), ms);
}
const say = text => { if(srLive) srLive.textContent = text; };

const svg = (d, w=2) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const fill = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${d}</svg>`;
const I = {
  play: fill('<path d="M8 5.5v13l10.5-6.5z"/>'),
  pause: fill('<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>'),
  replay: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>', 2.2),
  next: svg('<path d="M6 6l7 6-7 6zM17 6v12"/>', 2.2),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>', 1.8),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 2.4),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 2.4),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 2.6),
  down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 2.6),
  share: svg('<path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  cross: svg('<path d="M7 7l10 10M17 7L7 17"/>', 2.6),
  spark: fill('<path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/>'),
  flame: fill('<path d="M13.5 2c.5 3-1.2 4.4-2.6 5.7C9.2 9.2 7.5 10.7 7.5 14a5.5 5.5 0 0 0 11 0c0-2.4-1-3.7-1.9-4.8-.3 1-.9 1.7-1.7 2 .4-2.6-.6-6.6-1.4-9.2z"/>'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
  muted: svg('<path d="M11 5L6.5 9H3v6h3.5L11 19z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'),
  sound: svg('<path d="M11 5L6.5 9H3v6h3.5L11 19z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.8 7a7 7 0 0 1 0 10"/>'),
  playSm: fill('<path d="M8 5v14l11-7z"/>'),
  people: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.6a3.2 3.2 0 0 1 0 6.3M18 14.3c1.8.8 3 2.6 3 4.7"/>'),
  key: svg('<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>')
};

/* Photographs and stills sit on generated artwork and remove themselves if
   they will not load, exactly as on the site. */
document.addEventListener("error", e => { const t = e.target; if(t.tagName === "IMG" && t.classList.contains("fb")) t.remove(); }, true);
document.addEventListener("load", e => { const t = e.target; if(t.tagName === "IMG" && t.classList.contains("fb")) t.classList.add("on"); }, true);

/* ============ artwork ============
   Each case is drawn rather than photographed: the site's generated colour
   field with a line drawing of what the case is about on top. It needs no
   network and can never show the wrong photograph. */
const MOTIFS = {
  plant: `<path class="m-s" d="M18 206H382"/>
    <path class="m-s" d="M34 206v-24l13-11 13 11v24M70 206v-20l11-9 11 9v20M100 206v-26l14-12 14 12v26"/>
    <path class="m-s" d="M148 206v-32h52v32M168 206v-13h12v13M190 174v-20"/><path class="m-hi" d="M190 154h12l-3 4 3 4h-12"/>
    <path class="m-dash" d="M206 196h72"/><path class="m-s" d="M206 191v10M278 191v10"/>
    <path class="m-s" d="M282 206v-38h38v38M320 206v-26h58v26M332 180v-62h9v62M354 180v-48h9v48"/>
    <path class="m-f" d="M282 206v-38h38v38z"/>
    <ellipse class="m-smoke" cx="326" cy="104" rx="40" ry="15"/>
    <ellipse class="m-smoke b" cx="282" cy="90" rx="58" ry="19"/>
    <ellipse class="m-smoke" cx="214" cy="82" rx="64" ry="17"/>`,
  /* a lung test's flow curve: the dashed line is a healthy child's, the
     fainter one the race-adjusted 'normal', and the solid one a struggling
     child who still passes against it */
  lungs: `<path class="m-s" d="M64 84v126h288"/>
    <path class="m-f" d="M86 92C126 108 236 164 336 210H300C210 176 130 126 84 116z"/>
    <path class="m-dash" d="M64 210L86 92C126 108 236 164 336 210"/>
    <path class="m-dash" d="M64 210L84 116C130 126 210 176 300 210" style="opacity:.4"/>
    <path class="m-hi" d="M64 210L81 124C98 168 150 196 288 210"/>
    <circle class="m-dot on" cx="81" cy="124" r="3.5"/>`,
  /* a field of patient records, one cluster of them in the crosshairs */
  data: (() => {
    let d = "";
    for(let r = 0; r < 8; r++) for(let k = 0; k < 18; k++){
      const x = 32 + k * 20, y = 80 + r * 18, dx = x - 272, dy = y - 142;
      const on = dx * dx + dy * dy < 46 * 46 && (k * 7 + r * 3) % 4 !== 0;
      d += `<circle class="m-dot${on ? " on" : ""}" cx="${x}" cy="${y}" r="${on ? 3.4 : 2.6}"/>`;
    }
    return d + `<circle class="m-s" cx="272" cy="142" r="30"/><circle class="m-s" cx="272" cy="142" r="56" style="opacity:.35"/>
      <path class="m-s" d="M272 78v28M272 178v28M208 142h28M308 142h28"/><circle class="m-ring" cx="272" cy="142" r="30"/>`;
  })()
};
const motif = (c, fit="xMidYMid slice") =>
  `<svg class="motif" viewBox="0 0 400 300" preserveAspectRatio="${fit}" aria-hidden="true">${MOTIFS[c.motif] || ""}</svg>`;
/* Each case's mark in lists, the way a brokerage shows a company's logo:
   one line icon in the case's colour, on a tint of it */
const LOGO = {
  plant: svg('<path d="M3 20h18"/><path d="M4.5 20v-8l4.5 3v-3l4.5 3V7.5"/><path d="M13.5 20V7.5H16V4h2.5v3.5H20V20"/>', 1.8),
  lungs: svg('<path d="M12 4v8.5M12 12.5l-2.4 1.8M12 12.5l2.4 1.8"/><path d="M9.6 8.2C6.8 7.6 4 10.4 4 15.4c0 2.5 1 4.1 2.8 4.1 2 0 3.2-1.6 3.2-4V10"/><path d="M14.4 8.2c2.8-.6 5.6 2.2 5.6 7.2 0 2.5-1 4.1-2.8 4.1-2 0-3.2-1.6-3.2-4V10"/>', 1.8),
  data: svg('<path d="M12 3l7 3v5.4c0 4.4-2.9 8.1-7 9.6-4.1-1.5-7-5.2-7-9.6V6z"/><rect x="9" y="10.6" width="6" height="4.9" rx="1"/><path d="M10.3 10.6V9.2a1.7 1.7 0 0 1 3.4 0v1.4"/>', 1.8)
};
const logo = (c, cls="") => `<span class="logo ${cls}" style="--cat:${ccol(c.id)}" aria-hidden="true">${LOGO[c.motif] || ""}</span>`;

/* ============ state ============
   Everything the person has done, and where the clock is. The cases
   themselves are never stored: they are worked out from the script and the
   time, so the only things worth saving are the decisions. */
const KEY = "lj_sim_v1";
const blank = () => ({v:1, t:0, started:false, done:false, speed:1,
  book: SimEngine.book(START), primary:{}, open:{}, closedByMe:{}, fired:{}, paid:{}, shares:{}, reach:0,
  set:{pauseMoments:false, pauseClips:true}});
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));
    if(s && s.v === 1 && s.book) return {...blank(), ...s, set:{...blank().set, ...(s.set || {})}};
  }catch(e){}
  return blank();
}
let st = flags.has("reset") ? blank() : load();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} }
if(flags.has("reset")) save();
if(flags.has("speed")){ const s = parseFloat(flags.get("speed")); if(s > 0 && s <= 60) st.speed = s; }

/* The simulated investors on the leaderboard play their whole run once, up
   front. They never react to the person playing. */
const PERSONAS = SCENARIO.personas.map(p => ({...p, run: SimEngine.runPlan(M, p.moves)}));

/* ============ the moment, worked out ============ */
let snap = null;
function compute(){
  const t = st.t, out = {t, cases:{}};
  let inCases = 0;
  for(const id of IDS){
    const c = CASE[id], open = st.open[id];
    const s = SimEngine.caseAt(M, id, t, open);
    s.raised = s.status === "raising" ? Math.min(c.target, SimEngine.crowdRaised(c, t) + (st.primary[id] || 0)) : c.target;
    s.pct = s.raised / c.target;
    s.crowd = SimEngine.crowdAt(M, id, t, open, s.raised);
    s.stake = st.book.pos[id] || {units:0, invested:0, returned:0, basis:0};
    s.value = s.stake.units * s.price;
    s.pl = s.value + s.stake.returned - s.stake.invested;
    s.hold = s.stake.units > 1e-9;
    s.bid = SimEngine.bidAt(M, id, t, open);
    inCases += s.value;
    out.cases[id] = s;
  }
  out.cash = st.book.cash;
  out.inCases = inCases;
  out.total = out.cash + inCases;
  out.ret = (out.total - START) / START;
  out.paidOut = IDS.reduce((a, id) => a + (st.book.pos[id] ? st.book.pos[id].returned : 0), 0);
  return out;
}

/* ============ the clock ============
   `playing` is what the person asked for. A hold stops the clock without
   un-asking: a clip being watched full screen holds it, and letting go
   picks up where it was. */
let playing = false, lastNow = 0, dataAt = 0, lastSave = 0;
const holds = new Set();
const running = () => playing && !holds.size && !st.done;

function setPlaying(on){
  if(st.done && on){ go("end"); return; }
  playing = !!on;
  if(on && !st.started){ st.started = true; renderHome(); $("#v-home").scrollTop = 0; }
  save();
  renderBarState();
  tickClock();
}
function hold(reason, on){ on ? holds.add(reason) : holds.delete(reason); renderBarState(); tickClock(); }

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(.25, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  if(running()) advance(st.t + dt * st.speed);
  tickClock();
  if(now - dataAt > 240){ dataAt = now; tick(now); }
}

/* Everything due between now and `to`, in order: rounds filling first,
   then scripted events. Quiet is for catching up (a jump or a reload): the
   record fills in, but nothing slides in. */
function advance(to, quiet=false){
  to = Math.min(LEN, Math.max(st.t, to));
  for(let guard = 0; guard < 400; guard++){
    const n = nextDue(st.t, to);
    if(!n) break;
    st.t = n.t;
    if(n.kind === "fund") openRound(n.id, n.t, false, quiet);
    else fire(n.e, quiet);
  }
  st.t = to;
  if(st.t >= LEN && !st.done) finish(quiet);
}
function nextDue(from, to){
  let best = null;
  for(const id of IDS){
    if(st.open[id] != null) continue;
    const ft = Math.max(from, SimEngine.fundedAt(CASE[id], st.primary[id] || 0));
    if(ft <= to && (!best || ft < best.t)) best = {t: ft, kind: "fund", id};
  }
  const e = EVENTS.find(x => !st.fired[x.id]);
  if(e && e.t <= to && (!best || e.t < best.t)) best = {t: e.t, kind: "event", e};
  return best;
}
/* the next thing that will happen, for the skip button */
function upcoming(){
  const n = nextDue(st.t, LEN);
  return n ? {t: n.t, label: n.kind === "fund" ? `the ${short(n.id)} round fills` : `${short(n.e.c)}: ${n.e.title}`} : null;
}
function skip(){
  if(st.done) return;
  if(!st.started){ st.started = true; renderHome(); }
  const n = nextDue(st.t, LEN);
  advance(n ? n.t + .001 : LEN);
  save();
  tick(performance.now(), true);
}

function openRound(id, t, byMe, quiet){
  st.open[id] = t;
  if(byMe) st.closedByMe[id] = true;
  addFeed(feedFund(id, t, byMe), quiet);
  if(!quiet){
    flash(id);
    const p = SimEngine.caseAt(M, id, t + SimEngine.EASE, t).price;
    toast(byMe ? `${I.check}<span><b>You closed the ${esc(short(id))} round.</b> Trading opens.</span>`
               : `<span><b>${esc(short(id))} is funded.</b> Trading opens at ${mult(p)}.</span>`, 4400);
    say(`${short(id)} is fully funded.`);
  }
  save();
}

function fire(e, quiet){
  st.fired[e.id] = true;
  if(e.end) resolve(e, quiet);
  addFeed(feedEvent(e), quiet);
  if(!quiet){
    flash(e.c);
    if(e.major) showMoment(e, true);
  }
  save();
}

function resolve(e, quiet){
  const id = e.c;
  if(st.paid[id]) return;
  st.paid[id] = true;
  const tx = SimEngine.payout(st.book, id, SimEngine.payoutOf(CASE[id]), e.t);
  if(tx && !quiet) setTimeout(() => toast(tx.credits > 0
    ? `${I.check}<span><b>+${cr(tx.credits)}</b> paid out from ${esc(short(id))}.</span>`
    : `<span>${esc(short(id))} lost. Your position paid nothing.</span>`, 4400), 1200);
}

function finish(quiet){
  st.done = true; playing = false;
  save();
  renderBarState();
  if(!quiet){
    toast(`<span><b>Time's up.</b> Here are your results.</span>`, 3600);
    setTimeout(() => { hideMoment(); go("end"); }, 2400);
  }
}

function restart(){
  st = {...blank(), speed: st.speed, set: st.set};
  playing = false; holds.clear();
  hideMoment(); closePlayer(); closeSheet();
  save();
  rebuildFeed();
  snap = compute();
  renderBar(); renderHome(); renderWallet(true);
  go("home");
}

/* ============ trades ============ */
/* Into the round while it is open, at par. After that, from a backer who
   wants out, at the market. A round only takes what it still needs. */
function invest(id, credits){
  snap = compute();
  const c = CASE[id], s = snap.cases[id];
  if(s.ended || !(credits > 0)) return null;
  let tx;
  if(s.status === "raising"){
    tx = SimEngine.buy(st.book, id, Math.min(credits, Math.floor(c.target - s.raised)), 1, st.t, "round");
    if(!tx) return null;
    st.primary[id] = (st.primary[id] || 0) + tx.credits;
    if(SimEngine.crowdRaised(c, st.t) + st.primary[id] >= c.target - .5) openRound(id, st.t, true, false);
  } else {
    tx = SimEngine.buy(st.book, id, credits, s.price, st.t, "buy");
    if(!tx) return null;
  }
  after(tx);
  return tx;
}
function sell(id, share){
  snap = compute();
  const s = snap.cases[id];
  if(!s.live || !s.hold) return null;
  const tx = SimEngine.sell(st.book, id, share, s.bid, st.t);
  if(!tx) return null;
  after(tx);
  return tx;
}
function after(tx){
  flash(tx.c);
  save();
  tick(performance.now(), true);
}

/* Sharing copies a link and, this being a simulation, brings a few people
   with it. It moves the crowd, never the price. */
async function share(id){
  const c = CASE[id], s = snap.cases[id];
  const url = location.origin + location.pathname + "#case=" + id;
  try{ await navigator.clipboard.writeText(`${c.head} I'm following it on LaunchJustice Live: ${url}`); }catch(e){}
  if(s.ended){ toast("Link copied."); return; }
  const opened = 12 + Math.round(Math.random() * 30 * (1 + Math.max(0, s.mood) * 4));
  st.shares[id] = (st.shares[id] || 0) + 1;
  st.reach += opened;
  save();
  toast(`<span>Link copied. <b>${opened} people</b> opened it.</span>`);
}

/* ============ the news ============
   The headlines as they break, and each round as it fills: what moves a
   price, and nothing else. Trades live in the portfolio's activity list.
   On a reload it is rebuilt from the record. */
const feed = [];
let feedVer = 0, feedNew = 0;
function addFeed(it, quiet){
  feed.push(it);
  feed.sort((a, b) => b.t - a.t);
  if(feed.length > 160) feed.length = 160;
  feedVer++;
  if(!quiet) feedNew++;
}
const metaRow = (id, t, extra="") => `<div class="fd-meta" style="--cat:${ccol(id)}"><span class="dot"></span><b>${esc(short(id))}</b><span>${dateOf(t)}</span>${extra}</div>`;
/* what an event did to its case, as two small chips */
function fxChips(e){
  if(e.end){
    const m = SimEngine.payoutOf(CASE[e.c]);
    return `<div class="fxs"><span class="fx ${m > 0 ? "up" : "down"}">${m > 0 ? I.check : I.cross}${m > 0 ? `Pays ${mult(m)}` : "Pays nothing"}</span></div>`;
  }
  const f = SimEngine.effectOf(M, e, st.open[e.c]);
  if(!f.live) return "";
  const out = [], dc = f.chance[1] - f.chance[0], dp = f.price[1] / f.price[0] - 1;
  if(Math.abs(dp) >= .01) out.push(`<span class="fx ${dp > 0 ? "up" : "down"}">${dp > 0 ? I.up : I.down}Price ${mult(f.price[0])} → ${mult(f.price[1])}</span>`);
  if(dc) out.push(`<span class="fx ${dc > 0 ? "up" : "down"}">${dc > 0 ? I.up : I.down}Win chance ${f.chance[0]} → ${f.chance[1]}%</span>`);
  return out.length ? `<div class="fxs">${out.join("")}</div>` : "";
}
const thumb = (e, cls="") => `<button class="fd-thumb ${cls}" data-clip="${e.id}" aria-label="Watch: ${esc(e.title)}">${heroArt(CASE[e.c], 7)}${
  posterOf(e.embed) ? `<img class="fb" alt="" loading="lazy" src="${posterOf(e.embed)}">` : ""}<span>${I.playSm}</span></button>`;
const feedEvent = e => ({t: e.t, cls: "ev", c: e.c,
  html: `<div class="fd-row"><div>${metaRow(e.c, e.t, `<span>· ${esc(e.tag)}</span>`)}<div class="fd-t">${esc(e.title)}</div>${fxChips(e)}</div>${thumb(e)}</div>`});
function feedFund(id, t, byMe){
  const c = CASE[id], backers = Math.round(c.target / c.ticket);
  return {t, cls: "fund", c: id, html: `${metaRow(id, t, "<span>· Funding</span>")}<div class="fd-t">${byMe
    ? "You closed the round" : "Fully funded"}: ${num(c.target)} cr from ${num(backers)} backers</div>`};
}
/* one trade, in a few words, for the activity list */
function txText(x){
  const n = esc(short(x.c));
  return x.kind === "round" ? `Bought ${n} in the round`
    : x.kind === "buy" ? `Bought ${n} at ${mult(x.price)}`
    : x.kind === "sell" ? `Sold ${n} at ${mult(x.price)}`
    : x.credits > 0 ? `${n} paid out` : `${n} paid nothing`;
}
function rebuildFeed(){
  feed.length = 0;
  EVENTS.filter(e => st.fired[e.id]).forEach(e => feed.push(feedEvent(e)));
  IDS.filter(id => st.open[id] != null).forEach(id => feed.push(feedFund(id, st.open[id], !!st.closedByMe[id])));
  feed.sort((a, b) => b.t - a.t);
  feedVer++; feedNew = 0;
}

/* ============ clips ============
   A moment's clip is somebody else's video in our frame: mounted only while
   it is on screen, and only ever one at a time. It starts muted, because a
   browser refuses sound until the page has been touched, and is unmuted
   afterwards through YouTube's own API rather than reloaded. If the API
   never arrives the clip still plays, muted. */
const YT_ID = url => (String(url).match(/(?:embed|shorts|v)\/([\w-]{6,})/) || String(url).match(/[?&]v=([\w-]{6,})/) || [])[1] || "";
const posterOf = url => { const id = YT_ID(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""; };
let ytApi = null;
function loadYT(){
  if(ytApi) return ytApi;
  ytApi = new Promise(resolve => {
    if(window.YT && window.YT.Player) return resolve(window.YT);
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if(before) try{ before(); }catch(e){} resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.YT && window.YT.Player ? window.YT : null), 8000);
  });
  return ytApi;
}
let gestured = false;
["pointerdown", "keydown", "touchend"].forEach(t => document.addEventListener(t, () => {
  if(gestured) return;
  gestured = true; applySound();
}, {passive: true}));
const clip = {player: null, host: null, slot: null, sound: false};
function slotHTML(c, url){
  const p = posterOf(url);
  return `<div class="slot" data-embed="${esc(url)}">${heroArt(c, 5)}${p ? `<img class="fb slot-img" alt="" src="${p}">` : ""}<span class="slot-play">${I.play}</span></div>`;
}
function mountClip(slot, url, sound){
  unmountClip();
  if(!slot || NOCLIPS) return;
  const id = YT_ID(url);
  const host = document.createElement("div");
  host.className = "yt-host";
  host.id = "yt" + Math.random().toString(36).slice(2, 9);
  slot.appendChild(host);
  Object.assign(clip, {host, slot, sound});
  loadYT().then(YT => {
    if(clip.host !== host || !host.isConnected) return;
    if(YT && YT.Player && id){
      clip.player = new YT.Player(host.id, {
        videoId: id,
        playerVars: {autoplay: 1, mute: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1, fs: 0, loop: 1, playlist: id},
        events: {onReady: ev => {
          if(clip.host !== host){ try{ ev.target.destroy(); }catch(_){} return; }
          const f = ev.target.getIframe && ev.target.getIframe();
          if(f) f.classList.add("vid");
          try{ ev.target.playVideo(); }catch(_){}
          applySound();
        }}
      });
    } else {
      const f = document.createElement("iframe");
      f.className = "vid";
      f.title = "Clip";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      f.src = url + (url.includes("?") ? "&" : "?") + `autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=0${id ? `&loop=1&playlist=${id}` : ""}`;
      host.replaceWith(f);
    }
  });
}
function unmountClip(){
  if(clip.player){ try{ clip.player.destroy(); }catch(e){} }
  if(clip.slot) clip.slot.querySelectorAll("iframe, .yt-host").forEach(n => n.remove());
  Object.assign(clip, {player: null, host: null, slot: null});
}
function applySound(){
  const p = clip.player, on = clip.sound && gestured;
  if(p && p.unMute){ try{ on ? p.unMute() : p.mute(); }catch(e){} }
  $$("[data-sound]").forEach(b => {
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = (on ? I.sound : I.muted) + `<span>${on ? "Sound on" : "Tap for sound"}</span>`;
  });
}

/* ============ the clock bar ============ */
function renderBar(){
  const yrs = [0, 1, 2, 3].map(k => `<span style="left:${(k * 12 / SCENARIO.calendar.months * 100).toFixed(2)}%">${SCENARIO.calendar.year + k}</span>`).join("");
  $("#simbar").innerHTML = `
    <button class="sb-play" id="sbPlay"></button>
    <div class="sb-clock" aria-live="off"><span class="sb-date" id="sbDate"></span><span class="sb-sub" id="sbSub"></span></div>
    <div class="sb-tl" id="sbTl">
      <div class="sb-track"></div><div class="sb-fill" id="sbFill"></div>
      <div id="sbTicks"></div><div class="sb-head" id="sbHead"></div><div class="sb-years" aria-hidden="true">${yrs}</div>
    </div>
    <div class="sb-right">
      <div class="sb-speed" role="group" aria-label="Speed">${SPEEDS.map(s => `<button data-speed="${s}" aria-pressed="false">${speedLabel(s)}</button>`).join("")}</div>
      <button class="sb-btn sb-next" id="sbNext" aria-label="Skip to the next event" title="Skip to the next event (N)">${I.next}</button>
      <div class="sb-wallet"><b data-v="total"></b><small data-v="ret"></small></div>
      <button class="sb-btn" id="sbGear" aria-label="Run settings" title="Run settings">${I.gear}</button>
    </div>`;
  $("#sbPlay").onclick = () => st.done ? openRestart() : setPlaying(!playing);
  $("#sbNext").onclick = skip;
  $("#sbGear").onclick = openSettings;
  $$("[data-speed]").forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
  $("#sbTicks").onclick = ev => {
    const b = ev.target.closest("[data-tick]");
    if(!b) return;
    const e = EVENTS.find(x => x.id === b.dataset.tick);
    if(e) showMoment(e, false); else openCase(b.dataset.tick);
  };
  ticksSig = "";
  renderTicks(); renderBarState(); tickClock();
}
let ticksSig = "";
function renderTicks(){
  const sig = Object.keys(st.fired).length + "/" + Object.keys(st.open).length;
  if(sig === ticksSig) return;
  ticksSig = sig;
  const pos = t => (t / LEN * 100).toFixed(2) + "%";
  const ev = EVENTS.filter(e => st.fired[e.id]).map(e => { const lab = esc(`${dateOf(e.t)} · ${short(e.c)}: ${e.title}`);
    return `<button class="sb-tick${e.major ? " major" : ""}" data-tick="${e.id}" style="left:${pos(e.t)};--tc:var(--c-${e.c})" title="${lab}" aria-label="${lab}"><i></i></button>`; });
  const fund = IDS.filter(id => st.open[id] != null).map(id => { const lab = esc(`${short(id)}: fully funded`);
    return `<button class="sb-tick fund" data-tick="${id}" style="left:${pos(st.open[id])};--tc:var(--c-${id})" title="${lab}" aria-label="${lab}"><i></i></button>`; });
  $("#sbTicks").innerHTML = fund.join("") + ev.join("");
}
function renderBarState(){
  const b = $("#sbPlay"); if(!b) return;
  b.innerHTML = st.done ? I.replay : (playing ? I.pause : I.play);
  b.classList.toggle("is-paused", !playing && !st.done && !st.started);
  b.setAttribute("aria-label", st.done ? "Run it again" : playing ? "Pause the clock" : st.started ? "Resume the clock" : "Start the clock");
  b.title = st.done ? "Run it again" : (playing ? "Pause" : "Play") + " (space)";
  $$("[data-speed]").forEach(x => x.setAttribute("aria-pressed", String(+x.dataset.speed === st.speed)));
}
function setSpeed(s){
  st.speed = s; save(); renderBarState(); tickClock();
  if(sheetOpen && sheetKind === "settings") $$("[data-sp]", sheet).forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.sp === s)));
}
function tickClock(){
  const d = $("#sbDate"); if(!d) return;
  d.textContent = dateOf(st.t);
  const left = (LEN - st.t) / st.speed;
  const sub = st.done ? "Simulation complete"
    : !st.started ? `<b>${mmss(LEN / st.speed)}</b> · press play`
    : playing && holds.size ? "Paused while you watch"
    : `<b>${mmss(left)}</b> left${playing ? "" : " · paused"}${st.speed !== 1 ? ` · ${speedLabel(st.speed)}` : ""}`;
  const el = $("#sbSub");
  if(el.innerHTML !== sub) el.innerHTML = sub;
  const p = (st.t / LEN * 100).toFixed(3) + "%";
  $("#sbFill").style.width = p;
  $("#sbHead").style.left = p;
}

/* ============ live numbers ============
   Anything marked data-v is rewritten in place on every tick, so a screen
   never redraws for a number. */
function val(k){
  const [what, id] = k.split(":"), s = id && snap.cases[id];
  switch(what){
    case "total": return [cr(snap.total)];
    case "ret": return [pctS(snap.ret), snap.ret];
    case "totalPl": return [`${signed(snap.total - START)} cr (${pctS(snap.ret)}) all time`, snap.ret];
    case "cash": return [cr(snap.cash)];
    case "incases": return [cr(snap.inCases)];
    case "paid": return [cr(snap.paidOut)];
    case "price": return [mult(s.price)];
    case "since": return [pctS(s.price - 1) + " since funding", s.price - 1];
    case "sinceS": return [pctS(s.price - 1), s.price - 1];
    case "pctN": return [Math.floor(s.pct * 100) + "%"];
    case "pstat": return [s.status === "raising" ? `Funding · ${Math.floor(s.pct * 100)}%` : s.live ? SCENARIO.stages[s.stage] : outcomeText(s)];
    case "chanceP": return [s.chance + "%"];
    case "raised": return [`${crK(s.raised)} of ${crK(CASE[id].target)} cr`];
    case "backers": return [num(s.crowd.backers)];
    case "value": return [cr(s.value)];
    case "invested": return [cr(s.stake.invested)];
    case "returned": return [cr(s.stake.returned)];
    case "pl": return [signed(s.pl) + " cr", s.pl];
    case "plpct": return [s.stake.invested ? pctS(s.pl / s.stake.invested) : "", s.pl];
    case "model": return [mult(s.ev)];
  }
  return [""];
}
function paint(root=document){
  $$("[data-v]", root).forEach(el => {
    const [text, sign] = val(el.dataset.v);
    if(el.textContent !== text) el.textContent = text;
    if(sign !== undefined) el.dataset.sign = signOf(sign);
  });
  $$("[data-w]", root).forEach(el => { const s = snap.cases[el.dataset.w]; el.style.width = (s.pct * 100).toFixed(2) + "%"; });
}
/* redraw a block only when what it shows has changed shape */
function patch(el, sig, html){
  if(!el || el.dataset.sig === sig) return false;
  el.dataset.sig = sig;
  el.innerHTML = typeof html === "function" ? html() : html;
  return true;
}

let chartAt = 0;
function tick(now, force){
  snap = compute();
  renderTicks();
  const charts = force || now - chartAt > 480;
  if(charts) chartAt = now;
  if(view === "home") tickHome(force, charts);
  if(view === "case") tickCase(force, charts);
  if(view === "port") tickPort(force, charts);
  if(view === "end" && !st.done) tickWait(force);
  if(momentE) tickMoment();
  if(sheetOpen && sheetTick) sheetTick();
  renderWallet();
  paint();
  if(running() && now - lastSave > 2000){ lastSave = now; save(); }
}

/* ============ charts ============
   One line chart, drawn four ways: the market on the home page, one case's
   price, your portfolio, and the same portfolio on the results. Values come
   from the engine at one-second steps, so every line on every screen agrees
   with every number. */
const YEAR_T = [0, 1, 2, 3].map(k => k * 12 / SCENARIO.calendar.months * LEN);
/* Charts are drawn at the width they are shown at, so their type stays
   the size it says on a phone as well as a laptop. */
const CH = {T: 12, B: 26};
function niceMax(v, steps){ for(const s of steps) if(v <= s) return s; return steps[steps.length - 1]; }
function priceSeries(id, upto){
  const c = CASE[id], open = st.open[id];
  if(open == null || upto < open) return [];
  const end = c.end ? c.end.t : Infinity, pts = [];
  for(let t = open; t < Math.min(upto, end); t += 1) pts.push([t, SimEngine.priceAt(M, id, t, open)]);
  if(upto >= end){
    pts.push([end - .001, SimEngine.priceAt(M, id, end - .001, open)], [end, SimEngine.payoutOf(c)]);
    if(upto > end) pts.push([upto, SimEngine.payoutOf(c)]);
  } else pts.push([upto, SimEngine.priceAt(M, id, upto, open)]);
  return pts;
}
/* a total at every step so far: a record of trades replayed against prices */
function valueSeries(txns, opens, upto, step=2){
  const b = SimEngine.book(START), xs = [...txns].sort((a, c) => a.t - c.t), pts = [];
  let k = 0;
  const apply = x => {
    const s = SimEngine.stake(b, x.c);
    if(x.kind === "round" || x.kind === "buy"){ s.units += x.units; b.cash -= x.credits; }
    else { s.units = Math.max(0, s.units - x.units); b.cash += x.credits; }
  };
  for(let t = 0; ; t = Math.min(upto, t + step)){
    while(k < xs.length && xs[k].t <= t) apply(xs[k++]);
    pts.push([t, SimEngine.worth(M, b, t, opens)]);
    if(t >= upto) break;
  }
  return pts;
}
function lineChart(series, o){
  const {T, B} = CH, W = o.W || 640, H = o.H || 230, L = o.padL || 40, R = o.padR || 100;
  const x = t => L + (W - L - R) * t / LEN, y = v => T + (H - T - B) * (1 - Math.min(o.yMax, v) / o.yMax);
  let g = "";
  o.yTicks.forEach(v => {
    g += `<line class="lc-grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
      <text class="lc-axis r" x="${L - 7}" y="${(y(v) + 3.5).toFixed(1)}">${o.yFmt(v)}</text>`;
  });
  YEAR_T.forEach((t, k) => { g += `<text class="lc-axis" x="${x(t) + 2}" y="${H - 8}">${SCENARIO.calendar.year + k}</text>`; });
  if(o.now < LEN) g += `<rect class="lc-future" x="${x(o.now).toFixed(1)}" y="${T}" width="${(x(LEN) - x(o.now)).toFixed(1)}" height="${H - T - B}"/>
      <line class="lc-now" x1="${x(o.now).toFixed(1)}" x2="${x(o.now).toFixed(1)}" y1="${T}" y2="${H - B}"/>`;
  if(o.base) g += `<line class="lc-base" x1="${L}" x2="${W - R}" y1="${y(o.base.v).toFixed(1)}" y2="${y(o.base.v).toFixed(1)}"/>
      <text class="lc-baselab" x="${W - R + 6}" y="${(y(o.base.v) + 3.5).toFixed(1)}">${esc(o.base.label)}</text>`;
  const path = pts => pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("");
  let lines = "";
  const ends = [];
  series.forEach(s => {
    if(!s.pts.length) return;
    const d = path(s.pts), last = s.pts[s.pts.length - 1];
    if(s.area) lines += `<path class="lc-area" style="--cat:${s.color}" d="${d}L${x(last[0]).toFixed(1)} ${y(0)}L${x(s.pts[0][0]).toFixed(1)} ${y(0)}Z"/>`;
    lines += `<path class="lc-line" style="--cat:${s.color}${s.width ? `;stroke-width:${s.width}` : ""}" d="${d}"/>`;
    if(s.label) ends.push({x: x(last[0]), y: y(last[1]), ly: y(last[1]), s, v: last[1]});
  });
  (o.marks || []).forEach(m => {
    lines += `<circle class="lc-mark${m.major ? " major" : ""}${m.you ? " you" : ""}" style="--cat:${m.color || "var(--ink)"}" cx="${x(m.t).toFixed(1)}" cy="${y(m.v).toFixed(1)}" r="${m.major || m.you ? 4.5 : 3.5}"/>`;
  });
  /* end labels: pushed apart when they would collide, with a leader back to
     the line each belongs to */
  ends.sort((a, b) => a.y - b.y);
  for(let i = 1; i < ends.length; i++) if(ends[i].ly - ends[i - 1].ly < 15) ends[i].ly = ends[i - 1].ly + 15;
  const over = ends.length ? ends[ends.length - 1].ly - (H - B - 4) : 0;
  if(over > 0) ends.forEach(e => e.ly -= over);
  ends.forEach(e => {
    const lx = e.x + 11;
    if(Math.abs(e.ly - e.y) > 3) lines += `<path class="lc-lead" d="M${(e.x + 4).toFixed(1)} ${e.y.toFixed(1)}L${(lx - 2).toFixed(1)} ${e.ly.toFixed(1)}"/>`;
    lines += `<circle class="lc-dot" style="--cat:${e.s.color}" cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="4"/>
      <text class="lc-end" x="${lx.toFixed(1)}" y="${(e.ly + 4).toFixed(1)}">${esc(e.s.label)} <tspan>${esc(o.endFmt(e.v))}</tspan></text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || "")}">${g}${lines}</svg>`;
}
/* The hover layer: a crosshair that snaps to the nearest second and one
   tooltip listing every series there. It is built once per chart and kept
   across redraws, so a pointer resting on a live chart keeps reading it. */
function wireChart(box){
  if(box._reshow) return;
  const cross = document.createElement("div"), tip = document.createElement("div");
  cross.className = "lc-x"; tip.className = "lc-tip";
  box.append(cross, tip);
  let px = null;
  const show = () => {
    const m = chartModels[box.dataset.chart], s = box.querySelector("svg");
    if(!m || m.empty || !s || px == null){ cross.style.display = "none"; tip.classList.remove("on"); return; }
    const r = s.getBoundingClientRect(), br = box.getBoundingClientRect(), k = r.width / m.W;
    const L = m.padL || 40, R = m.padR || 100;
    const t = Math.max(0, Math.min(m.now, Math.round(((px - r.left) / k - L) / (m.W - L - R) * LEN)));
    const xpx = r.left - br.left + (L + (m.W - L - R) * t / LEN) * k;
    Object.assign(cross.style, {display: "block", left: xpx + "px", top: (r.top - br.top + CH.T * k) + "px", height: ((m.H - CH.T - CH.B) * k) + "px"});
    const near = m.near ? m.near(t) : "";
    tip.innerHTML = `<h4>${dateOf(t)}</h4>${m.read(t).map(rw => `<p style="--cat:${rw.color}"><i></i><b>${esc(rw.v)}</b><span>${esc(rw.label)}</span></p>`).join("")}${
      near ? `<div class="tip-ev">${esc(near)}</div>` : ""}`;
    tip.classList.add("on");
    const tw = tip.offsetWidth, left = xpx + 12 + tw > br.width ? xpx - 12 - tw : xpx + 12;
    tip.style.left = Math.max(0, left) + "px"; tip.style.top = (r.top - br.top + 6) + "px";
  };
  box.addEventListener("pointermove", e => { px = e.clientX; show(); });
  box.addEventListener("pointerleave", () => { px = null; show(); });
  box._reshow = show;
}
const chartModels = {};
/* draw a chart, or its table if the Table button is pressed */
function drawChart(box, model){
  if(!box) return;
  const key = box.dataset.chart;
  chartModels[key] = model;
  const btn = box.parentElement.querySelector(`[data-table-for="${key}"]`);
  const asTable = btn && btn.getAttribute("aria-pressed") === "true";
  if(asTable){
    const sig = "t" + Math.floor(model.now / 37.5);
    if(box.dataset.tsig === sig) return;
    box.dataset.tsig = sig;
  } else delete box.dataset.tsig;
  [...box.children].forEach(n => { if(!n.classList.contains("lc-x") && !n.classList.contains("lc-tip")) n.remove(); });
  let html;
  if(asTable){
    const ts = [];
    for(let t = 0; t <= model.now; t += 37.5) ts.push(t);
    if(!ts.length || ts[ts.length - 1] < model.now) ts.push(model.now);
    html = `<div class="dtable-wrap"><table class="dtable"><thead><tr><th>Date</th>${model.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${ts.reverse().map(t => `<tr><td>${dateOf(t)}</td>${model.read(t).map(r => `<td>${esc(r.v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  } else {
    model.W = Math.max(300, Math.round(box.clientWidth || 640));
    model.H = model.W < 520 ? 210 : 230;
    /* the empty state takes the chart's own height, so nothing below moves
       when the first line arrives */
    html = model.empty ? `<div class="lc-empty" style="height:${model.H}px">${esc(model.empty)}</div>` : model.svg(model.W, model.H);
  }
  box.insertAdjacentHTML("afterbegin", html);
  if(!asTable){ wireChart(box); box._reshow(); }
}
const tableToggle = key => `<button class="tbl-btn" data-table-for="${key}" aria-pressed="false">Table</button>`;

/* the market: what a credit from each round is worth, all three on one axis */
function marketModel(){
  const now = st.t, series = IDS.map(id => ({color: ccol(id), label: short(id), pts: priceSeries(id, now)}));
  const yMax = niceMax(Math.max(1.5, ...series.flatMap(s => s.pts.map(p => p[1]))) * 1.12, [1.5, 2, 2.5, 3, 3.5, 4]);
  return {now, cols: IDS.map(short), padR: 108,
    empty: series.every(s => !s.pts.length) ? "Prices start when the first round fills." : "",
    svg: (W, H) => lineChart(series, {W, H, now, yMax, yTicks: [0, 1, 2, 3, 4].filter(v => v <= yMax), yFmt: v => v + "×", endFmt: mult,
      base: {v: 1, label: "Round price"}, padR: 108, aria: "What one credit from each funding round is worth over time"}),
    read: t => IDS.map(id => { const o = st.open[id]; return {color: ccol(id), label: short(id),
      v: o == null || t < o ? "raising" : mult(SimEngine.priceAt(M, id, t, o))}; })};
}
function caseModel(id){
  const now = st.t, c = CASE[id], pts = priceSeries(id, now), open = st.open[id];
  const yMax = niceMax(Math.max(1.5, ...pts.map(p => p[1])) * 1.12, [1.5, 2, 2.5, 3, 3.5, 4]);
  const marks = open == null ? [] : c.events.filter(e => st.fired[e.id] && e.t >= open && (e.odds || e.end))
    .map(e => ({t: e.t, v: e.end ? SimEngine.payoutOf(c) : SimEngine.priceAt(M, id, e.t - .01, open), major: e.major, color: ccol(id)}));
  return {now, cols: [short(id)], padR: 90,
    empty: !pts.length ? "Trading starts when the round is full." : "",
    svg: (W, H) => lineChart([{color: ccol(id), label: "Now", pts, area: true}],
      {W, H, now, yMax, yTicks: [0, 1, 2, 3, 4].filter(v => v <= yMax), yFmt: v => v + "×", endFmt: mult, base: {v: 1, label: "Round price"},
       marks, padR: 90, aria: `What one credit from the ${short(id)} round is worth over time`}),
    read: t => [{color: ccol(id), label: short(id), v: open == null || t < open ? "raising" : mult(SimEngine.priceAt(M, id, t, open))}],
    near: t => { const e = c.events.find(x => st.fired[x.id] && Math.abs(x.t - t) <= 3); return e ? e.title : ""; }};
}
function portModel(){
  const now = st.t, opens = {...SimEngine.crowdOpens(M), ...st.open};
  const mine = valueSeries(st.book.txns, opens, now);
  const bench = valueSeries(PERSONAS.find(p => p.id === "maya").run.b.txns, SimEngine.crowdOpens(M), now);
  const yMax = niceMax(Math.max(1500, ...mine.map(p => p[1]), ...bench.map(p => p[1])) * 1.1, [1500, 2000, 2500, 3000, 3500, 4000]);
  const vAt = (pts, t) => (pts.find(p => p[0] >= t) || pts[pts.length - 1])[1];
  const marks = st.book.txns.filter(x => x.kind !== "payout").map(x => ({t: x.t, v: vAt(mine, x.t), you: true}));
  return {now, cols: ["You", "Even split"], padR: 96,
    svg: (W, H) => lineChart([{color: "var(--ink-soft)", label: "Even split", pts: bench, width: 1.5},
                          {color: "var(--navy)", label: "You", pts: mine, area: true}],
      {W, H, now, yMax, yTicks: [0, 1000, 2000, 3000, 4000].filter(v => v <= yMax), yFmt: v => v ? v / 1000 + "k" : "0", endFmt: num,
       base: {v: START, label: "Start"}, marks, padR: 96, aria: "Your total value over time, against an even split held to the end"}),
    read: t => [{color: "var(--navy)", label: "You", v: cr(vAt(mine, t))}, {color: "var(--ink-soft)", label: "Even split", v: cr(vAt(bench, t))}]};
}

/* small marks */
/* a price since funding, against a dashed line at the round price: green
   above it, red below, the way a brokerage colours a stock's line */
function sparkLine(id){
  const pts = priceSeries(id, st.t);
  if(pts.length < 2) return "";
  const W = 300, H = 40, t0 = pts[0][0], t1 = Math.max(t0 + 30, pts[pts.length - 1][0]);
  const hi = Math.max(1.2, ...pts.map(p => p[1])) * 1.08;
  const x = t => (t - t0) / (t1 - t0) * (W - 8) + 2, y = v => 4 + (H - 8) * (1 - v / hi);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("");
  const up = pts[pts.length - 1][1] >= 1;
  return `<svg class="cspark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line class="cspark-base" x1="0" x2="${W}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}" vector-effect="non-scaling-stroke"/>
    <path d="${d}" style="stroke:var(--${up ? "up" : "down"})" vector-effect="non-scaling-stroke"/></svg>`;
}
/* while a round is open, its row shows it filling */
const fundCell = s => `<div class="meter"><i data-w="${s.id}"></i></div><small><b data-v="pctN:${s.id}"></b> funded</small>`;

/* ============ the account, in the header ============ */
function renderWallet(){
  const el = $("#navWallet"); if(!el) return;
  patch(el, "w", `<div class="hw"><span>Account value</span><div><b data-v="total"></b><em data-v="ret"></em></div></div>
    <div class="hw"><span>Cash</span><div><b data-v="cash"></b></div></div>`);
}

/* ============ cases ============
   The three cases listed the way a brokerage lists stocks: one row each,
   with the price, its move since funding, your position and the buttons.
   Beside them, the news that moves the prices. */
function renderHome(){
  $("#v-home").innerHTML = `<div class="home">
    <div class="home-main">
      ${st.started ? "" : introHTML()}
      <section class="card ct" aria-label="Cases">
        <div class="card-h"><h2>Cases</h2></div>
        <div class="ct-head" aria-hidden="true"><span></span><span>Case</span><span>Stage</span><span>Win chance</span><span class="c-imp">Impact</span><span class="c-chart"></span><span class="r">Price</span><span class="r">Your position</span><span></span></div>
        ${IDS.map(rowHTML).join("")}
      </section>
      ${st.started ? `<section class="card mk">
        <div class="card-h"><h2>Prices</h2>${tableToggle("market")}</div>
        <div class="mk-legend">${IDS.map(id => `<span style="--cat:${ccol(id)}"><i></i>${esc(short(id))} <b data-mk="${id}"></b></span>`).join("")}</div>
        <div class="lc" data-chart="market"></div></section>` : ""}
    </div>
    <aside class="card fd" aria-label="News">
      <div class="card-h"><h2><i class="livedot"></i>News</h2></div>
      <ol class="fd-list" id="feedList"></ol>
    </aside></div>`;
  feedDrawn = -1;
  if(snap) tickHome(true, true);
}
function introHTML(){
  return `<section class="welcome">
    <div class="wl-text">
      <div class="eyebrow"><i></i>Live simulation · ten minutes</div>
      <h1>Invest ${num(START)} credits in three lawsuits.</h1>
      <p>Four years of rulings play out in ten minutes. Every ruling moves the price.</p>
      <ol class="steps"><li>Buy a position</li><li>Watch the news</li><li>Hold or sell</li></ol>
    </div>
    <div class="wl-cta"><button class="btn primary" data-act="start">${I.play}Start the clock</button>
      <small>Or buy first: the funding rounds are open.</small></div>
    <p class="fine">Fictional cases and virtual credits. Not investment advice.</p>
  </section>`;
}
/* a whole row opens its case; its buttons do what they say */
function rowHTML(id){
  const c = CASE[id];
  return `<article class="crow" data-id="${id}" data-open="${id}" style="--cat:${ccol(id)}">
    ${logo(c)}
    <div class="crow-name"><h3><button data-open="${id}">${esc(short(id))}</button></h3><small>${esc(CATS[c.cat].label)}</small></div>
    <div class="crow-meta">
      <div class="crow-stage" data-part="stage"></div>
      <div class="crow-win"><b data-v="chanceP:${id}"></b><small> win chance</small></div>
      <div class="crow-imp c-imp"><b>${c.impact}</b><small> impact</small></div>
    </div>
    <div class="crow-chart c-chart" data-part="chart"></div>
    <div class="crow-price" data-part="price"></div>
    <div class="crow-pos" data-part="pos"></div>
    <div class="crow-acts" data-part="acts"></div>
  </article>`;
}
const STATUS_WORD = {won: "Won", settled: "Settled", lost: "Lost"};
/* where a case is: its round, its stage, or how it ended */
function stageHTML(s){
  /* the share funded is in the progress bar beside it, where there is room for one */
  if(s.status === "raising") return `<span class="st-fund">Funding<b class="st-pct"> <span data-v="pctN:${s.id}"></span></b></span>`;
  if(s.live) return esc(SCENARIO.stages[s.stage]);
  return `<span class="spill ${s.status}">${STATUS_WORD[s.status]}</span>`;
}
const stagePill = s => s.ended ? `<span class="spill ${s.status}">${STATUS_WORD[s.status]}</span>`
  : `<span class="ctag">${s.status === "raising" ? "Funding round" : esc(SCENARIO.stages[s.stage])}</span>`;
function priceHTML(s){
  const id = s.id;
  if(s.status === "raising") return `<b>1.00×</b><span class="chg">Round</span>`;
  if(s.live) return `<b data-v="price:${id}"></b><span class="chg" data-v="sinceS:${id}"></span>`;
  return `<b>${s.payout > 0 ? mult(s.payout) : "0×"}</b><span class="chg" data-sign="${s.payout > 0 ? "up" : "down"}">Final</span>`;
}
function posCell(s){
  const id = s.id;
  if(s.hold) return `<b data-v="value:${id}"></b><em data-v="plpct:${id}"></em>`;
  if(s.stake.invested) return `<b>Closed</b><em data-sign="${signOf(s.pl)}">${signed(s.pl)} cr</em>`;
  return `<span class="none">—</span>`;
}
function actsHTML(s){
  const id = s.id, cash = snap.cash >= 1;
  if(s.ended) return `<button class="btn line" data-open="${id}">View</button>`;
  return `<button class="btn primary" data-act="in" data-id="${id}"${cash ? "" : " disabled"}>Buy</button>${s.status === "raising" ? ""
    : `<button class="btn line" data-act="out" data-id="${id}"${s.hold ? "" : " disabled"}>Sell</button>`}`;
}
/* when the crowd has run a price well past or below what the odds say */
function hotHTML(s){
  if(!s.live || !s.ev) return "";
  const r = s.price / s.ev - 1;
  if(r >= .12) return `<span class="hot">${I.flame}${Math.round(r * 100)}% above fair value</span>`;
  if(r <= -.1) return `<span class="hot cold">${I.tag}${Math.round(-r * 100)}% below fair value</span>`;
  return "";
}
let feedDrawn = -1;
function tickHome(force, charts){
  const v = $("#v-home");
  IDS.forEach(id => {
    const s = snap.cases[id], row = v.querySelector(`.crow[data-id="${id}"]`);
    if(!row) return;
    const q = n => row.querySelector(`[data-part="${n}"]`);
    patch(q("stage"), s.status + s.stage, () => stageHTML(s));
    /* a price line moves with the clock, so it redraws once a second */
    patch(q("chart"), s.status === "raising" ? "r" : s.ended ? s.status : s.status + Math.floor(st.t), () => s.status === "raising" ? fundCell(s) : sparkLine(id));
    patch(q("price"), s.status, () => priceHTML(s));
    patch(q("pos"), (s.hold ? "h" : "n") + Math.round(s.stake.invested) + "/" + Math.round(s.stake.returned), () => posCell(s));
    patch(q("acts"), s.status + (s.hold ? "h" : "") + (snap.cash >= 1 ? "c" : ""), () => actsHTML(s));
  });
  IDS.forEach(id => { const b = v.querySelector(`[data-mk="${id}"]`); if(b){ const s = snap.cases[id];
    const t = s.status === "raising" ? "funding" : mult(s.price);
    if(b.textContent !== t) b.textContent = t; } });
  if(charts) drawChart(v.querySelector('[data-chart="market"]'), marketModel());
  renderFeed(force);
}
let feedOpen = false;
function renderFeed(force){
  const el = $("#feedList"); if(!el) return;
  if(!force && feedDrawn === feedVer) return;
  const n = feedOpen ? 80 : innerWidth >= 1200 ? 40 : 6, items = feed.slice(0, n);
  el.innerHTML = items.length ? items.map((it, k) => `<li class="fd-${it.cls}${k < Math.min(feedNew, 3) ? " in" : ""}" style="--cat:${ccol(it.c)}">${it.html}</li>`).join("")
    : `<li class="fd-empty">Headlines appear here once the clock starts.</li>`;
  if(feed.length > n) el.insertAdjacentHTML("beforeend", `<li class="fd-more-li"><button class="fd-more" data-act="more">Show more</button></li>`);
  feedNew = 0;
  feedDrawn = feedVer;
}
function flash(id){
  const row = $(`.crow[data-id="${id}"]`);
  if(!row) return;
  row.classList.remove("flash"); void row.offsetWidth; row.classList.add("flash");
  setTimeout(() => row.classList.remove("flash"), 1600);
}

/* ============ a case ============
   Laid out like a stock's page: the price and its chart, your position and
   the buttons beside them, then the numbers, the news and the case itself.
   The long background is folded away until someone asks for it. */
let caseId = null;
function openCase(id){
  if(!CASE[id]) return;
  caseId = id;
  renderCase();
  go("case");
  $("#v-case").scrollTop = 0;
}
const backTo = () => ({home: "Cases", port: "Portfolio", end: "Results"})[view === "case" ? prevView : view] || "Cases";
function renderCase(){
  const id = caseId, c = CASE[id], pp = c.people;
  $("#v-case").innerHTML = `<div class="sc-wrap" style="--cat:${ccol(id)}">
    <button class="crumb" data-back>${I.back}${backTo()}</button>
    <header class="sc-head">
      <div class="sc-banner">${motif(c, "xMaxYMid meet")}</div>
      ${logo(c, "lg")}
      <div class="sc-title">
        <div class="sc-tags"><span class="ctag">${esc(CATS[c.cat].label)}</span><span data-part="pill"></span></div>
        <h1>${esc(short(id))}</h1>
        <p>${esc(c.head)}</p>
      </div>
    </header>
    <div class="sc-body">
      <section class="card sc-pricecard">
        <div class="sc-ph"><div class="sc-price" data-part="price"></div>${tableToggle("case")}</div>
        <div class="lc" data-chart="case"></div>
        <ol class="stg" data-part="stages" aria-label="Stage"></ol>
      </section>
      <section class="card sc-panel" data-part="panel" aria-label="Your position"></section>
      <section class="card sc-sec"><h2>Key stats</h2><div data-part="stats"></div></section>
      <section class="card sc-sec"><h2>News</h2><div data-part="story"></div></section>
      <section class="card sc-sec"><h2>Impact so far</h2><ul class="sc-impacts" data-part="impacts"></ul></section>
      <section class="card sc-sec"><h2>About the case</h2>
        <div class="sc-facts">${c.facts.map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("")}</div>
        <dl class="sc-who">
          <dt>Case</dt><dd>${esc(c.caseName)}</dd>
          <dt>Court</dt><dd>${esc(c.court)}</dd>
          <dt>Plaintiff</dt><dd>${esc(pp.plaintiff.name)}<small>${esc(pp.plaintiff.role)}</small></dd>
          <dt>Counsel</dt><dd>${esc(pp.attorney.name)}<small>${esc(pp.attorney.role)}</small></dd>
        </dl>
        <h3 class="sub-h">What the ${crK(c.target)} credits pay for</h3>
        <div class="budget"><div class="bg-ribbon">${c.budget.map(([k, n], i) => `<span class="bg-seg" style="--w:${(n / c.target * 100).toFixed(2)}%;--i:${i}" title="${esc(k)}"></span>`).join("")}</div>
          <div class="bg-rows">${c.budget.map(([k, n], i) => `<div><span class="bg-dot" style="--i:${i}"></span><span>${esc(k)}</span><b>${num(n)} cr</b></div>`).join("")}</div></div>
        <details class="more"><summary>Background</summary><div class="more-in">
          ${c.summary.map(p => `<p>${esc(p)}</p>`).join("")}
          ${["plaintiff", "attorney"].map(k => `<p><b>${esc(pp[k].name)}.</b> ${esc(pp[k].bio)}</p>`).join("")}</div></details>
      </section>
    </div></div>`;
}
function casePriceHTML(s){
  const id = s.id;
  if(s.status === "raising") return `<small>Funding round</small>
    <div class="px-row"><span class="px-big" data-v="pctN:${id}"></span><span class="px-sub">funded · <b data-v="raised:${id}"></b></span></div>
    <div class="meter"><i data-w="${id}"></i></div>`;
  if(s.live) return `<small>Price</small>
    <div class="px-row"><span class="px-big" data-v="price:${id}"></span><span class="chg" data-v="since:${id}"></span></div>
    <div class="px-sub"><span title="What the odds alone say a credit is worth">Fair value <b data-v="model:${id}"></b></span>${hotHTML(s)}</div>`;
  return `<small>Final payout</small>
    <div class="px-row"><span class="px-big">${s.payout > 0 ? mult(s.payout) : "0×"}</span><span class="chg" data-sign="${s.payout > 0 ? "up" : "down"}">${esc(outcomeText(s))}</span></div>`;
}
function panelHTML(s){
  const id = s.id, cash = snap.cash >= 1;
  let body;
  if(s.hold) body = `<div class="pp-val"><b data-v="value:${id}"></b><em data-v="plpct:${id}"></em></div>
    <dl class="pp-dl"><dt>Put in</dt><dd data-v="invested:${id}"></dd>${s.stake.returned ? `<dt>Taken out</dt><dd data-v="returned:${id}"></dd>` : ""}
      <dt>Gain or loss</dt><dd data-v="pl:${id}"></dd></dl>`;
  else if(s.stake.invested) body = `<div class="pp-val"><b>Closed</b></div>
    <dl class="pp-dl"><dt>Put in</dt><dd>${cr(s.stake.invested)}</dd><dt>Got back</dt><dd>${cr(s.stake.returned)}</dd>
      <dt>Gain or loss</dt><dd data-sign="${signOf(s.pl)}">${signed(s.pl)} cr</dd></dl>`;
  else body = `<p class="pp-none">No position yet.</p>`;
  const acts = s.ended ? "" : `<div class="pp-acts"><button class="btn primary" data-act="in"${cash ? "" : " disabled"}>Buy</button>${
    s.status === "raising" ? "" : `<button class="btn line" data-act="out"${s.hold ? "" : " disabled"}>Sell</button>`}</div>`;
  return `<h2>Your position</h2>${body}${acts}
    <p class="pp-note">${s.ended ? esc(outcomeText(s)) : `Cash <b data-v="cash"></b>`}</p>
    <button class="link sm pp-share" data-act="share">${I.share}Share this case</button>`;
}
function statsHTML(s){
  const c = s.c, id = s.id, pc = v => Math.round(v * 100) + "%";
  const lose = Math.max(0, 1 - s.odds.win - s.odds.settle);
  const outcomes = s.ended ? "" : `<table class="otbl"><thead><tr><th>Outcome</th><th>Chance</th><th>Pays per credit</th></tr></thead><tbody>
      <tr><td>Verdict</td><td>${pc(s.odds.win)}</td><td>${mult(c.winMult)}</td></tr>
      <tr><td>Settlement</td><td>${pc(s.odds.settle)}</td><td>${mult(c.settleMult)}</td></tr>
      <tr><td>Loss</td><td>${pc(lose)}</td><td>0×</td></tr></tbody></table>`;
  return `<div class="kgrid">
      <div><small>Win chance</small><b data-v="chanceP:${id}"></b></div>
      <div><small>Impact score</small><b>${c.impact}<span class="of"> / 100</span></b></div>
      <div><small>Funding goal</small><b>${crK(c.target)} cr</b></div>
      <div><small>Backers</small><b data-v="backers:${id}"></b></div>
      <div><small>Stage</small><b>${s.ended ? STATUS_WORD[s.status] : esc(SCENARIO.stages[s.stage])}</b></div>
      <div><small>Early-exit fee</small><b>${Math.round(SCENARIO.exitDiscount * 100)}%</b></div>
    </div>${outcomes}`;
}
function storyHTML(id){
  const c = CASE[id], open = st.open[id];
  const rows = c.events.filter(e => st.fired[e.id]).reverse().map(e => `<li>${thumb(e, "st-thumb")}<div style="min-width:0">
      <div class="fd-meta"><span>${dateOf(e.t)}</span><span>· ${esc(e.tag)}</span></div>
      <h3>${esc(e.title)}</h3><p>${esc(e.body)}</p>${fxChips(e)}</div></li>`);
  if(open != null){
    const at = rows.length - c.events.filter(e => st.fired[e.id] && e.t < open).length;
    rows.splice(at, 0, `<li><div style="min-width:0"><div class="fd-meta"><span>${dateOf(open)}</span><span>· Funding</span></div>
      <h3>${st.closedByMe[id] ? "You closed the round" : "Fully funded"}: ${num(c.target)} cr</h3></div></li>`);
  }
  return rows.length ? `<ul class="story">${rows.join("")}</ul>` : `<p class="none">No news yet.</p>`;
}
function tickCase(force, charts){
  const v = $("#v-case"), id = caseId;
  if(!id || !v.firstElementChild) return;
  const s = snap.cases[id], c = CASE[id], q = n => v.querySelector(`[data-part="${n}"]`);
  patch(q("pill"), s.status + s.stage, () => stagePill(s));
  patch(q("price"), s.status + hotHTML(s), () => casePriceHTML(s));
  patch(q("panel"), [s.status, s.hold, Math.round(s.stake.invested), Math.round(s.stake.returned), snap.cash >= 1].join("/"), () => panelHTML(s));
  patch(q("stages"), s.stage + s.status, () => SCENARIO.stages.map((n, k) =>
    `<li class="${k < s.stage ? "done" : k === s.stage ? "now" : ""}">${esc(k === 5 && s.ended ? STATUS_WORD[s.status] : n)}</li>`).join(""));
  q("stages").classList.toggle("over", s.ended);
  patch(q("stats"), s.status + s.stage + JSON.stringify(s.odds), () => statsHTML(s));
  patch(q("story"), c.events.filter(e => st.fired[e.id]).length + "/" + (st.open[id] != null) + s.status, () => storyHTML(id));
  patch(q("impacts"), s.impacts.length + "", () => s.impacts.length
    ? s.impacts.map(e => `<li>${I.spark}<span>${esc(e.impact)} <small>${dateOf(e.t)}</small></span></li>`).join("")
    : `<li class="none">None yet.</li>`);
  if(charts) drawChart(v.querySelector('[data-chart="case"]'), caseModel(id));
}

/* ============ portfolio ============
   An account summary, as a brokerage shows one: the value, the cash, the
   positions, how it compares, and every trade. */
const valueLegend = () => `<div class="legend"><span><i class="lg-you"></i>You</span><span><i class="lg-bench"></i>Even split</span></div>`;
function renderPort(){
  $("#v-port").innerHTML = `<div class="pf">
    <h1 class="pg-title">Portfolio</h1>
    <div class="pf-tiles">
      <div class="tile hero"><small>Account value</small><b data-v="total"></b><em data-v="totalPl"></em></div>
      <div class="tile"><small>Cash</small><b data-v="cash"></b></div>
      <div class="tile"><small>Holdings</small><b data-v="incases"></b></div>
      <div class="tile"><small>Paid out</small><b data-v="paid"></b></div>
    </div>
    <section class="card"><div class="card-h"><h2>Account value</h2>${valueLegend()}${tableToggle("port")}</div>
      <div class="lc" data-chart="port"></div></section>
    <div class="pf-grid">
      <section class="card"><div class="card-h"><h2>Positions</h2></div><div class="pos" data-part="pos"></div><div class="pf-alloc" data-part="alloc"></div></section>
      <section class="card"><div class="card-h"><h2>Standings</h2><small>vs ${PERSONAS.length} simulated investors</small></div><ol class="board" data-part="board"></ol></section>
    </div>
    <section class="card"><div class="card-h"><h2>Activity</h2></div><ul class="acts-list" data-part="acts"></ul></section>
  </div>`;
}
const outcomeText = s => s.status === "won" ? `Won · paid ${mult(s.payout)}` : s.status === "settled" ? `Settled · paid ${mult(s.payout)}` : "Lost · paid nothing";
function posHTML(){
  const ids = IDS.filter(id => snap.cases[id].stake.invested > 0);
  if(!ids.length) return `<p class="none pad">No positions yet. <button class="link" data-go="home">See the cases</button></p>`;
  return ids.map(id => {
    const s = snap.cases[id], cash = snap.cash >= 1;
    const acts = s.ended ? "" : `<button class="btn primary" data-act="in" data-id="${id}"${cash ? "" : " disabled"}>Buy</button>${s.live
      ? `<button class="btn line" data-act="out" data-id="${id}"${s.hold ? "" : " disabled"}>Sell</button>` : ""}`;
    return `<div class="pcase" data-open="${id}" style="--cat:${ccol(id)}">${logo(s.c)}
      <div class="pcase-name"><h3><button data-open="${id}">${esc(short(id))}</button></h3><small data-v="pstat:${id}"></small></div>
      <div class="pcase-num"><b data-v="${s.hold ? "value" : "returned"}:${id}"></b><small>${s.hold ? "Value" : s.ended ? "Paid out" : "Sold for"}</small></div>
      <div class="pcase-num"><b data-v="pl:${id}"></b><small data-v="plpct:${id}"></small></div>
      <div class="pcase-acts">${acts}</div></div>`;
  }).join("");
}
function allocHTML(){
  const parts = [{k: "cash", label: "Cash", v: snap.cash, color: ""}, ...IDS.map(id => ({k: id, label: short(id), v: snap.cases[id].value, color: ccol(id)}))];
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  return `<h3>Allocation</h3><div class="al" role="img" aria-label="${esc(parts.map(p => `${p.label} ${Math.round(p.v / tot * 100)}%`).join(", "))}">${parts.filter(p => p.v >= 1).map(p =>
      `<span class="${p.k === "cash" ? "cash" : ""}" style="flex-grow:${(p.v / tot).toFixed(4)};--cat:${p.color}"></span>`).join("")}</div>
    <div class="al-keys">${parts.map(p => `<span><i class="${p.k === "cash" ? "cash" : ""}" style="--cat:${p.color}"></i>${esc(p.label)} <b>${cr(p.v)}</b></span>`).join("")}</div>`;
}
function boardRows(t){
  const rows = PERSONAS.map(p => ({name: p.name, style: p.style, says: p.says, v: SimEngine.runPlan(M, p.moves, t).value}));
  rows.push({name: "You", me: true, v: snap.total});
  return rows.sort((a, b) => b.v - a.v);
}
/* each simulated investor's line of thinking waits in the tooltip */
function boardHTML(rows){
  return rows.map(r => `<li class="${r.me ? "me" : ""}"${r.says ? ` title="${esc(r.says)}"` : ""}><b>${esc(r.name)}</b>
    <small>${r.me ? "Your run" : esc(r.style)}</small>
    <div class="bv"><b>${cr(r.v)}</b><em data-sign="${signOf((r.v - START) / START)}">${pctS((r.v - START) / START)}</em></div></li>`).join("");
}
function actsListHTML(){
  const xs = [...st.book.txns].reverse();
  if(!xs.length) return `<li class="none">No trades yet.</li>`;
  return xs.map(x => { const out = x.kind === "round" || x.kind === "buy";
    return `<li><small>${dateOf(x.t)}</small><span>${txText(x)}</span><b data-sign="${out ? "flat" : x.credits > 0 ? "up" : "down"}">${
      out ? MINUS + num(x.credits) : "+" + num(x.credits)} cr</b></li>`; }).join("");
}
function tickPort(force, charts){
  const v = $("#v-port"); if(!v.firstElementChild) return;
  const q = n => v.querySelector(`[data-part="${n}"]`);
  /* the rows (and their buttons) redraw only when a stake or a case's state
     changes; the stage and how full a round is are painted in place */
  patch(q("pos"), IDS.map(id => { const s = snap.cases[id]; return s.status + "/" + Math.round(s.stake.invested) + "/" + Math.round(s.stake.returned) + (s.hold ? "h" : ""); }).join("|") + (snap.cash >= 1), posHTML);
  patch(q("alloc"), IDS.map(id => Math.round(snap.cases[id].value / 5)).join("/") + "/" + Math.round(snap.cash / 5), allocHTML);
  const rows = boardRows(st.t);
  patch(q("board"), rows.map(r => r.name + Math.round(r.v)).join("|"), () => boardHTML(rows));
  patch(q("acts"), st.book.txns.length + "", actsListHTML);
  if(charts) drawChart(v.querySelector('[data-chart="port"]'), portModel());
}

/* ============ results ============ */
let crowdCache = null;
const crowdOf = () => crowdCache || (crowdCache = SimEngine.crowdFinals(M));
const endOf = id => SimEngine.caseAt(M, id, LEN, st.open[id]);
function renderEnd(){
  const v = $("#v-end");
  if(!st.done){
    v.innerHTML = `<div class="rs"><h1 class="pg-title">Results</h1>
      <section class="card rs-wait"><small>Final results in</small><b data-part="wait"></b></section>
      <section class="card"><div class="card-h"><h2>Standings</h2><small>vs ${PERSONAS.length} simulated investors</small></div><ol class="board" data-part="board"></ol></section></div>`;
    tickWait(true);
    return;
  }
  snap = compute();
  const fin = crowdOf(), me = Math.round(snap.total), beat = SimEngine.rankIn(fin, me);
  const judged = SimEngine.judge(M, st.book, LEN, {...SimEngine.crowdOpens(M), ...st.open});
  const badges = badgesOf(judged);
  const impacts = IDS.filter(id => st.book.pos[id] && st.book.pos[id].invested > 0).flatMap(id => endOf(id).impacts.map(e => ({id, e})));
  v.innerHTML = `<div class="rs">
    <section class="rs-hero">
      <div class="rs-eyebrow">Final result</div>
      <div class="rs-big">${num(me)}<small>cr</small></div>
      <p class="rs-line"><b data-sign="${signOf(snap.ret)}">${pctS(snap.ret)}</b> on ${num(START)} credits · better than <b>${Math.round(beat * 100)}%</b> of ${num(fin.length)} simulated investors</p>
      ${badges.length ? `<div class="rs-chips">${badges.map(b => `<span>${I.spark}${esc(b)}</span>`).join("")}</div>` : ""}
      <div class="rs-acts"><button class="btn primary" data-act="again">${I.replay}Play again</button>
        <button class="btn line" data-act="copy">Copy result</button>
        <a class="btn line" href="/">Open LaunchJustice</a></div>
    </section>
    <div class="rs-grid">
      <div>
        <section class="card"><div class="card-h"><h2>Where you finished</h2><small>${num(fin.length)} simulated investors</small></div><div class="hg"></div></section>
        <section class="card"><div class="card-h"><h2>How each case ended</h2></div><div class="rs-cases">${IDS.map(caseEndHTML).join("")}</div></section>
        <section class="card"><div class="card-h"><h2>Account value</h2>${valueLegend()}${tableToggle("port")}</div>
          <div class="lc" data-chart="port"></div></section>
      </div>
      <div>
        <section class="card"><div class="card-h"><h2>Leaderboard</h2></div><ol class="board">${boardHTML(boardRows(LEN))}</ol></section>
        <section class="card"><div class="card-h"><h2>Your calls</h2></div><ul class="moves">${movesOf(judged).join("")}</ul></section>
        <section class="card"><div class="card-h"><h2>What your credits changed</h2></div><ul class="sc-impacts">${impacts.length
          ? impacts.map(({id, e}) => `<li>${I.spark}<span>${esc(e.impact)} <small>${esc(short(id))}</small></span></li>`).join("")
          : `<li class="none">You didn't back a case this time.</li>`}</ul></section>
        <section class="card"><div class="card-h"><h2>Takeaways</h2></div><ul class="shows">
          <li>A case starts only once it is fully funded.</li>
          <li>Every ruling moves the price.</li>
          <li>Hype is not the odds: the most-hyped case lost.</li>
          <li>Trading stakes between backers is a preview. It isn't on the site yet.</li></ul></section>
      </div>
    </div></div>`;
  const hg = v.querySelector(".hg");
  hg.innerHTML = histogram(fin, me, Math.max(300, Math.round(hg.clientWidth || 640)));
  drawChart(v.querySelector('[data-chart="port"]'), portModel());
}
async function copyResult(){
  const fin = crowdOf(), me = Math.round(snap.total), beat = Math.round(SimEngine.rankIn(fin, me) * 100);
  const text = `I turned ${num(START)} credits into ${num(me)} (${pctS(snap.ret)}) in LaunchJustice Live, better than ${beat}% of ${num(fin.length)} simulated investors.`;
  try{ await navigator.clipboard.writeText(text); toast("Result copied."); }catch(e){ toast("Couldn't copy here."); }
}
function caseEndHTML(id){
  const s = endOf(id), p = st.book.pos[id];
  const mine = p && p.invested
    ? `<div class="rs-case-r"><b data-sign="${signOf(p.returned - p.invested)}">${signed(p.returned - p.invested)} cr</b><small>on ${cr(p.invested)}</small></div>`
    : `<div class="rs-case-r"><small>No position</small></div>`;
  return `<div class="rs-case" data-open="${id}" style="--cat:${ccol(id)}">${logo(s.c)}
    <div><h3><button data-open="${id}">${esc(short(id))}</button></h3><small>${esc(outcomeText(s))}</small></div>${mine}</div>`;
}
/* how the crowd finished, one column per 200 credits, with yours dark */
function histogram(fin, me, W=640){
  const H = 200, L = 36, R = 10, T = 26, B = 26, bw = 200;
  const nb = Math.ceil((Math.max(me, fin[fin.length - 1]) + 1) / bw), bins = new Array(nb).fill(0);
  fin.forEach(v => bins[Math.min(nb - 1, Math.floor(v / bw))]++);
  const mx = Math.max(...bins), slot = (W - L - R) / nb, barW = Math.min(24, slot - 2);
  const x = k => L + slot * k + (slot - barW) / 2, y = n => T + (H - T - B) * (1 - n / mx);
  const mine = Math.min(nb - 1, Math.floor(me / bw)), med = fin[Math.floor(fin.length / 2)];
  let g = "";
  [0, Math.round(mx / 2), mx].forEach(n => { g += `<line class="lc-grid" x1="${L}" x2="${W - R}" y1="${y(n).toFixed(1)}" y2="${y(n).toFixed(1)}"/><text class="lc-axis r" x="${L - 6}" y="${(y(n) + 3.5).toFixed(1)}">${n}</text>`; });
  for(let k = 0; k <= nb; k += Math.ceil(nb / 8)) g += `<text class="lc-axis" x="${(L + slot * k).toFixed(1)}" y="${H - 8}" text-anchor="middle">${num(k * bw)}</text>`;
  const mxp = L + slot * med / bw;
  g += `<line class="hg-med" x1="${mxp.toFixed(1)}" x2="${mxp.toFixed(1)}" y1="${T - 10}" y2="${H - B}"/><text class="hg-medlab" x="${(mxp + 4).toFixed(1)}" y="${T - 12}">median ${num(med)}</text>`;
  bins.forEach((n, k) => {
    if(!n) return;
    const h = H - B - y(n), r = Math.min(4, h / 2), x0 = x(k), base = H - B;
    g += `<path class="hg-bar${k === mine ? " you" : ""}" d="M${x0.toFixed(1)} ${base}V${(base - h + r).toFixed(1)}Q${x0.toFixed(1)} ${(base - h).toFixed(1)} ${(x0 + r).toFixed(1)} ${(base - h).toFixed(1)}H${(x0 + barW - r).toFixed(1)}Q${(x0 + barW).toFixed(1)} ${(base - h).toFixed(1)} ${(x0 + barW).toFixed(1)} ${(base - h + r).toFixed(1)}V${base}Z"><title>${n} investors finished with ${num(k * bw)} to ${num((k + 1) * bw - 1)} credits</title></path>`;
  });
  g += `<text class="hg-you" x="${(x(mine) + barW / 2).toFixed(1)}" y="${(y(bins[mine]) - 7).toFixed(1)}" text-anchor="middle">You</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="How ${num(fin.length)} simulated investors finished. You finished with ${num(me)} credits.">${g}</svg>`;
}
/* the person's best and worst calls, a line each */
function movesOf(judged){
  const out = [], li = (cls, icon, html) => `<li class="${cls}">${icon}<span>${html}</span></li>`;
  const what = x => x.kind === "round" ? `${esc(short(x.c))} in the round` : `${esc(short(x.c))} at ${mult(x.price)}`;
  const buys = judged.filter(x => x.kind !== "sell"), sells = judged.filter(x => x.kind === "sell");
  const best = [...buys].sort((a, b) => b.gain - a.gain)[0];
  if(best && best.gain > 0) out.push(li("good", I.up, `<b>Best call:</b> ${what(best)}, <b>${signed(best.gain)} cr</b>`));
  sells.filter(x => x.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 1).forEach(x => out.push(li("good", I.check,
    `<b>Good exit:</b> sold ${esc(short(x.c))} at ${mult(x.price)}, <b>${cr(x.gain)}</b> better than holding`)));
  const worst = [...buys].sort((a, b) => a.gain - b.gain)[0];
  if(worst && worst.gain < 0) out.push(li("bad", I.down, `<b>Toughest call:</b> ${what(worst)}, <b>${signed(worst.gain)} cr</b>`));
  sells.filter(x => x.gain < 0).sort((a, b) => a.gain - b.gain).slice(0, 1).forEach(x => out.push(li("bad", I.down,
    `<b>Sold too soon:</b> ${esc(short(x.c))} at ${mult(x.price)}. It paid ${mult(x.final)}.`)));
  IDS.filter(id => st.closedByMe[id]).forEach(id => out.push(li("info", I.check, `<b>You closed the ${esc(short(id))} round.</b>`)));
  if(st.reach) out.push(li("info", I.people, `<b>Your shares reached ${num(st.reach)} people.</b>`));
  if(!judged.length) out.push(li("info", I.info, `<b>You kept all ${num(START)} credits in cash.</b>`));
  return out;
}
function badgesOf(judged){
  const b = [];
  if(IDS.some(id => st.closedByMe[id])) b.push("Closed a round");
  if(judged.some(x => x.kind === "sell" && x.gain > 0)) b.push("Got out in time");
  if(judged.some(x => x.kind === "buy" && x.gain > 0 && CASE[x.c].events.some(e => e.major && e.mood < 0 && e.t <= x.t && x.t - e.t <= 40))) b.push("Bought the dip");
  if(IDS.every(id => st.book.pos[id] && st.book.pos[id].invested > 0)) b.push("Backed all three");
  return b;
}
function tickWait(force){
  const v = $("#v-end"), w = v.querySelector('[data-part="wait"]');
  if(!w) return;
  const txt = st.started ? mmss((LEN - st.t) / st.speed) : "Clock not started";
  if(w.textContent !== txt) w.textContent = txt;
  const rows = boardRows(st.t);
  patch(v.querySelector('[data-part="board"]'), rows.map(r => r.name + Math.round(r.v)).join("|"), () => boardHTML(rows));
}

/* ============ breaking: the big moments ============ */
let momentE = null;
function showMoment(e, live){
  const el = $("#moment"), id = e.c, c = CASE[id];
  if(clip.slot && el.contains(clip.slot)) unmountClip();
  momentE = e;
  el.style.setProperty("--cat", ccol(id));
  el.innerHTML = `<div class="mo-clip">${slotHTML(c, e.embed)}<button class="mo-expand" data-mo="watch" aria-label="Watch the clip full screen"></button>
      <button class="sound" data-sound aria-pressed="false">${I.muted}<span>Tap for sound</span></button></div>
    <div class="mo-body">
      <div class="mo-top"><span class="mo-live${live ? "" : " replay"}">${live ? "Breaking" : "Replay"}</span>
        <span class="mo-case"><span class="dot"></span>${esc(short(id))}</span><span>${dateOf(e.t)} · ${esc(e.tag)}</span></div>
      <h3 class="mo-title">${esc(e.title)}</h3>
      <p class="mo-text">${esc(e.body)}</p>
      ${fxChips(e)}
      <div data-part="mo-round"></div>
      <div class="mo-mine" data-part="mo-mine"></div>
      <div class="mo-acts" data-part="mo-acts"></div>
    </div>
    <button class="mo-x" data-mo="close" aria-label="Close">${I.x}</button>`;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  say(`${short(id)}: ${e.title}`);
  if(!REDUCED) mountClip(el.querySelector(".slot"), e.embed, clip.sound);
  applySound();
  if(live && st.set.pauseMoments){ playing = false; save(); renderBarState(); }
  tickMoment();
}
$("#moment").addEventListener("click", ev => {
  const e = momentE; if(!e) return;
  const id = e.c, c = CASE[id];
  if(ev.target.closest("[data-sound]")){
    clip.sound = !clip.sound;
    if(!clip.slot && !NOCLIPS) mountClip($("#moment .slot"), e.embed, clip.sound);
    applySound();
    return;
  }
  const a = ev.target.closest("[data-mo]");
  if(!a) return;
  const k = a.dataset.mo;
  if(k === "close") hideMoment();
  if(k === "watch") openPlayer(e);
  if(k === "in") openTrade(id, "in");
  if(k === "out") openTrade(id, "out");
  if(k === "case"){ hideMoment(); openCase(id); }
  if(k === "port"){ hideMoment(); go("port"); }
  if(k === "go") setPlaying(true);
  if(k === "close-round"){
    const need = Math.ceil(c.target - snap.cases[id].raised);
    const tx = invest(id, Math.min(need, snap.cash));
    if(tx && !st.closedByMe[id]) toast(`${I.check}<span>Bought <b>${cr(tx.credits)}</b> of ${esc(short(id))} in the round.</span>`);
  }
});
function tickMoment(){
  const el = $("#moment"), e = momentE;
  if(!e || !snap) return;
  const id = e.c, s = snap.cases[id], c = CASE[id], q = n => el.querySelector(`[data-part="${n}"]`);
  const need = Math.max(0, Math.ceil(c.target - s.raised)), cash = snap.cash >= 1;
  const closing = e.closeRound && s.status === "raising";
  patch(q("mo-round"), closing ? "r" + need : "-", () => closing
    ? `<div class="mo-close-round"><b>${num(need)} cr to go</b><div class="meter"><i data-w="${id}"></i></div></div>` : "");
  patch(q("mo-mine"), s.hold ? "h" : s.stake.invested ? "p" + Math.round(s.stake.returned) : "n", () => s.hold
    ? `Your position <b data-v="value:${id}"></b> <em data-v="plpct:${id}"></em>`
    : s.stake.invested ? `Closed: <b data-sign="${signOf(s.pl)}">${signed(s.pl)} cr</b>` : "");
  patch(q("mo-acts"), [s.status, s.hold, cash, playing, closing && need, snap.cash >= need].join("/"), () => {
    const resume = !playing && st.started && !st.done ? `<button class="btn line" data-mo="go">${I.play}Continue</button>` : "";
    const open = `<button class="btn line" data-mo="case">View case</button>`;
    if(s.status === "raising") return (closing && cash
      ? `<button class="btn primary" data-mo="close-round">${snap.cash >= need ? `Close the round · ${num(need)} cr` : `Buy ${cr(snap.cash)}`}</button>`
      : `<button class="btn primary" data-mo="in"${cash ? "" : " disabled"}>Buy</button>`) + resume + open;
    if(s.live) return `<button class="btn primary" data-mo="in"${cash ? "" : " disabled"}>Buy</button>${
      s.hold ? `<button class="btn line" data-mo="out">Sell</button>` : ""}${resume}${open}`;
    return `${resume}<button class="btn line" data-mo="port">Portfolio</button>${open}`;
  });
  paint(el);
}
function hideMoment(){
  const el = $("#moment");
  if(clip.slot && el.contains(clip.slot)) unmountClip();
  el.classList.remove("on");
  momentE = null;
}

/* ============ the player ============
   One clip, full screen, with its moment beside it. The clock holds while
   it is open, unless the presenter turned that off. */
function openPlayer(e){
  const el = $("#splayer"), c = CASE[e.c];
  if(clip.slot) unmountClip();
  el.innerHTML = `<button class="spl-close" aria-label="Close">${I.x}</button>
    ${st.set.pauseClips && playing ? `<span class="spl-paused">${I.pause}Clock paused</span>` : ""}
    <div class="spl-frame" style="--cat:${ccol(e.c)}">${slotHTML(c, e.embed)}<button class="sound" data-sound aria-pressed="false">${I.muted}<span>Tap for sound</span></button></div>
    <div class="spl-info">${metaRow(e.c, e.t, `<span>· ${esc(e.tag)}</span>`)}<h2>${esc(e.title)}</h2><p>${esc(e.body)}</p></div>`;
  el.classList.add("on");
  el.querySelector(".spl-close").onclick = closePlayer;
  el.querySelector(".spl-close").focus();
  el.querySelector("[data-sound]").onclick = () => { clip.sound = !clip.sound; applySound(); };
  clip.sound = true;
  mountClip(el.querySelector(".slot"), e.embed, true);
  applySound();
  if(st.set.pauseClips) hold("clip", true);
}
function closePlayer(){
  const el = $("#splayer");
  if(!el.classList.contains("on")) return;
  if(clip.slot && el.contains(clip.slot)) unmountClip();
  el.classList.remove("on"); el.innerHTML = "";
  clip.sound = false;
  hold("clip", false);
  if(momentE && !REDUCED) mountClip($("#moment .slot"), momentE.embed, false);
}

/* ============ sheets ============ */
const sheet = $("#sheet"), scrim = $("#scrim");
let sheetOpen = false, sheetTick = null, sheetKind = "", lastFocus = null;
function openSheet(html, kind, tickFn){
  if(!sheetOpen) lastFocus = document.activeElement;
  sheet.className = "sheet";
  sheet.innerHTML = '<div class="grip"></div>' + html;
  sheet.classList.add("on"); scrim.classList.add("on");
  sheetOpen = true; sheetKind = kind; sheetTick = tickFn || null;
  setTimeout(() => { const f = sheet.querySelector("input:not([type=range]),button:not([disabled])"); f && f.focus(); }, 220);
}
/* Escape or the scrim hands focus back to whatever opened the sheet. A
   completed trade does not: the presenter's next Space should play the
   clock, not reopen the ticket from the Buy button that opened it. */
function closeSheet(done){
  if(!sheetOpen) return;
  sheet.classList.remove("on"); scrim.classList.remove("on");
  sheetOpen = false; sheetTick = null; sheetKind = "";
  if(done === true){ const a = document.activeElement; if(a && a.blur) a.blur(); }
  else if(lastFocus && lastFocus.focus) lastFocus.focus();
}
scrim.addEventListener("click", closeSheet);

/* Buying and selling are one order ticket, and its numbers stay live while
   it is open: the clock does not stop for anyone, so the price on the
   button is the price you get. */
function openTrade(id, mode){
  const c = CASE[id];
  let amt = 0, share = .5, custom = false, shape = "";
  const quote = () => {
    const s = snap.cases[id];
    if(mode === "out") return quoteSell(s);
    const out = sheet.querySelector('[data-q="out"]');
    if(!out) return;
    const p = s.status === "raising" ? 1 : s.price, units = amt / p, lose = Math.max(0, 1 - s.odds.win - s.odds.settle);
    const rows = [["win", "Wins", units * c.winMult, s.odds.win], ["settle", "Settles", units * c.settleMult, s.odds.settle], ["lose", "Loses", 0, lose]];
    out.innerHTML = `<div class="ostrip">${rows.map(([k, l, v, pr]) => `<div class="os os-${k}"><span class="os-bar" style="--p:${Math.round(pr * 100)}%"></span>
      <span class="os-l">${l}</span><span class="os-p">${Math.round(pr * 100)}%</span><b class="os-v">${cr(v)}</b>
      <span class="os-g">${amt && v ? pctS(v / amt - 1) : ""}</span></div>`).join("")}</div>`;
    sheet.querySelectorAll('[data-q="price"]').forEach(n => n.textContent = mult(p));
    sheet.querySelector('[data-q="left"]').textContent = cr(snap.cash - amt);
    const go1 = $("#tGo");
    go1.textContent = amt ? `Buy for ${cr(amt)}` : "Choose an amount";
    go1.disabled = !amt;
  };
  const draw = () => {
    const s = snap.cases[id];
    shape = s.status;
    if(mode === "out") return drawSell(s);
    const raising = s.status === "raising";
    const max = Math.max(0, Math.floor(Math.min(snap.cash, raising ? c.target - s.raised : Infinity)));
    amt = Math.min(custom ? amt : (amt || Math.min(250, max)), max);
    openSheet(`<h2 id="sheetTitle">${s.ended ? `${esc(short(id))} has ended` : `Buy ${esc(short(id))}`}</h2>
      ${s.ended ? `<p class="hint">There is nothing left to buy.</p>` : `
      <p class="sub">${raising ? `Funding round, <b>${Math.floor(s.pct * 100)}%</b> funded` : "From a backer who is selling"}</p>
      <label class="f" id="amtLbl">Amount</label>
      <div class="amts" role="group" aria-labelledby="amtLbl">${[100, 250, 500].map(a => `<button data-a="${a}" aria-pressed="false"${a > max ? " disabled" : ""}>${a}</button>`).join("")}<button data-a="max" aria-pressed="false"${max < 1 ? " disabled" : ""}>Max</button></div>
      <input class="rng" type="range" min="0" max="${max}" step="10" value="${amt}" aria-label="Credits">
      <div class="money"><span>cr</span><input class="inp" id="tAmt" inputmode="numeric" value="${amt || ""}" aria-label="Credits to put in" style="padding-left:40px"></div>
      <div class="f">If the case&hellip;</div>
      <div data-q="out"></div>
      <dl class="qt"><dt>Price per credit</dt><dd data-q="price">${mult(raising ? 1 : s.price)}</dd><dt>Cash after</dt><dd data-q="left"></dd></dl>
      <div class="err" id="tErr"></div>
      <button class="btn primary" id="tGo"></button>
      <p class="hint">Simulation · virtual credits</p>`}`, "trade", live);
    if(s.ended) return;
    const inp = $("#tAmt"), rng = sheet.querySelector(".rng");
    const set = (v, src) => {
      amt = Math.max(0, Math.min(max, Math.floor(+v || 0)));
      if(src !== "inp") inp.value = amt || "";
      if(src !== "rng") rng.value = amt;
      sheet.querySelectorAll("[data-a]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.a === "max" ? amt === max : +b.dataset.a === amt)));
      quote();
    };
    sheet.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { custom = true; set(b.dataset.a === "max" ? max : +b.dataset.a); });
    rng.oninput = () => { custom = true; set(rng.value, "rng"); };
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); custom = true; set(inp.value, "inp"); };
    $("#tGo").onclick = () => {
      if(!(amt >= 1)){ $("#tErr").textContent = "Choose an amount."; return; }
      const tx = invest(id, amt);
      if(!tx){ $("#tErr").textContent = snap.cases[id].ended ? "This case has just ended." : "That didn't go through. Try a smaller amount."; return; }
      closeSheet(true);
      if(tx.kind === "round" && !st.closedByMe[id]) toast(`${I.check}<span>Bought <b>${cr(tx.credits)}</b> of ${esc(short(id))} in the round.</span>`);
      else if(tx.kind === "buy") toast(`${I.check}<span>Bought <b>${cr(tx.credits)}</b> of ${esc(short(id))} at ${mult(tx.price)}.</span>`);
    };
    set(amt);
  };
  const drawSell = s => {
    openSheet(`<h2 id="sheetTitle">Sell ${esc(short(id))}</h2>
      ${!s.live || !s.hold ? `<p class="hint">${s.ended ? "This case has ended." : "You don't own this case."}</p>` : `
      <p class="sub">To a buyer on the waitlist, less a ${Math.round(SCENARIO.exitDiscount * 100)}% early-exit fee</p>
      <label class="f" id="shLbl">Amount</label>
      <div class="amts" role="group" aria-labelledby="shLbl" style="grid-template-columns:repeat(3,1fr)">${[[.25, "25%"], [.5, "50%"], [1, "All"]].map(([v, l]) => `<button data-s="${v}" aria-pressed="${v === share}">${l}</button>`).join("")}</div>
      <dl class="qt"><dt>Market price</dt><dd data-q="mkt"></dd><dt>You get per credit</dt><dd data-q="bid"></dd><span class="sep"></span>
        <dt>Proceeds</dt><dd data-q="get"></dd><dt>Cost basis</dt><dd data-q="cost"></dd></dl>
      <button class="btn primary" id="tGo" style="margin-top:14px"></button>`}`, "trade", live);
    if(!s.live || !s.hold) return;
    sheet.querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
      share = +b.dataset.s;
      sheet.querySelectorAll("[data-s]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      quote();
    });
    $("#tGo").onclick = () => {
      const tx = sell(id, share);
      if(!tx){ toast("That didn't go through."); return; }
      closeSheet(true);
      toast(`${I.check}<span>Sold for <b>${cr(tx.credits)}</b>.</span>`);
    };
    quote();
  };
  const quoteSell = s => {
    const get1 = sheet.querySelector('[data-q="get"]');
    if(!get1) return;
    const get = Math.round(s.stake.units * share * s.bid), cost = s.stake.basis * share;
    sheet.querySelector('[data-q="mkt"]').textContent = mult(s.price);
    sheet.querySelector('[data-q="bid"]').textContent = mult(s.bid);
    get1.textContent = cr(get);
    sheet.querySelector('[data-q="cost"]').textContent = cr(cost);
    $("#tGo").textContent = `Sell for ${cr(get)}`;
  };
  /* a round filling or a case ending under an open sheet changes what the
     sheet is for, so it redraws; otherwise only the numbers move */
  const live = () => { if(snap.cases[id].status !== shape) draw(); else quote(); };
  draw();
}

function openSettings(){
  openSheet(`<h2 id="sheetTitle">Presenter settings</h2>
    <label class="f">Run length</label>
    <div class="speeds">${SPEEDS.map(s => `<button data-sp="${s}" aria-pressed="${s === st.speed}">${speedLabel(s)}<small>${mmss(LEN / s)}</small></button>`).join("")}</div>
    <div class="set-row"><div><b>Pause on big news</b><small>The clock waits until you press Continue.</small></div>
      <input type="checkbox" class="tgl" id="setMom"${st.set.pauseMoments ? " checked" : ""} aria-label="Pause on big news"></div>
    <div class="set-row"><div><b>Pause during clips</b><small>A full-screen clip holds the clock.</small></div>
      <input type="checkbox" class="tgl" id="setClip"${st.set.pauseClips ? " checked" : ""} aria-label="Pause during clips"></div>
    <div class="set-row"><div><b>Skip ahead</b><small data-q="next"></small></div><button class="btn line" id="setNext" style="width:auto;padding:9px 14px">${I.next}Next</button></div>
    <button class="btn line" id="setKeys" style="width:100%;margin-top:12px">${I.key}Keyboard shortcuts</button>
    <button class="btn line" id="setRestart" style="width:100%;margin-top:8px">${I.replay}Restart</button>`, "settings", () => {
      const n = upcoming(), el = sheet.querySelector('[data-q="next"]');
      const t = st.done ? "The run is over." : n ? `Next: ${dateOf(n.t)}, ${n.label}` : "Straight to the end.";
      if(el && el.textContent !== t) el.textContent = t;
    });
  sheet.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => setSpeed(+b.dataset.sp));
  $("#setMom").onchange = e => { st.set.pauseMoments = e.target.checked; save(); };
  $("#setClip").onchange = e => { st.set.pauseClips = e.target.checked; save(); };
  $("#setNext").onclick = () => { closeSheet(true); skip(); };
  $("#setKeys").onclick = openKeys;
  $("#setRestart").onclick = openRestart;
  sheetTick();
}
function openKeys(){
  openSheet(`<h2 id="sheetTitle">Keyboard shortcuts</h2>
    <ul class="keys"><li><kbd>Space</kbd>Play or pause</li><li><kbd>N</kbd>Next event</li>
    <li><kbd>1</kbd><kbd>2</kbd><kbd>4</kbd>Speed, and <kbd>0</kbd> for half</li><li><kbd>C</kbd>Cases</li><li><kbd>P</kbd>Portfolio</li>
    <li><kbd>Esc</kbd>Close</li></ul>
    <button class="btn primary" id="kOk" style="margin-top:16px">Got it</button>`, "keys");
  $("#kOk").onclick = closeSheet;
}
function openRestart(){
  openSheet(`<h2 id="sheetTitle">Start over?</h2><p class="sub">Back to ${dateOf(0)} with ${num(START)} credits.</p>
    <button class="btn primary" id="rGo">${I.replay}Restart</button>
    <button class="btn line" id="rNo" style="width:100%;margin-top:8px">Cancel</button>`, "restart");
  $("#rGo").onclick = () => { closeSheet(true); restart(); toast("<span>Fresh start. The rounds are open.</span>"); };
  $("#rNo").onclick = closeSheet;
}

/* ============ navigation ============ */
/* each number key is the speed it names; 0 is half speed */
const KEY_SPEED = {"0": .5, "1": 1, "2": 2, "4": 4};
let view = "home", prevView = "home";
function go(v){
  if(v !== "case"){ prevView = v; caseId = null; $("#v-case").innerHTML = ""; }
  view = v;
  $("#shell").dataset.view = v;
  $$(".sim .view").forEach(el => el.classList.toggle("on", el.id === "v-" + v));
  $$("#nav button[data-go]").forEach(b => b.dataset.go === v || (v === "case" && b.dataset.go === prevView)
    ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  if(v === "home" && !$("#v-home .home")) renderHome();
  if(v === "port") renderPort();
  if(v === "end") renderEnd();
  tick(performance.now(), true);
}
$$("#nav button[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));

/* one handler for everything clickable in the views. A whole case row
   opens its case, so a press on a disabled button in it does nothing. */
function act(e){
  if(e.target.closest("button:disabled")) return;
  const cl = e.target.closest("[data-clip]");
  if(cl){ const ev = EVENTS.find(x => x.id === cl.dataset.clip); if(ev) openPlayer(ev); return; }
  if(e.target.closest("[data-back]")){ go(prevView || "home"); return; }
  const g = e.target.closest("[data-go]");
  if(g){ go(g.dataset.go); return; }
  const a = e.target.closest("[data-act]");
  if(a){
    const id = a.dataset.id || caseId;
    switch(a.dataset.act){
      case "start": setPlaying(true); break;
      case "in": openTrade(id, "in"); break;
      case "out": openTrade(id, "out"); break;
      case "share": share(id); break;
      case "again": case "restart": openRestart(); break;
      case "copy": copyResult(); break;
      case "keys": openKeys(); break;
      case "more": feedOpen = true; renderFeed(true); break;
    }
    return;
  }
  const t = e.target.closest("[data-table-for]");
  if(t){ t.setAttribute("aria-pressed", String(t.getAttribute("aria-pressed") !== "true")); tick(performance.now(), true); return; }
  const o = e.target.closest("[data-open]");
  if(o) openCase(o.dataset.open);
}
$(".panes").addEventListener("click", act);

document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if(tag === "input" || tag === "textarea") return;
  if(e.key === "Escape"){
    if($("#splayer").classList.contains("on")) closePlayer();
    else if(sheetOpen) closeSheet();
    else if(momentE) hideMoment();
    return;
  }
  if(sheetOpen || $("#splayer").classList.contains("on") || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.key === " " && tag !== "button" && tag !== "a"){ e.preventDefault(); st.done ? go("end") : setPlaying(!playing); }
  else if(e.key === "n" || e.key === "N" || e.key === "ArrowRight"){ e.preventDefault(); skip(); }
  else if(KEY_SPEED[e.key]) setSpeed(KEY_SPEED[e.key]);
  else if(e.key === "p" || e.key === "P") go("port");
  else if(e.key === "c" || e.key === "C") go("home");
  else if(e.key === "?") openKeys();
});

addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") save(); });

/* ============ start ============ */
(function boot(){
  if(flags.has("jump")){
    const j = Math.max(0, Math.min(LEN, parseFloat(flags.get("jump")) || 0));
    if(j > st.t){ st.started = true; advance(j, true); save(); }
  }
  /* one-shot flags come off the address, so a refresh doesn't repeat them */
  if(flags.has("reset") || flags.has("jump")){
    const q = location.search.slice(1).split("&").filter(p => p && !/^(reset|jump)(=|$)/.test(p)).join("&");
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
  rebuildFeed();
  snap = compute();
  renderBar();
  renderHome();
  renderWallet(true);
  go(st.done ? "end" : "home");
  const linked = (location.hash.match(/^#case=([\w-]+)/) || [])[1];
  if(linked && CASE[linked]) openCase(linked);
  if(flags.has("autoplay") && !st.done) setPlaying(true);
  requestAnimationFrame(t => { lastNow = t; frame(t); });
})();
