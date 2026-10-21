/* =====================================================================
   LaunchJustice admin: analytics
   ---------------------------------------------------------------------
   /admin/#/analytics, and /admin/#/analytics/<case> for one case.

   The numbers come from admin/analytics-data.js, which lays real tracked
   activity (the `events` table, real pledges and comments) over a demo
   history built from each case's own figures. "Demo history" switches the
   baseline off, which is how to see that the real tracking works.

   What the page is for, top to bottom:
     how the platform is doing      the KPI row and money per day
     which cases are working        the leaderboard and what stands out
     which filled fast, which won't the funding race and days to 50%
     attention against money        the quadrant: watched-and-funded, watched-
                                    not-funded, funded quietly, not landing
     the clips                      which ones hold people, where they drop
                                    off, which ones send people to the case
     the path to an investment      clip plays to visits to invest to invested
     what is happening right now    the real activity feed

   Charts follow the site's own charts: hand-built SVG, thin marks,
   hairline grids, one axis, colour follows the case, text in ink. Every
   chart has a Table button with the same numbers. Loaded before admin.js,
   so nothing here touches admin.js globals until it is called.
   ===================================================================== */

const AN = {period: 30, demo: true, data: null, loadedAt: 0, sort: {key: "raised", dir: -1}, clip: null, allClips: false, seq: 0};
const AN_PERIODS = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]];

/* ---------- formatting ---------- */
const fUsd = n => { n = Math.round(n || 0);
  return n >= 1e6 ? "$" + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M"
       : n >= 1e3 ? "$" + (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : "$" + n; };
const fUsdC = n => (n || 0) < 10 ? "$" + (n || 0).toFixed(2) : fUsd(n);
const fN = n => { n = Math.round(n || 0);
  return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e4 ? Math.round(n / 1e3) + "k"
       : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(n); };
const fPct = x => { const v = (x || 0) * 100; return (v > 0 && v < 10 ? v.toFixed(1) : Math.round(v)) + "%"; };
const fDur = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const fHours = s => { const h = (s || 0) / 3600; return h >= 1000 ? fN(h) + " h" : h >= 10 ? Math.round(h) + " h" : h.toFixed(1) + " h"; };
const fSpan = d => d == null ? "—" : d < 1 ? "today" : d < 14 ? Math.round(d) + " days" : d < 60 ? Math.round(d / 7) + " wks"
  : d < 730 ? Math.round(d / 30.4) + " mo" : (d / 365).toFixed(1) + " yrs";
const dayLabel = (iso, long) => new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {month: "short", day: "numeric", ...(long ? {year: "numeric"} : {}), timeZone: "UTC"});
const sColor = c => `var(--s-${CATS[c.cat] ? c.cat : "other"})`;   /* colour follows the case's category */
const sum = (a, f = 0, t = a.length - 1) => { let s = 0; for(let i = Math.max(0, f); i <= t; i++) s += a[i] || 0; return s; };

/* "up is good" decides the colour, the arrow is always the direction */
function delta(cur, prev, upGood = true){
  if(!AN.period) return "";
  if(!prev) return cur ? `<span class="dl new">new</span>` : "";
  const r = (cur - prev) / prev; if(Math.abs(r) < .005) return `<span class="dl flat">±0%</span>`;
  const good = (r > 0) === upGood;
  return `<span class="dl ${good ? "up" : "down"}">${r > 0 ? "▲" : "▼"} ${Math.abs(r) >= 10 ? Math.round(r) + "×" : fPct(Math.abs(r))}</span>`;
}
const TREND = {accelerating: ["good", "▲", "Accelerating"], steady: ["neutral", "●", "Steady"], slowing: ["warn", "▼", "Slowing"],
               stalled: ["bad", "■", "Stalled"], new: ["info", "✦", "New"]};
const trendPill = t => { const [tone, ic, label] = TREND[t] || TREND.steady; return `<span class="tp tp-${tone}"><i>${ic}</i>${label}</span>`; };

/* ---------- data ---------- */
async function loadAnalytics(force){
  if(AN.data && !force) return AN.data;
  const [a, p, c] = await Promise.all([
    sb.rpc("admin_analytics"),
    sb.rpc("admin_pledges"),
    sb.from("comments").select("case_id, created_at, name").order("created_at", {ascending: false}).limit(5000)
  ]);
  if(a.error) throw a.error;
  AN.data = {real: a.data || null, pledges: p.data || [], comments: c.data || []};
  AN.loadedAt = Date.now();
  return AN.data;
}
function anModel(){
  const live = entries().filter(e => e.live);
  const listed = {};
  live.forEach(e => { if(e.row && !e.demo) listed[e.id] = e.row.created_at; });
  return LJ_ANALYTICS.build({cases: live.map(e => e.c), listed, demo: AN.demo, cats: CATS,
    real: AN.data.real, pledges: AN.data.pledges, comments: AN.data.comments});
}
function anRange(model){
  const to = model.days.length - 1;
  return {from: AN.period ? Math.max(0, to - AN.period + 1) : 0, to};
}

/* ---------- page ---------- */
async function pageAnalytics(caseId){
  const m = shell("analytics");
  if(!AN.data) m.innerHTML = `<div class="a-inner">${head("Analytics", "")}<div class="loading"><span class="spin"></span></div></div>`;
  try{ await loadAnalytics(); }
  catch(e){ m.innerHTML = `<div class="a-inner">${head("Analytics", "")}<div class="empty-card"><b>Couldn't load activity</b>${esc(e.message || String(e))}</div></div>`; return; }
  if(!$("#main") || !location.hash.startsWith("#/analytics")) return;
  drawAnalytics(caseId);
}

function drawAnalytics(caseId){
  const m = $("#main"), model = anModel(), {from, to} = anRange(model);
  const sm = LJ_ANALYTICS.summarize(model, from, to);
  const one = caseId && sm.cases.find(x => x.id === caseId);
  if(caseId && !one){ m.innerHTML = `<div class="a-inner"><div class="empty-card"><b>No live case called “${esc(caseId)}”</b><a href="#/analytics">Back to analytics</a></div></div>`; return; }
  const y = window.scrollY;
  m.innerHTML = `<div class="a-inner an">${filters(model, one)}${one ? caseView(model, sm, one, from, to) : overview(model, sm, from, to)}</div>`;
  window.scrollTo(0, y);
  wireAnalytics(model, sm, one, from, to);
}

/* one row of filters above everything they scope */
function filters(model, one){
  const n = model.realEvents || 0, ago = Math.max(0, Math.round((Date.now() - AN.loadedAt) / 6e4));
  return `<div class="a-head an-head"><div>
      ${one ? `<a class="an-back" href="#/analytics">${I.back}All cases</a>` : ""}
      <h1>${one ? esc(one.title) : "Analytics"}</h1>
      <p>${one ? `Listed ${dayLabel(model.days[one.listedIdx], true)} · ${esc(one.c.ngo || "")}` : "Which cases are working, which are stuck, and the clips in between."}</p></div></div>
    <div class="an-bar">
      <div class="an-seg" role="group" aria-label="Period">${AN_PERIODS.map(([d, t]) =>
        `<button data-period="${d}" aria-pressed="${AN.period === d}">${t}</button>`).join("")}</div>
      <label class="an-demo"><input type="checkbox" id="anDemo"${AN.demo ? " checked" : ""}>Include demo history</label>
      <span class="grow"></span>
      <span class="an-live"><i class="${n ? "on" : ""}"></i>${n ? `${fN(n)} real events tracked` : "No real events yet"}${model.realPledges ? ` · ${model.realPledges} real pledges` : ""}</span>
      <button class="btn line sm" id="anRefresh" title="Fetched ${ago ? ago + " min ago" : "just now"}">Refresh</button>
    </div>
    ${AN.demo ? "" : `<p class="an-note">Showing real activity only: what the site has recorded since tracking went live. Turn demo history back on for the full picture.</p>`}`;
}

/* ---------- overview ---------- */
function overview(model, sm, from, to){
  const P = sm.platform, per = sm.range.days, cmp = AN.period ? `vs previous ${per} days` : "";
  const tile = (label, v, d, sub, spark, hl) => `<div class="tile an-tile${hl ? " hl" : ""}"><small>${label}</small><b>${v}</b>
    <span class="an-sub">${d}${d && sub ? " " : ""}${sub ? `<em>${sub}</em>` : ""}</span>${spark ? `<span class="an-spark">${sparkSvg(spark, hl, false, true)}</span>` : ""}</div>`;
  const insights = LJ_ANALYTICS.insights(sm);
  const clips = LJ_ANALYTICS.clipStats(model, null, from, to);
  if(!AN.clip || !clips.some(c => c.caseId + ":" + c.key === AN.clip)) AN.clip = clips[0] ? clips[0].caseId + ":" + clips[0].key : null;
  return `
  <div class="tiles an-tiles">
    ${tile("Invested", fUsd(P.amount), delta(P.amount, P.prev.amount), cmp, sm.series.amount, true)}
    ${tile("New backers", fN(P.pledges), delta(P.pledges, P.prev.pledges), "", sm.series.pledges)}
    ${tile("Case visits", fN(P.visits), delta(P.visits, P.prev.visits), "", sm.series.visits)}
    ${tile("Clip plays", fN(P.plays), delta(P.plays, P.prev.plays), "", sm.series.plays)}
    ${tile("Watch time", fHours(P.watchSec), delta(P.watchSec, P.prev.watchSec), "", sm.series.watchSec)}
    ${tile("Visit to investment", fPct(P.conversion), delta(P.conversion, P.prev.conversion), `${fUsdC(P.dollarsPerVisitor)} per visitor`)}
  </div>

  ${card("money", "Money invested per day", `By case, ${rangeText(sm)}. Hover a column for the split.`, legend(sm.cases), "", "an-wide")}

  <div class="an-cols">
    <section class="card an-card"><div class="an-ch"><h3>What stands out</h3></div>
      <ul class="ins">${insights.map(insightLi).join("") || `<li class="muted">Nothing unusual in this period.</li>`}</ul></section>
    ${card("quad", "Attention against money", `Minutes spent on each case (clips plus case page) against dollars invested, per day over ${rangeText(sm)}. The lines are the medians.`)}
  </div>

  <h2 class="a-h">Cases <small>Click a row for that case on its own. Click a heading to sort.</small></h2>
  <div class="tbl-wrap" id="anTable">${caseTable(sm)}</div>

  <div class="an-cols an-cols-race">
    ${card("race", "Funding race", "Share of goal raised against days since listing. The further left a line climbs, the faster that case filled.", legend(sm.cases))}
    <section class="card an-card"><div class="an-ch"><h3>Days to half funded</h3></div>
      <p class="an-cs">How long each case took to raise 50% of its goal. Cases still short show where they are now.</p>
      ${halfBars(sm)}</section>
  </div>

  <h2 class="a-h">Clips <small>${fN(clips.reduce((s, c) => s + c.plays, 0))} plays in ${rangeText(sm)}. Click a clip to see where viewers stop.</small></h2>
  <div class="tbl-wrap" id="anClips">${clipTable(clips)}</div>
  <div class="an-cols">
    ${card("ret", "Where viewers stop", "")}
    ${card("funnel", "From clip to investment", `Everyone on the platform, ${rangeText(sm)}.`)}
  </div>

  <div class="an-cols">
    ${card("sources", "Where case visits come from", `Every case visit, ${rangeText(sm)}.`)}
    <section class="card an-card"><div class="an-ch"><h3>Live activity</h3></div>
      <p class="an-cs">Real events as they arrive, newest first. Demo history never shows here.</p>
      <div class="an-feed" id="anFeed">${feed(model)}</div></section>
  </div>`;
}

const rangeText = sm => AN.period ? `the last ${sm.range.days} days` : `all ${fN(sm.range.days)} days`;

/* a chart card with a Table twin: the chart is drawn into .an-plot once the
   card is on the page, at the card's real width */
function card(id, title, sub, extra = "", table = "", cls = ""){
  return `<section class="card an-card ${cls}" data-card="${id}">
    <div class="an-ch"><h3 data-title>${title}</h3><button class="an-tbtn" data-tbl aria-pressed="false">Table</button></div>
    ${sub ? `<p class="an-cs" data-sub>${sub}</p>` : ""}${extra}
    <div class="an-plot" data-plot="${id}"></div><div class="an-table" data-table="${id}" hidden>${table}</div></section>`;
}
const legend = cs => `<div class="an-legend">${cs.map(c =>
  `<span><i style="background:${sColor(c.c)}"></i>${esc(short(c.title, 34))}</span>`).join("")}</div>`;
const short = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

const insightIcon = {good: "▲", warn: "!", info: "i"};
const insightLi = x => `<li class="ins-${x.tone}"><span class="ins-ic">${insightIcon[x.tone] || "i"}</span><div>
  <b>${esc(x.title)}</b><p>${esc(x.text)}</p>${x.caseId ? `<a href="#/analytics/${encodeURIComponent(x.caseId)}">See the case</a>` : ""}</div></li>`;

/* ---------- the case leaderboard ---------- */
const COLS = [
  ["title", "Case", c => c.title, "l"],
  ["fundedPct", "Funded", c => c.fundedPct],
  ["raised", "Invested", c => c.totals.amount],
  ["pledges", "Backers", c => c.totals.pledges],
  ["visits", "Visits", c => c.totals.visits],
  ["conversion", "Converts", c => c.totals.conversion],
  ["avgTime", "Time on page", c => c.totals.avgTimeSec],
  ["watch", "Watch time", c => c.totals.watchSec],
  ["momentum", "Last 14 days", c => c.momentum == null ? -1 : c.momentum],
  ["eta", "Fully funded in", c => c.fundedPct >= 1 ? -1 : c.etaDays == null ? 1e9 : c.etaDays]
];
function caseTable(sm){
  const col = COLS.find(c => c[0] === AN.sort.key) || COLS[2];
  const rows = [...sm.cases].sort((a, b) => { const x = col[2](a), y = col[2](b);
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * AN.sort.dir; });
  return `<table class="tbl an-tbl"><thead><tr>${COLS.map(([k, t, , al]) =>
    `<th class="${al ? "" : "num"}"><button data-sort="${k}" aria-sort="${AN.sort.key === k ? (AN.sort.dir < 0 ? "descending" : "ascending") : "none"}">${t}${
      AN.sort.key === k ? (AN.sort.dir < 0 ? " ↓" : " ↑") : ""}</button></th>`).join("")}</tr></thead><tbody>
    ${rows.map(c => { const t = c.totals;
      return `<tr data-go="${esc(c.id)}" tabindex="0">
      <td><span class="an-case"><i style="background:${sColor(c.c)}"></i><span><a href="#/analytics/${encodeURIComponent(c.id)}">${esc(short(c.title, 46))}</a>
        <small>${c.daysLive} days live</small></span></span></td>
      <td class="num"><span class="an-meter"><i style="width:${Math.min(100, c.fundedPct * 100).toFixed(1)}%"></i></span>${fPct(c.fundedPct)}</td>
      <td class="num"><b>${fUsd(t.amount)}</b><br>${delta(t.amount, c.prev.amount)}</td>
      <td class="num">${fN(t.pledges)}</td>
      <td class="num">${fN(t.visits)}</td>
      <td class="num">${fPct(t.conversion)}</td>
      <td class="num">${fDur(t.avgTimeSec)}</td>
      <td class="num">${fHours(t.watchSec)}</td>
      <td class="num"><span class="an-mom">${sparkSvg(c.spark)}${trendPill(c.trend)}</span></td>
      <td class="num">${c.fundedPct >= 1 ? `<span class="tp tp-good"><i>✓</i>Funded</span>` : c.etaDays == null ? "—" : fSpan(c.etaDays)}</td></tr>`; }).join("")}
    </tbody></table>`;
}

/* ---------- days to half funded ---------- */
function halfBars(sm){
  const rows = [...sm.cases].sort((a, b) => {
    const x = a.milestones[50], y = b.milestones[50];
    if(x != null && y != null) return x - y; if(x != null) return -1; if(y != null) return 1; return b.fundedPct - a.fundedPct; });
  const max = Math.max(1, ...rows.map(c => c.milestones[50] != null ? c.milestones[50] : c.daysLive));
  return `<div class="hb hb-stack">${rows.map(c => { const d = c.milestones[50];
    return `<div class="hb-r"><span class="hb-l"><i style="background:${sColor(c.c)}"></i>${esc(short(c.title, 48))}</span>
      <span class="hb-t"><span class="hb-f${d == null ? " open" : ""}" style="width:${((d != null ? d : c.daysLive) / max * 100).toFixed(1)}%"></span></span>
      <span class="hb-v">${d != null ? `<b>${d} days</b>` : `<em>${fPct(c.fundedPct)} after ${c.daysLive} days</em>`}</span></div>`; }).join("")}</div>`;
}

/* ---------- clips ---------- */
function clipTable(clips){
  if(!clips.length) return `<div class="empty">No clip plays in this period.</div>`;
  return `<table class="tbl an-tbl"><thead><tr><th>Clip</th><th class="num">Plays</th><th class="num">Avg watched</th>
    <th class="num">Finish</th><th class="num">To case</th><th class="num">To invest</th><th class="num">Drop-off</th></tr></thead><tbody>
    ${clips.slice(0, AN.allClips ? 80 : 10).map(c => { const k = c.caseId + ":" + c.key;
      return `<tr data-clipsel="${esc(k)}" tabindex="0" aria-selected="${AN.clip === k}">
      <td><span class="an-case"><i style="background:${sColor(caseOf(c.caseId))}"></i><span>${esc(short(c.title, 40))}
        <small>${esc(short(c.caseTitle, 40))}${c.kind === "embed" ? " · embedded" : c.kind === "card" ? " · caption card" : ""}</small></span></span></td>
      <td class="num"><b>${fN(c.plays)}</b></td>
      <td class="num"><span class="an-meter"><i style="width:${(c.avgPct * 100).toFixed(1)}%"></i></span>${fDur(c.avgWatchSec)}</td>
      <td class="num">${fPct(c.completeRate)}</td>
      <td class="num">${fPct(c.toCaseRate)}</td>
      <td class="num">${fPct(c.toInvestRate)}</td>
      <td class="num">${sparkSvg(c.retention, false, true)}</td></tr>`; }).join("")}</tbody></table>
    ${clips.length > 10 ? `<button class="an-more" data-allclips>${AN.allClips ? "Show the top 10" : `Show all ${clips.length} clips`}</button>` : ""}`;
}
const caseOf = id => (entry(id) || {c: {cat: "other"}}).c;

/* ---------- live activity ---------- */
const VIA = {watch: "from the Watch feed", player: "in the clip player", cases: "from the case list", trending: "from Trending",
             link: "from a shared link", mine: "from My investments", case: "on the case page", other: ""};
function feed(model){
  const r = model.recent || [];
  if(!r.length) return `<div class="empty an-empty"><b>Nothing tracked yet</b>Open the site in another tab, watch a clip and open a case. It shows up here after Refresh, usually within a few seconds.</div>`;
  return r.map(e => {
    const c = entry(e.case_id), t = c ? (c.c.title || c.c.head) : e.case_id;
    const clipT = e.clip === "hero" ? "the 60-second clip" : c && (c.c.clips.find(x => x.id === e.clip) || {}).title;
    const what = {
      clip_watch: `Watched <b>${esc(clipT || e.clip || "a clip")}</b> for ${fDur(e.seconds)}${e.pct != null ? ` (${fPct(e.pct)})` : ""}`,
      case_view: `Opened the case ${esc(VIA[e.via] || "")}`,
      case_time: `Spent <b>${fDur(e.seconds)}</b> on the case page`,
      invest_open: `Opened invest ${esc(VIA[e.via] || "")}`,
      share: `Shared the case`,
      pledge: `<b>${esc(e.name || "Someone")}</b> invested <b>${fUsd(e.amount)}</b>`,
      comment: `<b>${esc(e.name || "Someone")}</b> commented`
    }[e.kind] || esc(e.kind);
    return `<div class="li an-ev"><span class="av an-ev-${esc(e.kind)}">${{clip_watch: "▶", case_view: "◉", case_time: "◷", invest_open: "$", share: "↗", pledge: "$", comment: "✎"}[e.kind] || "•"}</span>
      <div class="grow"><p>${what}</p><div class="who"><small>${esc(short(t, 60))} · ${when(e.at)}${e.actor_id ? ` · ${e.actor_id.startsWith("u:") ? "signed in" : "visitor " + esc(e.actor_id.slice(2, 6))}` : ""}</small></div></div></div>`;
  }).join("");
}

/* ---------- one case ---------- */
function caseView(model, sm, c, from, to){
  const t = c.totals, P = c.prev, rank = (k, f) => 1 + [...sm.cases].sort((a, b) => f(b) - f(a)).findIndex(x => x.id === c.id);
  const clips = LJ_ANALYTICS.clipStats(model, c.id, from, to);
  if(!AN.clip || !clips.some(x => x.caseId + ":" + x.key === AN.clip)) AN.clip = clips[0] ? clips[0].caseId + ":" + clips[0].key : null;
  const ms = [10, 25, 50, 75, 100].map(p => [p, c.milestones[p]]);
  const tile = (label, v, d, sub, hl) => `<div class="tile an-tile${hl ? " hl" : ""}"><small>${label}</small><b>${v}</b><span class="an-sub">${d}${sub ? ` <em>${sub}</em>` : ""}</span></div>`;
  return `
  <div class="an-casebar"><span class="an-case"><i style="background:${sColor(c.c)}"></i></span>
    <span class="an-meter lg"><i style="width:${Math.min(100, c.fundedPct * 100).toFixed(1)}%"></i></span>
    <span><b>${fUsd(c.raised)}</b> of ${fUsd(c.goal)} · ${fPct(c.fundedPct)} funded · ${fN(c.backers)} backers · ${c.daysLive} days live</span>
    ${trendPill(c.trend)}<span class="grow"></span>
    <a class="btn line sm" href="#/case/${encodeURIComponent(c.id)}">Edit case</a>
    <a class="btn line sm" href="/#case=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${I.ext}View on site</a></div>
  <div class="tiles an-tiles">
    ${tile("Invested", fUsd(t.amount), delta(t.amount, P.amount), `#${rank("a", x => x.totals.amount)} of ${sm.cases.length}`, true)}
    ${tile("Backers", fN(t.pledges), delta(t.pledges, P.pledges))}
    ${tile("Visits", fN(t.visits), delta(t.visits, P.visits), `${fN(t.visitors)} people`)}
    ${tile("Visit to investment", fPct(t.conversion), delta(t.conversion, P.conversion), `platform ${fPct(sm.platform.conversion)}`)}
    ${tile("Time on page", fDur(t.avgTimeSec), delta(t.avgTimeSec, P.avgTimeSec), `platform ${fDur(sm.platform.avgTimeSec)}`)}
    ${tile("Clip plays", fN(t.plays), delta(t.plays, P.plays), `${fHours(t.watchSec)} watched`)}
  </div>
  <div class="an-cols">
    ${card("cum", "Money raised so far", c.fundedPct >= 1 ? "Cumulative since listing. Fully funded." :
        c.etaDays != null ? `Cumulative since listing. The dashed line is the last 14 days' pace: at that rate it is fully funded in about ${fSpan(c.etaDays)}.`
        : "Cumulative since listing. Nothing came in over the last 14 days, so there is no pace to project.")}
    <section class="card an-card"><div class="an-ch"><h3>Funding milestones</h3></div>
      <p class="an-cs">Days from listing to each share of the goal.</p>
      <div class="ms">${ms.map(([p, d]) => `<div class="ms-r${d == null ? " todo" : ""}"><b>${p}%</b>
        <span class="ms-t"><i style="width:${d == null ? 0 : Math.min(100, d / Math.max(1, c.daysLive) * 100).toFixed(1)}%"></i></span>
        <span>${d == null ? "not yet" : `${d} days · ${dayLabel(model.days[c.listedIdx + d] || model.today)}`}</span></div>`).join("")}</div>
      <p class="an-cs" style="margin-top:14px">Fastest to 50% on the platform: ${(() => { const f = [...sm.cases].filter(x => x.milestones[50] != null)
        .sort((a, b) => a.milestones[50] - b.milestones[50])[0]; return f ? `${esc(short(f.title, 40))}, ${f.milestones[50]} days` : "none yet"; })()}.</p></section>
  </div>
  <div class="an-cols">
    ${card("visits1", "Case visits per day", "")}
    ${card("money1", "Invested per day", "")}
  </div>
  <h2 class="a-h">Clips <small>Click a clip to see where viewers stop.</small></h2>
  <div class="tbl-wrap" id="anClips">${clipTable(clips)}</div>
  <div class="an-cols">
    ${card("ret", "Where viewers stop", "")}
    ${card("funnel", "From clip to investment", `This case, ${rangeText(sm)}.`)}
  </div>
  <div class="an-cols">
    ${card("sources", "Where its visits come from", `${rangeText(sm)[0].toUpperCase() + rangeText(sm).slice(1)}.`)}
    <span></span>
  </div>`;
}

/* ---------- wiring and drawing ---------- */
function wireAnalytics(model, sm, one, from, to){
  const m = $("#main");
  $$("[data-period]", m).forEach(b => b.onclick = () => { AN.period = +b.dataset.period; drawAnalytics(one && one.id); });
  $("#anDemo").onchange = e => { AN.demo = e.target.checked; drawAnalytics(one && one.id); };
  $("#anRefresh").onclick = async e => { e.target.disabled = true; m.querySelector(".an").classList.add("stale");
    try{ await loadAnalytics(true); }catch(err){ toast(err.message); } drawAnalytics(one && one.id); };
  $$("[data-tbl]", m).forEach(b => b.onclick = () => { const card = b.closest("[data-card]"), on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", on); b.textContent = on ? "Chart" : "Table";
    card.querySelector("[data-plot]").hidden = on; card.querySelector("[data-table]").hidden = !on; });
  $$("[data-sort]", m).forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.sort;
    AN.sort = {key: k, dir: AN.sort.key === k ? -AN.sort.dir : k === "title" || k === "eta" ? 1 : -1};
    $("#anTable").innerHTML = caseTable(sm); wireAnalytics(model, sm, one, from, to); });
  $$("tr[data-go]", m).forEach(r => { const go = () => location.hash = "#/analytics/" + encodeURIComponent(r.dataset.go);
    r.onclick = e => { if(!e.target.closest("a")) go(); }; r.onkeydown = e => { if(e.key === "Enter") go(); }; });
  const more = $("[data-allclips]", m);
  if(more) more.onclick = () => { AN.allClips = !AN.allClips; drawAnalytics(one && one.id); };
  $$("tr[data-clipsel]", m).forEach(r => { const pick = () => { AN.clip = r.dataset.clipsel;
      $$("tr[data-clipsel]", m).forEach(x => x.setAttribute("aria-selected", x === r)); drawRet(model, one, from, to); };
    r.onclick = pick; r.onkeydown = e => { if(e.key === "Enter") pick(); }; });
  plotAll(model, sm, one, from, to);
  clearTimeout(AN.rt); window.onresize = () => { clearTimeout(AN.rt); AN.rt = setTimeout(() => { if($("[data-plot]")) plotAll(model, sm, one, from, to); }, 150); };
}

function plotAll(model, sm, one, from, to){
  const put = (id, svg, table) => { const p = $(`[data-plot="${id}"]`); if(!p) return;
    p.innerHTML = svg; const t = $(`[data-table="${id}"]`); if(t && table != null) t.innerHTML = table; };
  const W = id => { const p = $(`[data-plot="${id}"]`); return p ? Math.max(260, p.clientWidth) : 600; };
  if(!one){
    put("money", ...moneyChart(model, sm, W("money")));
    put("quad", ...quadChart(sm, W("quad")));
    put("race", ...raceChart(sm, W("race")));
    put("funnel", ...funnelBars(LJ_ANALYTICS.funnel(model, null, from, to)));
    put("sources", ...sourceBars(LJ_ANALYTICS.sources(model, null, from, to)));
  } else {
    put("cum", ...cumChart(model, one, W("cum")));
    const c = model.cases.find(x => x.id === one.id);
    put("visits1", ...colsOne(model, c.m.visits, from, to, W("visits1"), sColor(one.c), fN, "visits"));
    put("money1", ...colsOne(model, c.m.amount, from, to, W("money1"), sColor(one.c), fUsd, "invested"));
    put("funnel", ...funnelBars(LJ_ANALYTICS.funnel(model, one.id, from, to)));
    put("sources", ...sourceBars(LJ_ANALYTICS.sources(model, one.id, from, to)));
  }
  drawRet(model, one, from, to);
}

function drawRet(model, one, from, to){
  const clips = LJ_ANALYTICS.clipStats(model, one ? one.id : null, from, to);
  const c = clips.find(x => x.caseId + ":" + x.key === AN.clip) || clips[0];
  const card = $(`[data-card="ret"]`); if(!card) return;
  const p = card.querySelector("[data-plot]"), t = card.querySelector("[data-table]");
  card.querySelector("[data-title]").textContent = c ? "Where viewers stop: " + short(c.title, 34) : "Where viewers stop";
  if(!c){ p.innerHTML = `<div class="empty">No plays in this period.</div>`; return; }
  const [svg, table] = retChart(c, Math.max(260, p.clientWidth));
  const h = halfAt(c.retention);
  p.innerHTML = svg + `<p class="an-cs">${fN(c.plays)} plays · ${h < 1 ? `half of viewers are gone by ${fPct(h)} of the clip` : "more than half watch to the end"} · ${fPct(c.completeRate)} finish it.
    ${c.toCaseRate ? `${fPct(c.toCaseRate)} go on to open the case.` : ""}</p>`;
  t.innerHTML = table;
}
const halfAt = r => { for(let i = 1; i < r.length; i++) if(r[i] < .5) return (i - 1 + (r[i - 1] - .5) / Math.max(1e-9, r[i - 1] - r[i])) / 10; return 1; };

/* ============ charts ============ */

/* small helpers shared by every chart */
/* a round step (1, 2, 2.5 or 5 a power of ten) that gives four or five
   gridlines, and the top of the axis as a whole number of those steps */
function niceStep(v){ const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function niceMax(v){ if(!(v > 0)) return 1; const st = niceStep(v / 4); return Math.ceil(v / st - 1e-9) * st; }
const ticks = max => { const st = niceStep(max / 4), out = []; for(let v = 0; v <= max + st / 1e6; v += st) out.push(v); return out; };
const tbl = (head, rows) => `<table class="tbl"><thead><tr>${head.map((h, i) => `<th class="${i ? "num" : ""}">${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td class="${i ? "num" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const tipRow = (color, value, label) => `<div class="vt-r"><i style="background:${color}"></i><b>${value}</b><span>${esc(label)}</span></div>`;
const tipAttr = html => `data-tip="${esc(html)}"`;

/* columns get bucketed by week past three months, so they never get thinner than a hairline */
function buckets(model, from, to){
  const n = to - from + 1, step = n > 92 ? 7 : 1, out = [];
  for(let s = to; s >= from; s -= step) out.unshift([Math.max(from, s - step + 1), s]);
  return {b: out, weekly: step > 1};
}

/* a column with a 4px rounded data-end and a square foot */
const colPath = (x, y, w, h, r = 4) => { r = Math.min(r, w / 2, h); if(h <= 0) return "";
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

function axisY(max, fmt, x0, x1, y, H){
  return ticks(max).map(v => { const yy = y(v);
    return `<line class="g" x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}"/><text class="ax" x="${x0 - 8}" y="${yy + 4}" text-anchor="end">${fmt(v)}</text>`; }).join("");
}

/* money per day, stacked by case */
function moneyChart(model, sm, W){
  const H = 260, L = 52, R = 10, T = 10, B = 28, {from, to} = sm.range, {b, weekly} = buckets(model, from, to);
  const cases = sm.cases, data = b.map(([f, t]) => cases.map(c => sum(model.cases.find(x => x.id === c.id).m.amount, f, t)));
  const max = niceMax(Math.max(1, ...data.map(v => v.reduce((a, x) => a + x, 0))));
  const pw = W - L - R, ph = H - T - B, slot = pw / b.length, bw = Math.max(2, Math.min(24, slot - 2));
  const y = v => T + ph - v / max * ph;
  let marks = "", hits = "", labels = "";
  const every = Math.max(1, Math.ceil(b.length / Math.max(2, Math.floor(pw / 74))));
  b.forEach(([f, t], i) => {
    const x = L + i * slot + (slot - bw) / 2; let acc = 0;
    const top = data[i].reduce((k, v, j) => v > 0 ? j : k, -1);
    data[i].forEach((v, j) => { if(v <= 0) return;
      const h = v / max * ph, yy = y(acc + v), gap = acc > 0 ? 2 : 0;
      marks += j === top ? `<path d="${colPath(x, yy, bw, Math.max(0, h - gap))}" style="fill:${sColor(cases[j].c)}"/>`
        : `<rect x="${x}" y="${yy}" width="${bw}" height="${Math.max(0, h - gap)}" style="fill:${sColor(cases[j].c)}"/>`;
      acc += v; });
    const total = data[i].reduce((a, v) => a + v, 0);
    const when = weekly ? `Week of ${dayLabel(model.days[f])}` : dayLabel(model.days[f], true);
    hits += `<rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" ${tipAttr(`<div class="vt-h">${when}</div><div class="vt-t">${fUsd(total)} invested</div>` +
      cases.map((c, j) => [c, data[i][j]]).filter(x => x[1] > 0).sort((p, q) => q[1] - p[1]).map(([c, v]) => tipRow(sColor(c.c), fUsd(v), short(c.title, 40))).join(""))}/>`;
    if(i % every === 0) labels += `<text class="ax" x="${L + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${dayLabel(model.days[f])}</text>`;
  });
  const svg = `<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Money invested per ${weekly ? "week" : "day"}, stacked by case">
    ${axisY(max, fUsd, L, W - R, y, H)}<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}"/>${marks}${labels}${hits}</svg>`;
  return [svg, tbl([weekly ? "Week of" : "Day", ...cases.map(c => esc(short(c.title, 22))), "Total"],
    b.map(([f], i) => [dayLabel(model.days[f], true), ...data[i].map(fUsd), fUsd(data[i].reduce((a, v) => a + v, 0))]).reverse())];
}

/* one series of columns, for a case on its own */
function colsOne(model, arr, from, to, W, color, fmt, what){
  const H = 190, L = 48, R = 10, T = 10, B = 26, {b, weekly} = buckets(model, from, to);
  const data = b.map(([f, t]) => sum(arr, f, t)), max = niceMax(Math.max(1, ...data));
  const pw = W - L - R, ph = H - T - B, slot = pw / b.length, bw = Math.max(2, Math.min(24, slot - 2)), y = v => T + ph - v / max * ph;
  const every = Math.max(1, Math.ceil(b.length / Math.max(2, Math.floor(pw / 74))));
  let marks = "", hits = "", labels = "";
  b.forEach(([f], i) => { const x = L + i * slot + (slot - bw) / 2, v = data[i];
    if(v > 0) marks += `<path d="${colPath(x, y(v), bw, v / max * ph)}" style="fill:${color}"/>`;
    hits += `<rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" ${tipAttr(`<div class="vt-h">${weekly ? "Week of " + dayLabel(model.days[f]) : dayLabel(model.days[f], true)}</div><div class="vt-t">${fmt(v)} ${what}</div>`)}/>`;
    if(i % every === 0) labels += `<text class="ax" x="${L + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${dayLabel(model.days[f])}</text>`; });
  return [`<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${what} per ${weekly ? "week" : "day"}">
    ${axisY(max, fmt, L, W - R, y, H)}<line class="base" x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}"/>${marks}${labels}${hits}</svg>`,
    tbl([weekly ? "Week of" : "Day", what[0].toUpperCase() + what.slice(1)], b.map(([f], i) => [dayLabel(model.days[f], true), fmt(data[i])]).reverse())];
}

/* Funding race: every case starts at day 0, so the fastest climb is the
   leftmost line. Lines end where each case is today, which keeps their
   labels apart without nudging. */
function raceChart(sm, W){
  const H = 300, L = 44, R = 12, T = 12, B = 30;
  const cs = sm.cases.filter(c => c.cumulative.length > 1);
  const maxD = Math.max(30, ...cs.map(c => c.cumulative.length - 1));
  const maxP = Math.max(1, ...cs.map(c => c.fundedPct)), top = maxP > 1 ? Math.ceil(maxP * 4) / 4 : 1;
  const pw = W - L - R - 130, ph = H - T - B, x = d => L + d / maxD * pw, y = p => T + ph - Math.min(p, top) / top * ph;
  let grid = [0, .25, .5, .75, 1].filter(p => p <= top).map(p =>
    `<line class="${p === .5 || p === 1 ? "ref" : "g"}" x1="${L}" x2="${L + pw}" y1="${y(p)}" y2="${y(p)}"/><text class="ax" x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${p * 100}%</text>`).join("");
  const step = Math.max(30, Math.ceil(maxD / 6 / 30) * 30);
  for(let d = 0; d <= maxD; d += step) grid += `<text class="ax" x="${x(d)}" y="${H - 10}" text-anchor="middle">${d === 0 ? "Listed" : d + " days"}</text>`;
  const lines = cs.map(c => { const k = Math.max(1, Math.floor(c.cumulative.length / 240));
    const pts = c.cumulative.map((v, d) => [d, v / c.goal]).filter((_, d) => d % k === 0 || d === c.cumulative.length - 1);
    return `<polyline class="ln" data-case="${esc(c.id)}" style="stroke:${sColor(c.c)}" points="${pts.map(([d, p]) => x(d).toFixed(1) + "," + y(p).toFixed(1)).join(" ")}"/>`; }).join("");
  /* end dots and direct labels; a label that would overlap one already placed is left to the legend */
  const placed = [];
  const ends = cs.map(c => { const d = c.cumulative.length - 1, p = c.fundedPct, ex = x(d), ey = y(p);
    const lab = `${short(c.title, 22)} ${fPct(p)}`, lw = lab.length * 6.4;
    const box = [ex + 8, ey - 8, ex + 8 + lw, ey + 6], clash = placed.some(q => !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3]));
    if(!clash) placed.push(box);
    return `<circle class="dot" cx="${ex}" cy="${ey}" r="4.5" style="fill:${sColor(c.c)}"/>${clash ? "" : `<text class="dl-t" x="${ex + 8}" y="${ey + 4}">${esc(lab)}</text>`}`; }).join("");
  const id = "xh" + (++AN.seq);
  XH[id] = {x0: L, x1: L + pw, n: maxD, at: d => x(d), tip: d => `<div class="vt-h">${d === 0 ? "Listing day" : `Day ${d} after listing`}</div>` +
    cs.filter(c => d < c.cumulative.length).map(c => [c, c.cumulative[d] / c.goal]).sort((a, b) => b[1] - a[1])
      .map(([c, p]) => tipRow(sColor(c.c), fPct(p), short(c.title, 40))).join("")};
  const svg = `<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Share of goal raised by days since listing, one line per case">
    ${grid}${lines}<line class="xh-line" id="${id}-l" y1="${T}" y2="${T + ph}" x1="0" x2="0"/>${ends}
    <rect class="xh" data-xh="${id}" x="${L}" y="${T}" width="${pw}" height="${ph}"/></svg>`;
  const at = (c, d) => d < c.cumulative.length ? fPct(c.cumulative[d] / c.goal) : "—";
  return [svg, tbl(["Case", "Day 7", "Day 30", "Day 90", "Day 180", "Today", "Days live"],
    cs.map(c => [esc(c.title), at(c, 7), at(c, 30), at(c, 90), at(c, 180), fPct(c.fundedPct), c.daysLive]))];
}

/* Attention against money. Log scales, because the busiest case does a
   hundred times what the quietest does. Six cases can't be told apart by
   colour alone in a scatter, so the bubbles are grey and named, and take
   their case colour when pointed at. */
function quadChart(sm, W){
  const H = 400, L = 56, R = 16, T = 16, B = 40;
  const pts = sm.cases.map(c => ({c, ax: Math.max(.01, c.attentionPerDay), mo: Math.max(1, c.moneyPerDay), n: c.totals.visitors}));
  if(!pts.length) return [`<div class="empty">No live cases.</div>`, ""];
  const lx = v => Math.log10(v), dom = (vs) => { const lo = Math.min(...vs), hi = Math.max(...vs); return [lx(lo) - .25, lx(hi) + .25]; };
  const [x0, x1] = dom(pts.map(p => p.ax)), [y0, y1] = dom(pts.map(p => p.mo));
  const pw = W - L - R, ph = H - T - B, X = v => L + (lx(v) - x0) / (x1 - x0) * pw, Y = v => T + ph - (lx(v) - y0) / (y1 - y0) * ph;
  const med = a => { const s = [...a].sort((p, q) => p - q), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const mx = med(pts.map(p => p.ax)), my = med(pts.map(p => p.mo));
  const decades = (a, b, fmt, along) => { let out = "";
    for(let e = Math.floor(a); e <= Math.ceil(b); e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e), l = lx(v); if(l < a || l > b) return;
      out += along === "x" ? `<line class="g" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${T + ph}"/><text class="ax" x="${X(v)}" y="${H - 22}" text-anchor="middle">${fmt(v)}</text>`
        : `<line class="g" x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; });
    return out; };
  const maxN = Math.max(1, ...pts.map(p => p.n)), rad = n => 7 + Math.sqrt(n / maxN) * 15;
  const corner = (x, y, anchor, t) => `<text class="qd" x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
  const circles = pts.map(p => [X(p.ax), Y(p.mo), rad(p.n)]), boxes = [];
  const free = b => b[0] >= L && b[2] <= L + pw && b[1] >= T && b[3] <= T + ph
    && !boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))
    && !circles.some(([cx, cy, r]) => cx + r > b[0] && cx - r < b[2] && cy + r > b[1] && cy - r < b[3]);
  const place = (cx, cy, r, w) => {
    const opts = [[cx + r + 6, cy + 4, "start"], [cx - r - 6, cy + 4, "end"], [cx, cy - r - 7, "middle"], [cx, cy + r + 15, "middle"]];
    const box = ([x, y, a]) => { const x0 = a === "start" ? x : a === "end" ? x - w : x - w / 2; return [x0, y - 11, x0 + w, y + 3]; };
    const inside = b => b[0] >= L && b[2] <= L + pw && b[1] >= T && b[3] <= T + ph;
    /* somewhere clear, else somewhere on the chart at least */
    const pick = opts.find(o => free(box(o))) || opts.find(o => inside(box(o))) || opts[1];
    boxes.push(box(pick)); return pick;
  };
  const bubbles = [...pts].sort((a, b) => b.n - a.n).map(p => { const cx = X(p.ax), cy = Y(p.mo), r = rad(p.n), name = short(p.c.title, 26);
    const [lx2, ly2, la] = place(cx, cy, r, name.length * 6.7);
    return `<g class="bub" style="--c:${sColor(p.c.c)}" ${tipAttr(`<div class="vt-h">${esc(p.c.title)}</div>` +
      tipRow(sColor(p.c.c), fUsd(p.mo) + "/day", "invested") + tipRow(sColor(p.c.c), Math.round(p.ax).toLocaleString() + " min/day", "attention") +
      tipRow(sColor(p.c.c), fPct(p.c.totals.conversion), "of visitors invest") + tipRow(sColor(p.c.c), fDur(p.c.totals.avgTimeSec), "average time on page"))}>
      <circle class="b-hit" cx="${cx}" cy="${cy}" r="${Math.max(14, r + 4)}"/><circle class="b" cx="${cx}" cy="${cy}" r="${r}"/>
      <text class="b-l" x="${lx2}" y="${ly2}" text-anchor="${la}">${esc(name)}</text></g>`; }).join("");
  const svg = `<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Attention per day against dollars per day, one bubble per case">
    ${decades(x0, x1, v => fN(v), "x")}${decades(y0, y1, fUsd, "y")}
    <line class="ref" x1="${X(mx)}" x2="${X(mx)}" y1="${T}" y2="${T + ph}"/><line class="ref" x1="${L}" x2="${L + pw}" y1="${Y(my)}" y2="${Y(my)}"/>
    ${corner(L + pw - 4, T + 14, "end", "Watched and funded")}${corner(L + 4, T + 14, "start", "Funded quietly")}
    ${corner(L + pw - 4, T + ph - 8, "end", "Watched, not funded")}${corner(L + 4, T + ph - 8, "start", "Not landing yet")}
    ${bubbles}<text class="ax" x="${L + pw / 2}" y="${H - 4}" text-anchor="middle">Minutes of attention per day →</text>
    <text class="ax" transform="translate(12 ${T + ph / 2}) rotate(-90)" text-anchor="middle">$ invested per day →</text></svg>`;
  return [svg, tbl(["Case", "Attention, min/day", "Invested, $/day", "Visitors", "Converts", "Time on page"],
    pts.map(p => [esc(p.c.title), Math.round(p.ax).toLocaleString(), fUsd(p.mo), fN(p.n), fPct(p.c.totals.conversion), fDur(p.c.totals.avgTimeSec)]))];
}

/* retention: the share of plays still watching at each tenth of the clip */
function retChart(c, W){
  const H = 220, L = 44, R = 14, T = 14, B = 30, r = c.retention, pw = W - L - R, ph = H - T - B;
  const x = i => L + i / 10 * pw, y = v => T + ph - v * ph;
  const pts = r.map((v, i) => [x(i), y(v)]);
  const area = `M${pts[0][0]},${T + ph}` + pts.map(([a, b]) => `L${a},${b}`).join("") + `L${pts[pts.length - 1][0]},${T + ph}Z`;
  let grid = [0, .25, .5, .75, 1].map(v => `<line class="g" x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`).join("");
  grid += [0, 2.5, 5, 7.5, 10].map(i => `<text class="ax" x="${x(i)}" y="${H - 10}" text-anchor="middle">${i === 0 ? "Start" : i === 10 ? "End" : i * 10 + "%"}</text>`).join("");
  const id = "xh" + (++AN.seq);
  XH[id] = {x0: L, x1: L + pw, n: 10, at: x, tip: i => `<div class="vt-h">${i === 0 ? "Start" : i * 10 + "% through"}${c.dur ? ` · ${fDur(c.dur * i / 10)}` : ""}</div>` +
    tipRow("var(--merit)", fPct(r[i]), "of plays still watching")};
  const half = halfAt(r), endBelow = y(r[10]) + 22 < T + ph;
  return [`<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Share of viewers still watching through the clip">
    ${grid}<path class="area" d="${area}"/><polyline class="ln ret" points="${pts.map(p => p.join(",")).join(" ")}"/>
    ${half < 1 ? `<circle class="dot" cx="${x(half * 10)}" cy="${y(.5)}" r="4.5" style="fill:var(--merit)"/>
    <text class="dl-t" x="${x(half * 10) + (half > .7 ? -8 : 8)}" y="${y(.5) + 18}" text-anchor="${half > .7 ? "end" : "start"}">Half gone at ${fPct(half)}</text>` : ""}
    <circle class="dot" cx="${x(10)}" cy="${y(r[10])}" r="4.5" style="fill:var(--merit)"/>
    <text class="dl-t" x="${x(10) - 8}" y="${endBelow ? y(r[10]) + 20 : y(r[10]) - 12}" text-anchor="end">${fPct(r[10])} reach the end</text>
    <line class="xh-line" id="${id}-l" y1="${T}" y2="${T + ph}" x1="0" x2="0"/><rect class="xh" data-xh="${id}" x="${L}" y="${T}" width="${pw}" height="${ph}"/></svg>`,
    tbl(["Point in the clip", "Still watching"], r.map((v, i) => [i === 0 ? "Start" : i * 10 + "%", fPct(v)]))];
}

/* money raised so far, with the goal, and the recent pace carried forward */
function cumChart(model, c, W){
  const H = 260, L = 56, R = 70, T = 14, B = 30, cum = c.cumulative, n = cum.length - 1;
  const proj = c.etaDays != null && c.fundedPct < 1 && c.etaDays < Math.max(60, n * 1.5) ? c.etaDays : null;
  const span = n + (proj || 0), max = niceMax(Math.max(c.goal, cum[n] || 0) * 1.04);
  const pw = W - L - R, ph = H - T - B, x = d => L + d / Math.max(1, span) * pw, y = v => T + ph - v / max * ph;
  const k = Math.max(1, Math.floor(cum.length / 300));
  const pts = cum.map((v, d) => [d, v]).filter((_, d) => d % k === 0 || d === n);
  const area = `M${x(0)},${T + ph}` + pts.map(([d, v]) => `L${x(d).toFixed(1)},${y(v).toFixed(1)}`).join("") + `L${x(n)},${T + ph}Z`;
  const col = sColor(c.c);
  let grid = axisY(max, fUsd, L, L + pw, y, H);
  const step = Math.max(7, Math.ceil(span / 6 / 7) * 7);
  for(let d = 0; d <= span; d += step) grid += `<text class="ax" x="${x(d)}" y="${H - 10}" text-anchor="middle">${dayLabel(dayAt(model, c.listedIdx + d))}</text>`;
  const id = "xh" + (++AN.seq);
  XH[id] = {x0: L, x1: x(n), n, at: x, tip: d => `<div class="vt-h">${dayLabel(dayAt(model, c.listedIdx + d), true)} · day ${d}</div>` +
    tipRow(col, fUsd(cum[d]), "raised") + tipRow(col, fPct(cum[d] / c.goal), "of the goal")};
  return [`<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Money raised so far against the goal">
    ${grid}<line class="ref" x1="${L}" x2="${L + pw}" y1="${y(c.goal)}" y2="${y(c.goal)}"/>
    <text class="dl-t" x="${L + pw + 6}" y="${y(c.goal) + 4}">Goal ${fUsd(c.goal)}</text>
    <path class="area" style="fill:${col}" d="${area}"/><polyline class="ln" style="stroke:${col}" points="${pts.map(([d, v]) => x(d).toFixed(1) + "," + y(v).toFixed(1)).join(" ")}"/>
    ${proj != null ? `<line class="proj" style="stroke:${col}" x1="${x(n)}" y1="${y(cum[n])}" x2="${x(n + proj)}" y2="${y(c.goal)}"/>` : ""}
    <circle class="dot" cx="${x(n)}" cy="${y(cum[n])}" r="4.5" style="fill:${col}"/>
    <text class="dl-t" x="${x(n) + (proj != null ? -8 : 8)}" y="${y(cum[n]) - 10}" text-anchor="${proj != null ? "end" : "start"}">${fUsd(cum[n])} today</text>
    <line class="xh-line" id="${id}-l" y1="${T}" y2="${T + ph}" x1="0" x2="0"/><rect class="xh" data-xh="${id}" x="${L}" y="${T}" width="${x(n) - L}" height="${ph}"/></svg>`,
    tbl(["Day", "Raised", "Of goal"], cum.map((v, d) => [d, v]).filter(([d]) => d % 7 === 0 || d === n).reverse()
      .map(([d, v]) => [dayLabel(dayAt(model, c.listedIdx + d), true), fUsd(v), fPct(v / c.goal)]))];
}
/* a day past the end of the model, for projections */
const dayAt = (model, i) => i < model.days.length ? model.days[i]
  : new Date(Date.parse(model.today + "T00:00:00Z") + (i - model.days.length + 1) * 864e5).toISOString().slice(0, 10);

/* the funnel and the sources are plain bars in HTML: words need a column */
function funnelBars(steps){
  const top = Math.max(1, steps[0] ? steps[0].n : 1);
  const html = `<div class="fn">${steps.map((s, i) => `<div class="fn-r"><span class="fn-l">${s.label}</span>
    <span class="fn-t"><i style="width:${Math.max(.5, s.n / top * 100).toFixed(2)}%"></i></span><b>${fN(s.n)}</b>
    ${i ? `<small>${fPct(steps[i - 1].n ? s.n / steps[i - 1].n : 0)} of the step before</small>` : `<small>&nbsp;</small>`}</div>`).join("")}</div>
    <p class="an-cs">${steps[0] && steps[0].n ? `One investment for every ${fN(steps[0].n / Math.max(1, steps[steps.length - 1].n))} clip plays.` : ""}</p>`;
  return [html, tbl(["Step", "People", "Of the step before"], steps.map((s, i) => [s.label, fN(s.n), i ? fPct(steps[i - 1].n ? s.n / steps[i - 1].n : 0) : "—"]))];
}
const SRC = [["watch", "Watch feed"], ["cases", "Case list"], ["trending", "Trending rail"], ["player", "Clip player"], ["link", "Shared links"], ["mine", "My investments"], ["other", "Other"]];
function sourceBars(s){
  const total = s.total || 1, rows = SRC.map(([k, l]) => [l, s[k] || 0]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  return [rows.length ? `<div class="hb">${rows.map(([l, n]) => `<div class="hb-r"><span class="hb-l">${l}</span>
      <span class="hb-t"><span class="hb-f" style="width:${(n / max * 100).toFixed(1)}%"></span></span>
      <span class="hb-v"><b>${fPct(n / total)}</b> <em>${fN(n)}</em></span></div>`).join("")}</div>` : `<div class="empty">No visits in this period.</div>`,
    tbl(["Source", "Visits", "Share"], rows.map(([l, n]) => [l, fN(n), fPct(n / total)]))];
}

/* 14 points, de-emphasised, with today marked */
function sparkSvg(v, light, ret, wide){
  if(!v || v.length < 2) return "";
  /* in a tile the line runs the tile's width, so it stretches and has no end dot */
  if(wide){ const max = Math.max(1e-9, ...v), w = 200, h = 24;
    return `<svg class="spk wide${light ? " on-dark" : ""}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="${h}" aria-hidden="true">
      <polyline vector-effect="non-scaling-stroke" points="${v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + "," + (h - 2 - x / max * (h - 4)).toFixed(1)).join(" ")}"/></svg>`; }
  const w = ret ? 64 : 76, h = ret ? 22 : 26, max = ret ? 1 : Math.max(1e-9, ...v), min = 0;
  const p = v.map((x, i) => [(i / (v.length - 1) * (w - 4) + 2).toFixed(1), (h - 3 - (x - min) / (max - min || 1) * (h - 6)).toFixed(1)]);
  const last = p[p.length - 1];
  return `<svg class="spk${light ? " on-dark" : ""}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${p.map(q => q.join(",")).join(" ")}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6"/></svg>`;
}

/* ============ hover ============
   One tooltip for the whole page. Bars, bubbles and cells carry their own
   text in data-tip; line charts use a crosshair that snaps to the nearest
   day, so nobody has to land on a 2px line. */
const XH = {};
const vtip = Object.assign(document.createElement("div"), {className: "vtip", role: "tooltip"});
document.body.appendChild(vtip);
function showTip(html, ev){
  vtip.innerHTML = html; vtip.classList.add("on");
  const r = vtip.getBoundingClientRect(), pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if(x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if(y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  vtip.style.transform = `translate(${Math.max(8, x)}px,${Math.max(8, y)}px)`;
}
const hideTip = () => { vtip.classList.remove("on"); $$(".xh-line.on").forEach(l => l.classList.remove("on")); };
document.addEventListener("pointermove", ev => {
  const t = ev.target;
  if(!t || !t.closest || !t.closest(".an")) return hideTip();
  const xh = t.closest("[data-xh]");
  if(xh){
    const k = XH[xh.dataset.xh]; if(!k) return;
    const svg = xh.ownerSVGElement, pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const lx = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
    const i = Math.max(0, Math.min(k.n, Math.round((lx - k.x0) / (k.x1 - k.x0) * k.n)));
    const line = svg.getElementById(xh.dataset.xh + "-l");
    if(line){ line.setAttribute("x1", k.at(i)); line.setAttribute("x2", k.at(i)); line.classList.add("on"); }
    return showTip(k.tip(i), ev);
  }
  const tip = t.closest("[data-tip]");
  if(tip) return showTip(tip.getAttribute("data-tip"), ev);
  hideTip();
}, {passive: true});
document.addEventListener("pointerleave", hideTip);
