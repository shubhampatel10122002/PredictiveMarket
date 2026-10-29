/* =====================================================================
   LaunchJustice admin: analytics
   ---------------------------------------------------------------------
   /admin/#/analytics, and /admin/#/analytics/<case> for one case.

   The page is there to say why, not only what: what goes with people
   investing, what moved money and attention and when, which issues and
   which backers it comes from, and what to try next. The numbers come
   from admin/analytics-data.js, which lays real tracked activity (the
   `events` table, real pledges and comments) over a demo history built
   from each case's own figures. "Demo history" switches the baseline
   off, which is how to see that the real tracking works.

   Top to bottom:
     the money, taken apart   invested = visitors × invest rate × average
     the AI analyst           the findings in words: why, and what to try
     what draws investment    every factor against reach, rate and size,
                              and any pair of them plotted case by case
     what moved, and why      buzz, visitors and money over the same
                              days, the spikes named with their causes
     issues                   attention against money, by issue, and
                              where visits come from
     cases                    the leaderboard, with what is moving each
     backers                  which issues the same people back, and
                              what the discussion is about
     the clips                which ones hold people and send them on
     what is happening now    the real activity feed

   The AI analyst is a preview: its findings are worked out by rule in
   analytics-data.js (analyst()), from the numbers the charts show. A
   model takes over by returning the same shape from the same inputs.

   Charts follow the site's own charts: hand-built SVG or plain HTML,
   thin marks, hairline grids, one axis each, colour follows the issue,
   text in ink. Every chart has a Table button with the same numbers.
   Loaded before admin.js, so nothing here touches admin.js globals until
   it is called.
   ===================================================================== */

const AN = {period: 30, demo: true, data: null, loadedAt: 0, sort: {key: "raised", dir: -1}, clip: null, allClips: false, allAi: false,
  lens: {f: null, o: "rate"}, seq: 0};
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
const fX = x => x == null ? "—" : (x >= 10 ? Math.round(x) : x.toFixed(1)) + "×";
const fDur = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const fHours = s => { const h = (s || 0) / 3600; return h >= 1000 ? fN(h) + " h" : h >= 10 ? Math.round(h) + " h" : h.toFixed(1) + " h"; };
const fSpan = d => d == null ? "—" : d < 1 ? "today" : d < 14 ? Math.round(d) + " days" : d < 60 ? Math.round(d / 7) + " wks"
  : d < 730 ? Math.round(d / 30.4) + " mo" : (d / 365).toFixed(1) + " yrs";
const dayLabel = (iso, long) => new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {month: "short", day: "numeric", ...(long ? {year: "numeric"} : {}), timeZone: "UTC"});
const sColor = c => `var(--s-${CATS[c.cat] ? c.cat : "other"})`;   /* colour follows the case's category */
const iColor = k => `var(--s-${CATS[k] ? k : "other"})`;            /* and an issue's */
const sum = (a, f = 0, t = a.length - 1) => { let s = 0; for(let i = Math.max(0, f); i <= t; i++) s += a[i] || 0; return s; };
const headOf = l => String(l).split(":")[0].trim();                /* "Settlement talks: the authority agreed…" → "Settlement talks" */
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* "up is good" decides the colour, the arrow is always the direction */
function delta(cur, prev, upGood = true){
  if(!AN.cmp) return "";
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
  /* Activity comes back as daily totals in one call, so the API's row cap
     can never cut the history short. Pledges one by one say who backs
     what (only the actor and the case are used); comment text says what
     the discussion is about. Either of those failing costs its own
     section, not the page. */
  const [a, p, c] = await Promise.all([sb.rpc("admin_analytics"), sb.rpc("admin_pledges"),
    sb.from("comments").select("case_id,body,is_backer,created_at").order("created_at", {ascending: false}).limit(2000)]);
  if(a.error) throw a.error;
  AN.data = {real: a.data || null, pledges: p.error ? [] : p.data || [], comments: c.error ? [] : c.data || []};
  AN.loadedAt = Date.now();
  return AN.data;
}
function anModel(){
  const live = entries().filter(e => e.live);
  const listed = {};
  live.forEach(e => { if(e.row && !e.demo) listed[e.id] = e.row.created_at; });
  const r = AN.data.real || {};
  return LJ_ANALYTICS.build({cases: live.map(e => e.c), listed, demo: AN.demo, cats: CATS, real: AN.data.real,
    pledges: r.pledges || [], comments: r.comments || [], recentPledges: r.recent_pledges || [], recentComments: r.recent_comments || []});
}
function anRange(model){
  const to = model.days.length - 1;
  return {from: AN.period ? Math.max(0, to - AN.period + 1) : 0, to};
}
/* The discussion: the seeded threads (part of the demo history) and real
   comments, which carry no stance yet because the schema has no column
   for one. The legal team's own comments are left out. */
function anComments(model, caseId){
  const live = new Set(model.cases.map(x => x.id)), out = [];
  if(AN.demo && typeof SEED_COMMENTS !== "undefined")
    for(const [id, list] of Object.entries(SEED_COMMENTS)) if(live.has(id)) for(const c of list) if(!c.role)
      out.push({case_id: id, text: c.t, stance: c.s, backer: !!c.b, likes: c.l || 0, answered: !!(c.r && c.r.some(r => r.role))});
  for(const r of AN.data.comments || []) if(live.has(r.case_id))
    out.push({case_id: r.case_id, text: r.body, stance: null, backer: !!r.is_backer, likes: 0, answered: null});
  return caseId ? out.filter(c => c.case_id === caseId) : out;
}
/* every reading the page shows, worked out once per draw */
function anRead(model, sm, from, to, one){
  const id = one ? one.id : null, A = LJ_ANALYTICS;
  const dr = A.drivers(sm), sp = A.spikes(model, id, from, to), is = A.issues(sm), bk = A.backing(model, AN.data.pledges);
  const talk = A.discussion(anComments(model, id)), clips = A.clipStats(model, id, from, to);
  /* the AI analyst. A model connected later gets exactly these inputs */
  const brief = A.analyst(sm, {drivers: dr, spikes: sp, issues: is, backing: bk, talk, clips, caseId: id});
  return {dr, sp, is, bk, talk, clips, brief};
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
  AN.cmp = !!AN.period && from - (to - from + 1) >= 0;
  const one = caseId && sm.cases.find(x => x.id === caseId);
  if(caseId && !one){ m.innerHTML = `<div class="a-inner"><div class="empty-card"><b>No live case called “${esc(caseId)}”</b><a href="#/analytics">Back to analytics</a></div></div>`; return; }
  const rd = anRead(model, sm, from, to, one);
  if(!rd.dr.rows.some(r => r.key === AN.lens.f)) AN.lens = {f: rd.dr.rows[0] ? rd.dr.rows[0].key : null, o: "rate"};
  const y = window.scrollY;
  m.innerHTML = `<div class="a-inner an">${filters(model, one)}${one ? caseView(model, sm, rd, one) : overview(model, sm, rd)}</div>`;
  window.scrollTo(0, y);
  wireAnalytics(model, sm, rd, one, from, to);
}

/* one row of filters above everything they scope */
function filters(model, one){
  const n = model.realEvents || 0, ago = Math.max(0, Math.round((Date.now() - AN.loadedAt) / 6e4));
  return `<div class="a-head an-head"><div>
      ${one ? `<a class="an-back" href="#/analytics">${I.back}All cases</a>` : ""}
      <h1>${one ? esc(one.title) : "Analytics"}</h1>
      <p>${one ? `Listed ${dayLabel(model.days[one.listedIdx], true)} · ${esc(one.c.ngo || "")}` : "Why money moves: what draws investment, what moved it, and what to try next."}</p></div></div>
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
function overview(model, sm, rd){
  const {clips} = rd;
  if(!AN.clip || !clips.some(c => c.caseId + ":" + c.key === AN.clip)) AN.clip = clips[0] ? clips[0].caseId + ":" + clips[0].key : null;
  return `
  ${kpis(model, sm)}
  ${aiCard(rd.brief)}

  <div class="an-cols an-cols-dv">
    <section class="card an-card" data-card="drivers"><div class="an-ch"><h3>What draws investment</h3><button class="an-tbtn" data-tbl aria-pressed="false">Table</button></div>
      <p class="an-cs">${driverSub(rd.dr, sm)}</p>
      <div class="an-plot" data-plot="drivers">${driverBoard(rd.dr)}</div><div class="an-table" data-table="drivers" hidden>${driverTable(rd.dr)}</div></section>
    ${card("lens", "", "", "", "", "", `<p class="an-cs an-read" data-read></p>`)}
  </div>

  ${card("moved", "What moved, and why", movedSub(model, sm, null), legendIssues(rd.is), "", "an-wide", spikeList(model, rd.sp, null))}

  <div class="an-cols">
    ${card("issues", "Attention against money, by issue", `Each issue's share of the time people spent on the platform and of the money invested, ${rangeText(sm)}.`)}
    ${card("sources", "Where case visits come from", `Every case visit, ${rangeText(sm)}.`)}
  </div>

  <h2 class="a-h">Cases <small>Click a row for that case on its own. Click a heading to sort.</small></h2>
  <div class="tbl-wrap" id="anTable">${caseTable(sm, rd)}</div>

  <h2 class="a-h">Backers <small>Which issues the same people back, and what the discussion is about.</small></h2>
  <div class="an-cols">
    ${card("backers", "Who backs what", backersSub(rd.bk))}
    ${card("talk", "What the discussion is about", talkSub(rd.talk))}
  </div>

  <h2 class="a-h">Clips <small>${fN(clips.reduce((s, c) => s + c.plays, 0))} plays in ${rangeText(sm)}. Click a clip to see where viewers stop.</small></h2>
  <div class="tbl-wrap" id="anClips">${clipTable(clips)}</div>
  <div class="an-cols">
    ${card("ret", "Where viewers stop", "")}
    ${card("funnel", "From clip to investment", `Everyone on the platform, ${rangeText(sm)}.`)}
  </div>

  <section class="card an-card an-wide"><div class="an-ch"><h3>Live activity</h3></div>
    <p class="an-cs">Real events as they arrive, newest first. Demo history never shows here.</p>
    <div class="an-feed" id="anFeed">${feed(model)}</div></section>`;
}

const rangeText = sm => AN.period ? `the last ${sm.range.days} days` : `all ${fN(sm.range.days)} days`;

/* a chart card with a Table twin: the chart is drawn into .an-plot once the
   card is on the page, at the card's real width */
function card(id, title, sub, extra = "", table = "", cls = "", after = ""){
  return `<section class="card an-card ${cls}" data-card="${id}">
    <div class="an-ch"><h3 data-title>${title}</h3><button class="an-tbtn" data-tbl aria-pressed="false">Table</button></div>
    ${sub ? `<p class="an-cs" data-sub>${sub}</p>` : ""}${extra}
    <div class="an-plot" data-plot="${id}"></div><div class="an-table" data-table="${id}" hidden>${table}</div>${after}</section>`;
}
const legendIssues = is => is.length > 1 ? `<div class="an-legend">${is.map(i =>
  `<span><i style="background:${iColor(i.key)}"></i>${esc(i.label)}</span>`).join("")}</div>` : "";
const short = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

/* ---------- the money, taken apart ----------
   Invested is visitors times the share of them who invest times the
   average investment, exactly, so the row reads as one sum and says which
   of the three moved the money. Buzz and time spent are the inputs the
   rest of the page tests against it. */
function kpis(model, sm, one){
  const P = sm.platform, T = one ? one.totals : P, V = one ? one.prev : P.prev, x = one && model.cases.find(y => y.id === one.id);
  const {from, to} = sm.range, ser = k => one ? x.m[k].slice(from, to + 1) : sm.series[k];
  const minPer = t => t.visitors ? (t.timeSec + t.watchSec) / 60 / t.visitors : 0, days = sm.range.days, live = one ? Math.max(1, one.liveIn) : days;
  const tile = (op, label, v, d, sub, spark, hl) => `<div class="tile an-tile${hl ? " hl" : ""}"><small>${op ? `<i class="an-op">${op}</i>` : ""}${label}</small><b>${v}</b>
    <span class="an-sub">${d}${d && sub ? " " : ""}${sub ? `<em>${sub}</em>` : ""}</span>${spark ? `<span class="an-spark">${sparkSvg(spark, hl, false, true)}</span>` : ""}</div>`;
  const why = mostly(T, V), vs = (f, v) => one ? `platform ${f(v)}` : "";
  return `<div class="tiles an-tiles an-eq">
    ${tile("", "Invested", fUsd(T.amount), delta(T.amount, V.amount), [AN.cmp ? `vs previous ${days} days` : "", why].filter(Boolean).join(", "), ser("amount"), true)}
    ${tile("=", "Visitors", fN(T.visitors), delta(T.visitors, V.visitors), `${fN(T.visits)} visits`, ser("visitors"))}
    ${tile("×", "Invest rate", fPct(T.conversion), delta(T.conversion, V.conversion), one ? vs(fPct, P.conversion) : `${fN(T.pledges)} investments`)}
    ${tile("×", "Average investment", fUsd(T.avgPledge), delta(T.avgPledge, V.avgPledge), one ? vs(fUsd, P.avgPledge) : `${fUsdC(T.dollarsPerVisitor)} a visitor`)}
    ${model.hasBuzz ? tile("", "Buzz", `${fN(T.buzz / live)}<span class="an-u">/day</span>`, delta(T.buzz, V.buzz), "news and social mentions", ser("buzz"))
      : tile("", "Buzz", "—", "", "News and social monitoring isn't connected yet")}
    ${tile("", "Time spent", `${minPer(T).toFixed(1)}<span class="an-u"> min</span>`, delta(minPer(T), minPer(V)), one ? vs(v => v.toFixed(1) + " min", minPer(P)) : `a visitor · ${fN(T.plays)} clip plays`)}
  </div>`;
}
/* which of the three moved the money most, on a log scale so they add up */
function mostly(T, V){
  if(!AN.cmp || !(T.visitors > 0 && V.visitors > 0 && T.pledges > 0 && V.pledges > 0)) return "";
  const parts = [[Math.log(T.visitors / V.visitors), "more visitors", "fewer visitors"],
    [Math.log(T.conversion / V.conversion), "a higher invest rate", "a lower invest rate"],
    [Math.log(T.avgPledge / V.avgPledge), "bigger investments", "smaller investments"]].sort((p, q) => Math.abs(q[0]) - Math.abs(p[0]));
  return Math.abs(parts[0][0]) < .02 ? "" : "mostly " + (parts[0][0] > 0 ? parts[0][1] : parts[0][2]);
}

/* ---------- the AI analyst (preview) ---------- */
const insightIcon = {good: "▲", warn: "!", info: "i"};
function aiCard(brief, one){
  const f = brief.findings, shown = AN.allAi ? f : f.slice(0, 6);
  return `<section class="card an-card an-ai" id="anAi"><div class="an-ch"><h3>AI analyst</h3><span class="an-pv">Preview</span></div>
    ${f.length ? `${brief.headline ? `<p class="an-ai-lead">${esc(brief.headline)}</p>` : ""}
      <ul class="ins an-ai-list">${shown.map(x => aiLi(x, one)).join("")}</ul>
      ${f.length > 6 ? `<button class="an-more an-more-in" data-allai>${AN.allAi ? "Show fewer" : `Show ${f.length - 6} more`}</button>` : ""}`
      : `<p class="an-cs">Not enough activity in this period to read anything into yet.</p>`}
    <p class="an-ai-note">For now these are worked out by rule from the numbers on this page, so every line can be checked against the charts below. Once a model is connected it is given the same numbers and every comment, writes this section, and answers questions about it.</p></section>`;
}
const aiLi = (x, one) => `<li class="ins-${x.tone}"><span class="ins-ic">${insightIcon[x.tone] || "i"}</span><div>
  <b>${esc(x.title)}</b><p>${esc(x.why)}</p>${x.act ? `<p class="ins-act"><i>Try</i>${esc(x.act)}</p>` : ""}
  ${x.caseId && !one ? `<a href="#/analytics/${encodeURIComponent(x.caseId)}">See the case</a>` : ""}</div></li>`;

/* ---------- what draws investment ----------
   Each factor against three outcomes, by rank across the live cases. A
   cell is tinted by how strong the link is, green where more of the
   factor goes with more of the outcome and red where it goes with less;
   the arrow and the word say the same, so colour is never the only cue.
   Picking a cell plots that pair case by case. */
const FMT = {merit: v => String(Math.round(v)), base: v => Math.round(v) + "%", record: v => Math.round(v) + "%", ret: v => v.toFixed(2) + "×",
  lock: v => v.toFixed(1) + " yrs", impact: v => String(Math.round(v)), buzz: v => fN(v) + "/day", support: v => Math.round(v * 100) + "%", time: v => v.toFixed(1) + " min"};
const OUT = {reach: {axis: "Visitors a day", fmt: fN}, rate: {axis: "Invest rate", fmt: fPct}, avg: {axis: "Average investment", fmt: fUsd}};
const rhoText = r => r == null ? "—" : (r < 0 ? "−" : "") + Math.abs(r).toFixed(2);
function driverSub(dr, sm){
  return dr.n >= 4 ? `How each factor lines up with three outcomes across the ${dr.n} live cases, ${rangeText(sm)}. Ranked correlation: with ${dr.n} cases, a direction to test rather than proof. Pick a cell to see it case by case.`
    : "How each factor lines up with visitors, the invest rate and the size of investments, across cases.";
}
function driverBoard(dr){
  if(dr.n < 4 || !dr.rows.length) return `<div class="empty">Comparing factors needs at least four cases with 50 or more visitors in the period${dr.n ? `; there ${dr.n === 1 ? "is" : "are"} ${dr.n} so far` : ""}.</div>`;
  return `<div class="dv"><div class="dv-r dv-h"><span>Factor</span>${dr.OUTCOMES.map(o => `<span>${o.label}</span>`).join("")}</div>
    ${dr.rows.map(r => `<div class="dv-r"><span class="dv-f">${esc(r.label)}<small>${r.group}</small></span>${dr.OUTCOMES.map(o => {
      const c = r.cells[o.key], rho = c.rho, sign = rho == null || Math.abs(rho) < .2 ? 0 : rho > 0 ? 1 : -1;
      return `<button class="dv-c ${sign > 0 ? "pos" : sign < 0 ? "neg" : "nil"}" style="--a:${rho == null ? 0 : Math.abs(rho).toFixed(2)}" data-lens="${r.key}|${o.key}"
        aria-pressed="${AN.lens.f === r.key && AN.lens.o === o.key}" aria-label="${esc(`${r.label}, ${o.label}: ${c.label}, rho ${rhoText(rho)}`)}"><i>${sign > 0 ? "▲" : sign < 0 ? "▼" : "–"}</i>${c.label}</button>`; }).join("")}</div>`).join("")}
  </div>`;
}
const driverTable = dr => dr.rows.length ? tbl(["Factor", ...dr.OUTCOMES.map(o => o.label), "Cases"],
  dr.rows.map(r => [esc(r.label), ...dr.OUTCOMES.map(o => `${r.cells[o.key].label} (${rhoText(r.cells[o.key].rho)})`), r.n])) : "";

/* one pair, case by case: the factor along, the outcome up, a bubble per
   case sized by its visitors. Grey and named, as six cases can't be told
   apart by colour alone; a bubble takes its issue's colour when pointed at. */
function lensChart(sm, dr, W){
  const r = dr.rows.find(x => x.key === AN.lens.f), ok = AN.lens.o, O = OUT[ok], cell = r && r.cells[ok];
  if(!r || !O) return ["", `<div class="empty">${dr.rows.length ? "Pick a cell to plot it." : "Nothing to plot yet."}</div>`, "", ""];
  const title = `${O.axis} by ${r.label[0].toLowerCase() + r.label.slice(1)}`;
  const pts = dr.cases.map(id => ({c: sm.cases.find(x => x.id === id), x: r.vals[id], y: dr.outcomes[id][ok]})).filter(p => p.c && p.x != null && p.y != null);
  if(pts.length < 2) return [title, `<div class="empty">Not enough cases to plot.</div>`, "", ""];
  const H = 330, L = 58, R = 18, T = 14, B = 44, pw = W - L - R, ph = H - T - B;
  const lx = r.key === "buzz", ly = ok === "reach", f = v => Math.log10(Math.max(v, 1e-9));
  const dom = (vs, log, zero) => { if(log){ const lo = f(Math.min(...vs)), hi = f(Math.max(...vs)), p = Math.max(.12, (hi - lo) * .12); return [lo - p, hi + p]; }
    const lo = Math.min(...vs), hi = Math.max(...vs), p = (hi - lo || Math.abs(hi) || 1) * .14; return [zero ? 0 : lo - p, hi + p]; };
  const [x0, x1] = dom(pts.map(p => p.x), lx), [y0, y1] = dom(pts.map(p => p.y), ly, true);
  const X = v => L + ((lx ? f(v) : v) - x0) / (x1 - x0) * pw, Y = v => T + ph - ((ly ? f(v) : v) - y0) / (y1 - y0) * ph;
  const fx = FMT[r.key], grid = gridLines(x0, x1, lx, v => `<line class="g" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${T + ph}"/><text class="ax" x="${X(v)}" y="${H - 24}" text-anchor="middle">${fx(v)}</text>`, r.key === "support" ? .01 : 0)
    + gridLines(y0, y1, ly, v => `<line class="g" x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${O.fmt(v)}</text>`, ok === "rate" ? .001 : 0);
  /* the platform's own level, for reference */
  const P = sm.platform, ref = ok === "rate" ? P.conversion : ok === "avg" ? P.avgPledge : pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const maxN = Math.max(1, ...pts.map(p => p.c.totals.visitors)), rad = n => 7 + Math.sqrt(n / maxN) * 14;
  const circles = pts.map(p => [X(p.x), Y(p.y), rad(p.c.totals.visitors)]), place = labeller(circles, L, T, pw, ph);
  const refT = `${ok === "reach" ? "Average case" : "Platform"} ${O.fmt(ref)}`, ry = Y(ref), rw = refT.length * 6.3;
  const refAt = [[L + 6, "start", [L + 6, ry - 17, L + 6 + rw, ry - 3]], [L + pw - 6, "end", [L + pw - 6 - rw, ry - 17, L + pw - 6, ry - 3]],
    [L + 6, "start", [L + 6, ry + 3, L + 6 + rw, ry + 17]]].find(([, , bx]) => !circles.some(([cx, cy, rr]) => cx + rr > bx[0] && cx - rr < bx[2] && cy + rr > bx[1] && cy - rr < bx[3])) || [L + 6, "start", [L + 6, ry - 17, L + 6 + rw, ry - 3]];
  place.reserve(refAt[2]);
  const bubbles = [...pts].sort((a, b) => b.c.totals.visitors - a.c.totals.visitors).map(p => {
    const cx = X(p.x), cy = Y(p.y), rr = rad(p.c.totals.visitors), name = short(p.c.title, W < 480 ? 16 : 26), [tx, ty, ta] = place(cx, cy, rr, name.length * 6.7), col = sColor(p.c.c);
    return `<g class="bub" style="--c:${col}" ${tipAttr(`<div class="vt-h">${esc(p.c.title)}</div>` + tipRow(col, fx(p.x), r.label) + tipRow(col, O.fmt(p.y), O.axis) +
      tipRow(col, fN(p.c.totals.visitors), "visitors in the period"))}>
      <circle class="b-hit" cx="${cx}" cy="${cy}" r="${Math.max(14, rr + 4)}"/><circle class="b" cx="${cx}" cy="${cy}" r="${rr}"/>
      <text class="b-l" x="${tx}" y="${ty}" text-anchor="${ta}">${esc(name)}</text></g>`; }).join("");
  const svg = `<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}, one bubble per case">
    ${grid}<line class="ref" x1="${L}" x2="${L + pw}" y1="${ry}" y2="${ry}"/><text class="qd" x="${refAt[0]}" y="${refAt[2][3] - 3}" text-anchor="${refAt[1]}">${refT}</text>
    ${bubbles}<text class="ax" x="${L + pw / 2}" y="${H - 4}" text-anchor="middle">${esc(r.label)} →</text>
    <text class="ax" transform="translate(12 ${T + ph / 2}) rotate(-90)" text-anchor="middle">${O.axis} →</text></svg>`;
  /* the same in words */
  const read = cell.rho == null ? "" : Math.abs(cell.rho) < .2 ? `No pattern across the ${cell.n} cases (ρ ${rhoText(cell.rho)}).`
    : `${cell.label} ${cell.rho > 0 ? "link" : "inverse link"} (ρ ${rhoText(cell.rho)}, ${cell.n} cases)` + (cell.hi != null && cell.lo != null && (cell.hi - cell.lo) * cell.rho > 0
      ? `: the ${cell.top.length} cases highest on ${r.label[0].toLowerCase() + r.label.slice(1)} ${ok === "rate" ? `turn ${fPct(cell.hi)} of their visitors into investors` : ok === "reach" ? `draw ${fN(cell.hi)} visitors a day` : `average ${fUsd(cell.hi)} an investment`}; the other ${cell.bottom.length}, ${O.fmt(cell.lo)}.` : ".");
  return [title, svg, tbl(["Case", r.label, O.axis, "Visitors"], pts.map(p => [esc(p.c.title), fx(p.x), O.fmt(p.y), fN(p.c.totals.visitors)])), read];
}
/* gridlines for a linear or log axis: a round step, or 1-2-5 per decade */
function gridLines(lo, hi, log, line, minStep = 0){
  let out = "";
  if(log){ for(let e = Math.floor(lo); e <= Math.ceil(hi); e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e), l = Math.log10(v); if(l >= lo && l <= hi) out += line(v); }); return out; }
  const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), q = raw / p;
  const st = Math.max(minStep, (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * p);
  for(let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st / 1e6; v += st) out += line(+v.toFixed(10));
  return out;
}
/* labels beside bubbles: somewhere clear, else somewhere on the chart at least */
function labeller(circles, L, T, pw, ph){
  const boxes = [], inside = b => b[0] >= L && b[2] <= L + pw && b[1] >= T && b[3] <= T + ph;
  const free = b => inside(b) && !boxes.some(q => !(b[2] < q[0] || b[0] > q[2] || b[3] < q[1] || b[1] > q[3]))
    && !circles.some(([cx, cy, r]) => cx + r > b[0] && cx - r < b[2] && cy + r > b[1] && cy - r < b[3]);
  return Object.assign((cx, cy, r, w) => {
    const opts = [[cx + r + 6, cy + 4, "start"], [cx - r - 6, cy + 4, "end"], [cx, cy - r - 7, "middle"], [cx, cy + r + 15, "middle"]];
    const box = ([x, y, a]) => { const x0 = a === "start" ? x : a === "end" ? x - w : x - w / 2; return [x0, y - 11, x0 + w, y + 3]; };
    const pick = opts.find(o => free(box(o))) || opts.find(o => inside(box(o))) || opts[1];
    boxes.push(box(pick)); return pick;
  }, {reserve: b => boxes.push(b)});
}

/* ---------- what moved, and why ----------
   Buzz, visitors and money over the same days, one lane each rather than
   two scales on one axis, stacked by issue. Each spike is a band across
   all three lanes and a number that the list underneath explains. */
function movedSub(model, sm, one){
  return `${model.hasBuzz ? "News and social mentions, visitors and money" : "Visitors and money"}${one ? "" : " by issue"}, ${rangeText(sm)}. ` +
    `A numbered band is a spike: a day with 1.8 times the usual visitors or twice the usual money.${model.hasBuzz ? "" : " Buzz appears here once news and social monitoring is connected."}`;
}
function movedChart(model, sm, rd, one, W){
  const {from, to} = sm.range, {b, weekly} = buckets(model, from, to);
  const groups = one ? [{label: one.title, color: sColor(one.c), xs: [model.cases.find(x => x.id === one.id)]}]
    : rd.is.map(i => ({label: i.label, color: iColor(i.key), xs: model.cases.filter(x => i.cases.includes(x.id))}));
  const lanes = [...(model.hasBuzz ? [{k: "buzz", label: "Buzz", unit: "mentions", fmt: fN}] : []),
    {k: "visitors", label: "Visitors", fmt: fN}, {k: "amount", label: "Invested", fmt: fUsd}];
  const L = 56, R = 10, T = 44, LH = 84, G = 34, B = 26, H = T + lanes.length * (LH + G) - G + B;
  const pw = W - L - R, slot = pw / b.length, bw = Math.max(2, Math.min(22, slot - 2)), per = weekly ? "a week" : "a day";
  const data = lanes.map(l => b.map(([f, t]) => groups.map(g => g.xs.reduce((s, x) => s + sum(x.m[l.k], f, t), 0))));
  if(!data.some(d => d.some(v => v.some(x => x > 0)))) return [`<div class="empty">No visitors or money in this period.</div>`, ""];
  let marks = "", hits = "", labels = "";
  lanes.forEach((l, li) => {
    const top = T + li * (LH + G), base = top + LH, d = data[li], max = niceMax(Math.max(1, ...d.map(v => v.reduce((a, x) => a + x, 0))));
    marks += `<text class="ln-t" x="${L}" y="${top - 9}">${l.label} <tspan class="ax">${l.unit ? l.unit + " " : ""}${per}</tspan></text>
      <line class="g" x1="${L}" x2="${W - R}" y1="${top}" y2="${top}"/><text class="ax" x="${L - 8}" y="${top + 4}" text-anchor="end">${l.fmt(max)}</text>
      <line class="base" x1="${L}" x2="${W - R}" y1="${base}" y2="${base}"/><text class="ax" x="${L - 8}" y="${base + 4}" text-anchor="end">0</text>`;
    b.forEach((_, i) => {
      const x = L + i * slot + (slot - bw) / 2, last = d[i].reduce((k, v, j) => v > 0 ? j : k, -1); let acc = 0;
      d[i].forEach((v, j) => { if(v <= 0) return;
        const h = v / max * LH, yy = base - (acc + v) / max * LH, gap = acc > 0 ? 1.5 : 0;
        marks += j === last ? `<path d="${colPath(x, yy, bw, Math.max(0, h - gap), 3)}" style="fill:${groups[j].color}"/>`
          : `<rect x="${x}" y="${yy}" width="${bw}" height="${Math.max(0, h - gap)}" style="fill:${groups[j].color}"/>`;
        acc += v; });
    });
  });
  /* spikes: a band across the lanes for the days each ran, and its
     number in a row above, at its peak or as near as the numbers before
     it allow, with a leader down to the peak */
  const sp = rd.sp.slice(0, one ? 5 : 6), at = i => b.findIndex(([f, t]) => i >= f && i <= t), bands = [], hot = new Array(b.length).fill(false);
  let spk = "", mk = [];
  sp.forEach((s, n) => { const i0 = at(Math.max(from, s.from)), i1 = at(Math.min(to, s.to)); if(i0 < 0) return;
    const ip = at(Math.min(to, Math.max(from, s.peak))); bands.push([i0, i1, n]);
    for(let i = i0; i <= i1; i++) hot[i] = true;
    mk.push({n, px: L + (Math.max(i0, ip) + .5) * slot}); });
  /* one shade for every day inside some spike, however many overlap */
  for(let i = 0; i < b.length; i++) if(hot[i] && !hot[i - 1]){ let j = i; while(hot[j + 1]) j++;
    spk += `<rect class="sp-band" x="${L + i * slot}" y="${T - 4}" width="${(j - i + 1) * slot}" height="${H - B - T + 4}"/>`; }
  mk.sort((p, q) => p.px - q.px || p.n - q.n);
  mk.forEach((m, k) => { m.x = Math.max(m.px, k ? mk[k - 1].x + 20 : L + 9); });
  for(let k = mk.length - 1, lim = W - R - 9; k >= 0; k--){ mk[k].x = Math.min(mk[k].x, lim); lim = mk[k].x - 20; }   /* and back in from the right edge */
  mk.forEach(m => { spk += `<path class="sp-ld" d="M${m.x},22V${T - 6}"/>${Math.abs(m.x - m.px) > 1 ? `<path class="sp-ld" d="M${m.x},${T - 6}L${m.px},${T - 1}"/>` : ""}
    <g class="sp-mk"><circle cx="${m.x}" cy="13" r="9"/><text x="${m.x}" y="17" text-anchor="middle">${m.n + 1}</text></g>`; });
  const every = Math.max(1, Math.ceil(b.length / Math.max(2, Math.floor(pw / 74))));
  b.forEach(([f, t], i) => {
    const when = weekly ? `Week of ${dayLabel(model.days[f])}` : dayLabel(model.days[f], true);
    const tops = lanes.map((l, li) => tipRow("var(--ink-soft)", l.fmt(data[li][i].reduce((a, v) => a + v, 0)), l.label)).join("");
    const split = one ? "" : groups.map((g, j) => [g, data[lanes.length - 1][i][j]]).filter(q => q[1] > 0).sort((p, q) => q[1] - p[1]).slice(0, 3)
      .map(([g, v]) => tipRow(g.color, fUsd(v), g.label)).join("");
    const here = bands.filter(([i0, i1]) => i >= i0 && i <= i1).map(([, , n]) => `<div class="vt-h">Spike ${n + 1}: ${esc(headOf(spikeCause(sp[n])))}</div>`).join("");
    hits += `<rect class="hit" x="${L + i * slot}" y="${T - 4}" width="${slot}" height="${H - B - T + 4}" ${tipAttr(`<div class="vt-h">${when}</div>${tops}${split ? `<div class="vt-h">Invested, by issue</div>${split}` : ""}${here}`)}/>`;
    if(i % every === 0) labels += `<text class="ax" x="${L + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${dayLabel(model.days[f])}</text>`;
  });
  const svg = `<svg class="an-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${lanes.map(l => l.label).join(", ")} per ${weekly ? "week" : "day"}${one ? "" : ", stacked by issue"}, with spikes marked">
    ${spk}${marks}${labels}${hits}</svg>`;
  return [svg, tbl([weekly ? "Week of" : "Day", ...lanes.map(l => l.label)],
    b.map(([f], i) => [dayLabel(model.days[f], true), ...lanes.map((l, li) => l.fmt(data[li][i].reduce((a, v) => a + v, 0)))]).reverse())];
}
const SRC_NAME = {watch: "The Watch feed", player: "The clip player", cases: "The case list", trending: "The trending rail", link: "Shared links", mine: "Returning backers", other: "Other places"};
const CAUSE_KIND = {case: "Case news", news: "Press", issue: "Issue in the news", social: "Social", backing: "Backers"};
const spikeCause = s => s.cause.type === "event" ? s.cause.label : s.cause.type === "buzz" ? "Buzz: news and social mentions jumped first"
  : s.cause.type === "source" ? `${SRC_NAME[s.source]}: brought ${fPct(s.sourceShare)} of the extra visitors${s.clip ? `, most through “${s.clip.title}”` : ""}`
  : "Unexplained: nothing on record for these days";
function spikeList(model, sp, one){
  sp = sp.slice(0, one ? 5 : 6);
  if(!sp.length) return `<p class="an-cs sp-none">No spikes in this period: no day drew 1.8 times its usual visitors or twice its usual money.</p>`;
  const verdict = s => s.convX == null ? "" : s.convX >= 1.15 ? `<span class="tp tp-good"><i>▲</i>${fPct(s.convX)} of the usual invest rate</span>`
    : s.convX >= .85 ? `<span class="tp tp-good"><i>✓</i>Invest rate held, ${fPct(s.convX)}</span>`
    : `<span class="tp tp-${s.convX < .5 ? "bad" : "warn"}"><i>▼</i>${fPct(s.convX)} of the usual invest rate</span>`;
  return `<ol class="sp">${sp.map((s, n) => { const d = s.days > 1 ? `${dayLabel(model.days[s.from])} – ${dayLabel(model.days[s.to])}` : dayLabel(model.days[s.from]);
    const k = s.cause.type === "event" ? CAUSE_KIND[s.cause.kind] || "Event" : s.cause.type === "buzz" ? "Buzz" : s.cause.type === "source" ? "Source" : "";
    return `<li><span class="sp-n">${n + 1}</span><div class="grow">
      <p class="sp-h"><b>${d}</b>${one ? "" : `<span class="an-case"><i style="background:${sColor(s.c)}"></i><a href="#/analytics/${encodeURIComponent(s.caseId)}">${esc(short(s.title, 48))}</a></span>`}</p>
      <p class="sp-c">${k ? `<span class="sp-k">${k}</span>` : ""}${esc(s.cause.type !== "event" ? spikeCause(s)
        : headOf(s.cause.label).toLowerCase() === k.toLowerCase() ? cap(s.cause.label.slice(s.cause.label.indexOf(":") + 1).trim()) : s.cause.label)}</p>
      <p class="sp-m">Visitors ${fX(s.visitsX)} the usual · invested ${fX(s.moneyX)}${s.buzzX != null ? ` · buzz ${fX(s.buzzX)}` : ""}</p></div>${verdict(s)}</li>`; }).join("")}</ol>`;
}

/* ---------- attention against money, by issue ----------
   A dumbbell per issue: its share of the time spent on the platform (the
   ring) and of the money (the dot, in the issue's colour). The longer the
   line, the further attention and money part company. */
function issueBars(is, days){
  if(!is.some(i => i.attentionShare > 0 || i.moneyShare > 0)) return [`<div class="empty">No activity in this period.</div>`, ""];
  const top = Math.max(...is.map(i => Math.max(i.attentionShare, i.moneyShare))), max = Math.min(1, Math.ceil(top * 10 - 1e-9) / 10 || .1);
  const x = v => (Math.min(1, v / max) * 100).toFixed(1) + "%";
  return [`<div class="db-key"><span><i class="db-a"></i>Share of time spent</span><span><i class="db-m"></i>Share of money</span></div>
    <div class="db">${is.map(i => { const a = i.attentionShare, m = i.moneyShare;
      return `<div class="db-r" ${tipAttr(`<div class="vt-h">${esc(i.label)}</div>` + tipRow(iColor(i.key), fPct(a), "of the time spent") + tipRow(iColor(i.key), fPct(m), "of the money") +
        tipRow(iColor(i.key), fPct(i.conversion), "of visitors invest") + tipRow(iColor(i.key), fUsd(i.avgPledge), "average investment"))}>
        <span class="hb-l"><i style="background:${iColor(i.key)}"></i>${esc(i.label)}</span>
        <span class="db-t"><i class="db-l" style="left:${x(Math.min(a, m))};width:${x(Math.abs(a - m))}"></i><i class="db-a" style="left:${x(a)}"></i><i class="db-m" style="left:${x(m)};background:${iColor(i.key)}"></i></span>
        <span class="hb-v"><em>${fPct(a)}</em> → <b>${fPct(m)}</b></span></div>`; }).join("")}
      <div class="db-r db-ax"><span></span><span class="db-t"><em style="left:0">0%</em><em style="left:50%">${fPct(max / 2)}</em><em style="left:100%">${fPct(max)}</em></span><span></span></div></div>`,
    tbl(["Issue", "Cases", "Time spent", "Money", "Invest rate", "Average investment", "Buzz a day", "Money vs before"], is.map(i => [esc(i.label), i.cases.length,
      fPct(i.attentionShare), fPct(i.moneyShare), fPct(i.conversion), fUsd(i.avgPledge), i.buzz ? fN(i.buzz / Math.max(1, days)) : "—",
      i.change == null ? "—" : (i.change >= 0 ? "+" : "−") + fPct(Math.abs(i.change))]))];
}

/* ---------- who backs what ----------
   The strongest pairings first: of the backers of one issue, the share who
   have also backed a case in another. The whole grid is the Table. */
const backersSub = bk => bk.total ? `Of the backers of one issue, the share who have also backed a case in another, strongest first. ${fPct(bk.repeatShare)} of backers have backed more than one case.`
  : "Of the backers of one issue, the share who have also backed a case in another.";
function backersList(bk){
  const is = bk.issues.filter(i => i.backers > 0);
  if(is.length < 2 || !bk.multi) return [`<div class="empty">Nobody has backed cases in two issues yet.</div>`, ""];
  const pairs = [], most = new Map();
  for(const p of is) for(const q of is) if(p !== q){ const v = bk.share(p.key, q.key) || 0; pairs.push([p, q, v]); most.set(p, Math.max(most.get(p) || 0, v)); }
  pairs.sort((a, b) => b[2] - a[2]);
  const top = pairs.slice(0, 7), max = Math.max(.01, top[0][2]);
  const alone = [...most].filter(([p]) => p.backers >= 20).sort((a, b) => a[1] - b[1])[0];
  const dot = i => `<i style="background:${iColor(i.key)}"></i>`;
  return [`<div class="hb bk">${top.map(([p, q, v]) => `<div class="hb-r" ${tipAttr(`<div class="vt-h">${esc(p.label)} backers</div>` +
      tipRow(iColor(q.key), fPct(v), `also back ${q.label}`) + tipRow(iColor(q.key), fN(bk.both(p.key, q.key)), "people"))}>
      <span class="hb-l bk-l">${dot(p)}${esc(p.label)}<em>→</em>${dot(q)}${esc(q.label)}</span>
      <span class="hb-t"><span class="hb-f" style="width:${(v / max * 100).toFixed(1)}%"></span></span>
      <span class="hb-v"><b>${fPct(v)}</b></span></div>`).join("")}</div>
    ${alone && alone[1] < .1 ? `<p class="an-cs bk-alone">${dot(alone[0])}<span><b>${esc(alone[0].label)}</b> backers rarely back anything else: ${fPct(alone[1])} at most.</span></p>` : ""}
    ${AN.demo ? `<p class="an-cs an-fine">In the demo history the overlap is modelled: backers lean to cases that are alike to back (chance to win, expected return, social impact). Real overlap comes from pledges, by who made them${bk.realBackers ? `: ${fN(bk.realBackers)} real backers so far` : ""}.</p>` : ""}`,
    tbl(["Backers of ↓ also back →", ...is.map(q => esc(q.label))], is.map(p => [`${esc(p.label)} <small class="muted">${fN(p.backers)}</small>`, ...is.map(q => p === q ? "—" : fPct(bk.share(p.key, q.key) || 0))]))];
}

/* ---------- what the discussion is about ----------
   A theme's share of backers' comments (right) against its share of
   everyone else's (left), so what holds people back sits on the left. */
function talkSub(talk){
  if(!talk.n) return "The themes people write about, backers against everyone else.";
  return `The themes in ${fN(talk.n)} comments, ${fN(talk.backers)} of them by backers, read by keyword: a model will read them properly once one is connected.`;
}
function talkBars(talk, one){
  if(!talk.n) return [`<div class="empty">No comments yet.</div>`, ""];
  const sb = r => talk.backers ? r.backers / talk.backers : 0, so = r => talk.others ? r.others / talk.others : 0;
  const max = Math.max(.01, ...talk.themes.map(r => Math.max(sb(r), so(r))));
  const open = talk.unanswered.slice(0, 3);
  return [`<div class="bf"><div class="bf-r bf-h"><span></span><span>Everyone else</span><span>Backers</span></div>
    ${talk.themes.map(r => `<div class="bf-r" ${tipAttr(`<div class="vt-h">${esc(r.label)}</div>` + tipRow("var(--ink)", fN(r.backers), "comments by backers") +
      tipRow("var(--ink-soft)", fN(r.others), "by everyone else") + (r.stance.skeptical ? tipRow("var(--st-skeptical)", fN(r.stance.skeptical), "sceptical") : ""))}>
      <span class="bf-l">${esc(r.label)}</span>
      <span class="bf-o"><em>${fPct(so(r))}</em><i style="width:${(so(r) / max * 100).toFixed(1)}%"></i></span>
      <span class="bf-b"><i style="width:${(sb(r) / max * 100).toFixed(1)}%"></i><em>${fPct(sb(r))}</em></span></div>`).join("")}</div>
    ${open.length ? `<div class="oq"><b>Waiting for an answer from counsel</b>${open.map(c => `<p>“${esc(c.text)}”${one ? "" : ` <small>${esc(short(caseOf(c.case_id).title || caseOf(c.case_id).head || c.case_id, 40))}</small>`}</p>`).join("")}</div>` : ""}`,
    tbl(["Theme", "Backers", "Everyone else", "Supportive", "Questions", "Sceptical"], talk.themes.map(r => [esc(r.label), `${r.backers} (${fPct(sb(r))})`, `${r.others} (${fPct(so(r))})`,
      r.stance.support, r.stance.question, r.stance.skeptical]))];
}

/* ---------- the case leaderboard ---------- */
/* what is moving a case: the cause of its biggest spike in the last two
   weeks, or how long it has been quiet */
function moving(c, rd, model){
  const b = model.days.length - 1, s = rd.sp.filter(x => x.caseId === c.id && x.to >= b - 13).sort((p, q) => q.extraMoney - p.extraMoney)[0];
  if(s) return {text: s.cause.type === "event" ? headOf(s.cause.label) : headOf(spikeCause(s)), tone: s.convX == null || s.convX >= .85 ? "good" : "warn", full: spikeCause(s)};
  if((c.trend === "stalled" || c.trend === "slowing") && c.velocityPrev > 0){
    const ev = model.cases.find(x => x.id === c.id).events.filter(e => e.i <= b).pop();
    return {text: ev ? `Quiet since ${dayLabel(model.days[ev.i])}` : "Quiet", tone: "bad", full: ev ? ev.label : "No news on record"};
  }
  return null;
}
const COLS = [
  ["title", "Case", c => c.title, "l"],
  ["fundedPct", "Funded", c => c.fundedPct],
  ["raised", "Invested", c => c.totals.amount],
  ["pledges", "Backers", c => c.totals.pledges],
  ["conversion", "Invest rate", c => c.totals.conversion],
  ["merit", "Chance to win", c => c.f && c.f.merit != null ? c.f.merit : -1],
  ["impact", "Impact", c => c.f && c.f.impact != null ? c.f.impact : -1],
  ["momentum", "Last 14 days, and why", c => c.momentum == null ? -1 : c.momentum],
  ["eta", "Fully funded in", c => c.fundedPct >= 1 ? -1 : c.etaDays == null ? 1e9 : c.etaDays]
];
function caseTable(sm, rd){
  const model = sm.model, col = COLS.find(c => c[0] === AN.sort.key) || COLS[2];
  const rows = [...sm.cases].sort((a, b) => { const x = col[2](a, rd, model), y = col[2](b, rd, model);
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * AN.sort.dir; });
  return `<table class="tbl an-tbl"><thead><tr>${COLS.map(([k, t, , al]) =>
    `<th class="${al ? "" : "num"}"><button data-sort="${k}" aria-sort="${AN.sort.key === k ? (AN.sort.dir < 0 ? "descending" : "ascending") : "none"}">${t}${
      AN.sort.key === k ? (AN.sort.dir < 0 ? " ↓" : " ↑") : ""}</button></th>`).join("")}</tr></thead><tbody>
    ${rows.map(c => { const t = c.totals, w = moving(c, rd, model);
      return `<tr data-go="${esc(c.id)}" tabindex="0">
      <td><span class="an-case"><i style="background:${sColor(c.c)}"></i><span><a href="#/analytics/${encodeURIComponent(c.id)}">${esc(short(c.title, 46))}</a>
        <small>${esc(CATS[c.c.cat] ? CATS[c.c.cat].label : "Other")} · ${c.daysLive} days live</small></span></span></td>
      <td class="num"><span class="an-meter"><i style="width:${Math.min(100, c.fundedPct * 100).toFixed(1)}%"></i></span>${fPct(c.fundedPct)}</td>
      <td class="num"><b>${fUsd(t.amount)}</b><br>${delta(t.amount, c.prev.amount)}</td>
      <td class="num">${fN(t.pledges)}</td>
      <td class="num">${fPct(t.conversion)}</td>
      <td class="num">${c.f && c.f.merit != null ? c.f.merit : "—"}</td>
      <td class="num">${c.f && c.f.impact != null ? c.f.impact : "—"}</td>
      <td class="num"><span class="an-mom">${sparkSvg(c.spark)}${trendPill(c.trend)}</span>
        ${w ? `<span class="mv mv-${w.tone}" title="${esc(w.full)}">${esc(w.text)}</span>` : ""}</td>
      <td class="num">${c.fundedPct >= 1 ? `<span class="tp tp-good"><i>✓</i>Funded</span>` : c.etaDays == null ? "—" : fSpan(c.etaDays)}</td></tr>`; }).join("")}
    </tbody></table>`;
}

/* ---------- clips ---------- */
function clipTable(clips){
  clips = clips.filter(c => c.plays > 0);
  if(!clips.length) return `<div class="empty">No clip plays in this period.</div>`;
  return `<table class="tbl an-tbl"><thead><tr><th>Clip</th><th class="num">Plays</th><th class="num">Avg watched</th>
    <th class="num">Finish</th><th class="num">To case</th><th class="num">To invest</th><th class="num">Drop-off</th></tr></thead><tbody>
    ${(AN.allClips ? clips : clips.slice(0, 10)).map(c => { const k = c.caseId + ":" + c.key;
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
function caseView(model, sm, rd, c){
  const clips = rd.clips, f = c.f || {};
  if(!AN.clip || !clips.some(x => x.caseId + ":" + x.key === AN.clip)) AN.clip = clips[0] ? clips[0].caseId + ":" + clips[0].key : null;
  const score = (label, v) => v == null ? "" : `<span class="an-sc"><small>${label}</small><b>${v}</b></span>`;
  return `
  <div class="an-casebar"><span class="an-case"><i style="background:${sColor(c.c)}"></i></span>
    <span class="an-meter lg"><i style="width:${Math.min(100, c.fundedPct * 100).toFixed(1)}%"></i></span>
    <span><b>${fUsd(c.raised)}</b> of ${fUsd(c.goal)} · ${fPct(c.fundedPct)} funded · ${fN(c.backers)} backers · ${c.daysLive} days live</span>
    ${trendPill(c.trend)}<span class="grow"></span>
    <a class="btn line sm" href="#/case/${encodeURIComponent(c.id)}">Edit case</a>
    <a class="btn line sm" href="/#case=${encodeURIComponent(c.id)}&preview" target="_blank" rel="noopener">${I.ext}View on site</a></div>
  <div class="an-scores">${score("Chance to win", f.merit)}${score("Social impact", f.impact)}${score("Expected return", f.ret != null ? f.ret.toFixed(2) + "×" : null)}${score("Lock-in", f.lock != null ? f.lock.toFixed(1) + " yrs" : null)}
    ${score("Counsel's record", f.record != null ? Math.round(f.record) + "%" : null)}${score("Supportive discussion", f.support != null ? fPct(f.support) : null)}
    <span class="an-sc-i">${esc(CATS[c.c.cat] ? CATS[c.c.cat].label : "Other")}</span></div>
  ${kpis(model, sm, c)}
  ${aiCard(rd.brief, c)}
  <div class="an-cols">
    ${card("stand", "How it compares", `Where this case sits among the ${rd.dr.n} live cases, ${rangeText(sm)}, first on what happened, then on each factor. ▲ and ▼ mark the factors that go with investing across the platform.`)}
    ${card("cum", "Money raised so far", c.fundedPct >= 1 ? "Cumulative since listing. Fully funded." :
        c.etaDays != null ? `Cumulative since listing. The dashed line is the last 14 days' pace: at that rate it is fully funded in about ${fSpan(c.etaDays)}.`
        : "Cumulative since listing. Nothing came in over the last 14 days, so there is no pace to project.")}
  </div>
  ${card("moved", "What moved it, and why", movedSub(model, sm, c), "", "", "an-wide", spikeList(model, rd.sp, c))}
  <h2 class="a-h">Clips <small>Click a clip to see where viewers stop.</small></h2>
  <div class="tbl-wrap" id="anClips">${clipTable(clips)}</div>
  <div class="an-cols">
    ${card("ret", "Where viewers stop", "")}
    ${card("funnel", "From clip to investment", `This case, ${rangeText(sm)}.`)}
  </div>
  <div class="an-cols">
    ${card("talk", "What its discussion is about", talkSub(rd.talk))}
    ${card("sources", "Where its visits come from", `${rangeText(sm)[0].toUpperCase() + rangeText(sm).slice(1)}.`)}
  </div>`;
}

/* How it compares: a strip per measure with every live case on it, this
   one in its colour and named by its place. */
function standStrips(sm, dr, c){
  if(!dr.cases.includes(c.id)) return [`<div class="empty">This case had fewer than 50 visitors in the period, too few to compare.</div>`, ""];
  const outs = dr.OUTCOMES.map(o => ({label: OUT[o.key].axis, vals: Object.fromEntries(dr.cases.map(id => [id, dr.outcomes[id][o.key]])), fmt: OUT[o.key].fmt, tag: ""}));
  const facts = dr.rows.map(r => { const rho = r.cells.rate.rho;
    return {label: r.label, vals: r.vals, fmt: FMT[r.key], tag: rho != null && Math.abs(rho) >= .4 ? (rho > 0 ? "▲" : "▼") : "", rho}; });
  const row = m => { const ids = Object.keys(m.vals).filter(id => m.vals[id] != null), v = m.vals[c.id];
    if(v == null || ids.length < 2) return "";
    const lo = Math.min(...ids.map(id => m.vals[id])), hi = Math.max(...ids.map(id => m.vals[id])), x = u => ((hi > lo ? (u - lo) / (hi - lo) : .5) * 100).toFixed(1) + "%";
    const pos = 1 + ids.filter(id => m.vals[id] > v).length;
    return `<div class="st-r"><span class="st-l">${esc(m.label)}${m.tag ? ` <i class="st-tag ${m.tag === "▲" ? "up" : "down"}" title="${m.tag === "▲" ? "More goes with investing" : "More goes with less investing"}">${m.tag}</i>` : ""}</span>
      <span class="st-t">${ids.filter(id => id !== c.id).map(id => `<i style="left:${x(m.vals[id])}"></i>`).join("")}<i class="me" style="left:${x(v)};background:${sColor(c.c)}"></i></span>
      <span class="st-v"><b>${m.fmt(v)}</b> <em>${pos === 1 ? "highest" : pos === ids.length ? "lowest" : `${pos} of ${ids.length}`}</em></span></div>`; };
  return [`<div class="st">${outs.map(row).join("")}<div class="st-sep"></div>${facts.map(row).join("")}</div>`,
    tbl(["Measure", "This case", "Lowest", "Highest"], [...outs, ...facts].map(m => { const vs = Object.values(m.vals).filter(v => v != null);
      return [esc(m.label), m.vals[c.id] == null ? "—" : m.fmt(m.vals[c.id]), vs.length ? m.fmt(Math.min(...vs)) : "—", vs.length ? m.fmt(Math.max(...vs)) : "—"]; }))];
}

/* ---------- wiring and drawing ---------- */
function wireAnalytics(model, sm, rd, one, from, to){
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
    $("#anTable").innerHTML = caseTable(sm, rd); wireAnalytics(model, sm, rd, one, from, to); });
  $$("tr[data-go]", m).forEach(r => { const go = () => location.hash = "#/analytics/" + encodeURIComponent(r.dataset.go);
    r.onclick = e => { if(!e.target.closest("a")) go(); }; r.onkeydown = e => { if(e.key === "Enter") go(); }; });
  const more = $("[data-allclips]", m);
  if(more) more.onclick = () => { AN.allClips = !AN.allClips; drawAnalytics(one && one.id); };
  const allAi = $("[data-allai]", m);
  if(allAi) allAi.onclick = () => { AN.allAi = !AN.allAi; $("#anAi").outerHTML = aiCard(rd.brief, one); wireAnalytics(model, sm, rd, one, from, to); };
  $$("[data-lens]", m).forEach(b => b.onclick = () => { const [f, o] = b.dataset.lens.split("|"); AN.lens = {f, o};
    $$("[data-lens]", m).forEach(x => x.setAttribute("aria-pressed", x === b)); drawLens(sm, rd); });
  $$("tr[data-clipsel]", m).forEach(r => { const pick = () => { AN.clip = r.dataset.clipsel;
      $$("tr[data-clipsel]", m).forEach(x => x.setAttribute("aria-selected", x === r)); drawRet(model, one, from, to); };
    r.onclick = pick; r.onkeydown = e => { if(e.key === "Enter") pick(); }; });
  plotAll(model, sm, rd, one, from, to);
  clearTimeout(AN.rt); window.onresize = () => { clearTimeout(AN.rt); AN.rt = setTimeout(() => { if($("[data-plot]")) plotAll(model, sm, rd, one, from, to); }, 150); };
}

function plotAll(model, sm, rd, one, from, to){
  const put = (id, svg, table) => { const p = $(`[data-plot="${id}"]`); if(!p) return;
    p.innerHTML = svg; const t = $(`[data-table="${id}"]`); if(t && table != null) t.innerHTML = table; };
  const W = id => { const p = $(`[data-plot="${id}"]`); return p ? Math.max(260, p.clientWidth) : 600; };
  put("moved", ...movedChart(model, sm, rd, one, W("moved")));
  put("funnel", ...funnelBars(LJ_ANALYTICS.funnel(model, one ? one.id : null, from, to)));
  put("sources", ...sourceBars(LJ_ANALYTICS.sources(model, one ? one.id : null, from, to)));
  put("talk", ...talkBars(rd.talk, one));
  if(!one){
    drawLens(sm, rd);
    put("issues", ...issueBars(rd.is, sm.range.days));
    put("backers", ...backersList(rd.bk));
  } else {
    put("cum", ...cumChart(model, one, W("cum")));
    put("stand", ...standStrips(sm, rd.dr, one));
  }
  drawRet(model, one, from, to);
}

function drawLens(sm, rd){
  const card = $(`[data-card="lens"]`); if(!card) return;
  const p = card.querySelector("[data-plot]"), [title, svg, table, read] = lensChart(sm, rd.dr, Math.max(260, p.clientWidth));
  card.querySelector("[data-title]").textContent = title || "Case by case";
  p.innerHTML = svg; card.querySelector("[data-table]").innerHTML = table; card.querySelector("[data-read]").textContent = read;
}

function drawRet(model, one, from, to){
  const clips = LJ_ANALYTICS.clipStats(model, one ? one.id : null, from, to).filter(x => x.plays > 0 && x.retention);
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
function niceStep(v){ if(!(v > 1)) return 1;   /* everything on these axes is whole dollars or whole people */
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
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

/* a column with a rounded data-end and a square foot */
const colPath = (x, y, w, h, r = 4) => { r = Math.min(r, w / 2, h); if(h <= 0) return "";
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

function axisY(max, fmt, x0, x1, y, H){
  return ticks(max).map(v => { const yy = y(v);
    return `<line class="g" x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}"/><text class="ax" x="${x0 - 8}" y="${yy + 4}" text-anchor="end">${fmt(v)}</text>`; }).join("");
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
    ${half < .9 ? `<circle class="dot" cx="${x(half * 10)}" cy="${y(.5)}" r="4.5" style="fill:var(--merit)"/>
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
    <p class="an-cs">${steps[0] && steps[0].n && steps[steps.length - 1].n ? `One investment for every ${fN(steps[0].n / steps[steps.length - 1].n)} clip plays.` : ""}</p>`;
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
