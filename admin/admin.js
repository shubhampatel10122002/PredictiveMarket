/* =====================================================================
   LaunchJustice admin
   ---------------------------------------------------------------------
   The internal side of the product, served at /admin and linked from
   nowhere. It edits the same things the site shows, in the same shapes:

     cases     the `cases` table, one row per case, holding a case exactly
               as data.js writes one (see cms.js for how the site reads it)
     video     the public `media` bucket; uploads go straight from the
               browser, with progress, and the case is saved the moment the
               file lands so a clip is never uploaded and then forgotten
     pledges   read through admin_pledges(), the only way real names and
               notes leave the database
     comments  read, and deleted when they have to be
     team      the `admins` table, which is what every write is checked
               against, so a leaked link opens a sign-in screen and nothing
               else

   The demo cases in data.js show up here too. Editing one saves a copy to
   the database that replaces it on the site, and "Revert to demo data"
   deletes the copy.
   ===================================================================== */

const CFG = window.LJ_CONFIG || {};
const RECOVERY = /type=recovery/.test(location.hash);   /* read before the client clears it */
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
const DEMO = CASES.map(c => LJ_CMS.normalize(c));   /* the code's cases, untouched by the database */

/* ============ helpers ============ */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const usd = n => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(n || 0);
const when = t => new Date(t).toLocaleString(undefined, {day:"numeric", month:"short", hour:"numeric", minute:"2-digit"});
const bytes = n => n >= 1e6 ? (n/1e6).toFixed(1)+" MB" : Math.max(1, Math.round((n||0)/1e3))+" KB";
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/, "");
const ID_OK = id => /^[a-z0-9][a-z0-9-]{1,62}$/.test(id);
const uid = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const catColor = c => (CATS[c.cat] || Object.values(CATS)[0]).color;

const toastEl = $("#toast"); let toastT;
function toast(m, ms=2600){ toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), ms); }

/* photographs sit on generated artwork and remove themselves if they fail,
   exactly as on the site */
document.addEventListener("error", e => { const t = e.target; if(t.tagName === "IMG" && t.classList.contains("fb")) t.remove(); }, true);
document.addEventListener("load",  e => { const t = e.target; if(t.tagName === "IMG" && t.classList.contains("fb")) t.classList.add("on"); }, true);

const svg = (d, w=2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  overview: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
  cases: svg('<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>'),
  clips: svg('<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor"/>'),
  media: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  pledges: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  comments: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
  team: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.6a3.2 3.2 0 0 1 0 6.3M18 14.3c1.8.8 3 2.6 3 4.7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.4),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  up: svg('<path d="M6 15l6-6 6 6"/>', 2.4),
  down: svg('<path d="M18 9l-6 6-6-6"/>', 2.4),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 2.4),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M5 15v5h14v-5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 2.4),
  lock: svg('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
  out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>')
};

/* ============ state ============ */
const S = {session:null, admin:false, rows:new Map(), shell:false};
let draft = null;           /* the case open in the editor, with unsaved edits */
let lastHash = "";

/* One list of every case, demo and database, each with where it came from.
   A database row with a demo id is an edited copy of that demo case. */
function entries(){
  const out = [], seen = new Set();
  DEMO.forEach(d => { out.push(entryOf(d.id, S.rows.get(d.id), d)); seen.add(d.id); });
  [...S.rows.values()].sort((a, b) => a.created_at < b.created_at ? -1 : 1)
    .forEach(r => { if(!seen.has(r.id)) out.push(entryOf(r.id, r, null)); });
  return out;
}
function entryOf(id, row, demo){
  const status = row ? row.status : "demo";
  return {id, row, demo, status, live: status === "demo" || status === "published",
          c: row ? LJ_CMS.normalize({...row.data, id}) : demo};
}
const entry = id => entries().find(e => e.id === id);

function statusPill(status, hasDemo){
  const p = (cls, t) => `<span class="pill ${cls}"><i></i>${t}</span>`;
  if(status === "demo") return p("live", "Live · demo data");
  if(status === "published") return p("live", hasDemo ? "Live · edited" : "Live");
  if(status === "hidden") return p("hidden", "Hidden");
  return p("draft", status === "new" ? "New" : "Draft");
}

/* what plays in a slot: a hosted file, somebody's player, or nothing yet */
const heroVid = c => ({src:c.video || "", embed:c.embed || "", poster:c.poster || "", credit:"", lead:!!c.heroLead, beats:c.beats, secs:60});
const vidKind = v => v.src ? "file" : v.embed ? "embed" : "card";
function allClips(list){
  const out = [];
  list.forEach(e => {
    out.push({e, k:"hero", v:heroVid(e.c), title:"60-second clip"});
    e.c.clips.forEach((cl, k) => out.push({e, k, v:{...cl, src:cl.src || ""}, title:cl.title || "Untitled clip"}));
  });
  return out;
}
const milestone = (c, m) => (c.timeline[m] && c.timeline[m][0]) || "Case file";

/* ============ sign in ============ */
async function start(){
  const {data:{session}} = await sb.auth.getSession();
  S.session = session;
  sb.auth.onAuthStateChange((ev, s) => {
    const before = S.session && S.session.user.id;
    S.session = s;
    if(ev === "PASSWORD_RECOVERY") return setTimeout(renderRecovery);
    /* never call back into the client from inside this callback */
    if((s && s.user.id) !== before) setTimeout(enter);
  });
  if(RECOVERY && session) return renderRecovery();
  enter();
}

async function enter(){
  S.shell = false;
  if(!S.session) return renderGate();
  const {data, error} = await sb.rpc("is_admin");
  if(error){ console.error(error); return renderGate("Couldn't reach the database. Try again in a moment."); }
  S.admin = !!data;
  if(!S.admin) return renderNotAdmin();
  await loadCases();
  route();
}

async function loadCases(){
  const {data, error} = await sb.from("cases").select("*");
  if(error){ toast("Couldn't load cases: " + error.message); return; }
  S.rows = new Map(data.map(r => [r.id, r]));
}

const gate = inner => { $("#app").innerHTML = `<div class="gate"><div class="gate-card">
  <div class="row"><span class="wordmark">Launch<span>Justice</span></span><span class="kick">Admin</span></div>${inner}</div></div>`; };

function renderGate(msg){
  gate(`<h1>Sign in to the admin</h1>
    <p class="sub">Use your LaunchJustice account. Only accounts on the team list get in.</p>
    <form id="signin" novalidate>
      <label class="f" for="em">Email</label><input class="inp" id="em" type="email" autocomplete="username" required>
      <label class="f" for="pw">Password</label><input class="inp" id="pw" type="password" autocomplete="current-password" required>
      <div class="err" id="err">${esc(msg || "")}</div>
      <button class="btn primary" type="submit">Sign in</button>
    </form>
    <p class="hint">Forgot it? <button class="link" id="forgot">Email me a reset link</button></p>`);
  $("#em").focus();
  $("#signin").addEventListener("submit", async e => {
    e.preventDefault();
    const b = e.target.querySelector("button"); b.disabled = true; $("#err").textContent = "";
    const {error} = await sb.auth.signInWithPassword({email:$("#em").value.trim(), password:$("#pw").value});
    b.disabled = false;
    if(error) $("#err").textContent = /invalid/i.test(error.message) ? "That email and password don't match." : error.message;
  });
  $("#forgot").addEventListener("click", async () => {
    const email = $("#em").value.trim();
    if(!email) { $("#err").textContent = "Type your email first."; $("#em").focus(); return; }
    const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + "/admin/"});
    $("#err").textContent = error ? error.message : "";
    if(!error) toast("Check your email for the reset link");
  });
}

function renderRecovery(){
  gate(`<h1>Set a new password</h1><p class="sub">Then you're straight in.</p>
    <form id="setpw"><label class="f" for="np">New password</label>
      <input class="inp" id="np" type="password" minlength="6" autocomplete="new-password" required>
      <div class="err" id="err"></div><button class="btn primary" type="submit">Save password</button></form>`);
  $("#setpw").addEventListener("submit", async e => {
    e.preventDefault();
    const {error} = await sb.auth.updateUser({password:$("#np").value});
    if(error) return $("#err").textContent = error.message;
    toast("Password saved"); enter();
  });
}

function renderNotAdmin(){
  gate(`<h1>This account isn't an admin</h1>
    <p class="sub">You're signed in as <b>${esc(S.session.user.email)}</b>, which isn't on the team list. An admin can add you under Team.</p>
    <button class="btn primary" id="so">Sign in with another account</button>`);
  $("#so").addEventListener("click", () => sb.auth.signOut());
}

/* ============ frame and routing ============ */
const NAV = [["overview","Overview",I.overview],["cases","Cases",I.cases],["clips","Clips & video",I.clips],
             ["media","Media library",I.media],["pledges","Pledges",I.pledges],["comments","Comments",I.comments],["team","Team",I.team]];

function shell(page){
  if(!S.shell){
    $("#app").innerHTML = `<div class="a-shell">
      <aside class="a-side">
        <div class="a-brand"><span class="wordmark">Launch<span>Justice</span></span><span class="kick">Admin</span></div>
        <nav class="a-nav" aria-label="Admin">${NAV.map(([k, t, ic]) => `<a href="#/${k}" data-nav="${k}">${ic}${t}${k === "clips" ? '<span class="n" id="needN" hidden></span>' : ""}</a>`).join("")}</nav>
        <div class="a-foot"><small class="muted">Signed in as</small><b>${esc(S.session.user.email)}</b>
          <div class="row"><a href="/" target="_blank" rel="noopener">${I.ext}View site</a><button id="signout">${I.out}Sign out</button></div></div>
      </aside>
      <main class="a-main" id="main"></main></div>`;
    const main = $("#main");
    main.addEventListener("input", onField); main.addEventListener("change", onField); main.addEventListener("click", onAct);
    $("#signout").addEventListener("click", () => { if(!draft || !draft.dirty || confirm("Discard unsaved changes and sign out?")) sb.auth.signOut(); });
    S.shell = true;
  }
  const nav = page === "case" ? "cases" : page;
  $$("[data-nav]").forEach(a => a.dataset.nav === nav ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const need = allClips(entries().filter(e => e.live)).filter(x => vidKind(x.v) === "card").length;
  const n = $("#needN"); n.hidden = !need; n.textContent = need;
  n.title = need + " clips on live cases have no video yet";
  window.scrollTo(0, 0);
  return $("#main");
}

function route(){
  if(!S.admin) return;
  const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const [page = "overview", a, b, c] = parts;
  /* leaving a case with unsaved edits asks first */
  if(draft && draft.dirty && !(page === "case" && a === (draft.isNew ? "new" : draft.c.id))){
    if(!confirm("You have unsaved changes to this case. Leave without saving?")){
      history.replaceState(null, "", lastHash || "#/cases"); return;
    }
    draft = null;
  }
  lastHash = location.hash;
  if(page !== "case"){ draft = null; closeDrawer(true); }
  const pages = {overview:pageOverview, cases:pageCases, clips:pageClips, media:pageMedia, pledges:pagePledges, comments:pageComments, team:pageTeam};
  if(page === "case") return pageCase(a, b || "basics", c);
  (pages[page] || pageOverview)();
}
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", e => { if(draft && draft.dirty){ e.preventDefault(); e.returnValue = ""; } });

const head = (title, sub, right="") => `<div class="a-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="row">${right}</div></div>`;

/* ============ overview ============ */
async function pageOverview(){
  const m = shell("overview"), es = entries();
  const live = es.filter(e => e.live), drafts = es.filter(e => e.status === "draft");
  const clips = allClips(live), filmed = clips.filter(x => vidKind(x.v) !== "card");
  const needs = clips.filter(x => vidKind(x.v) === "card");
  m.innerHTML = `<div class="a-inner">
    ${head("Overview", "Everything on LaunchJustice, and what needs doing next.",
      `<a class="btn line" href="#/clips">${I.upload}Upload a clip</a><a class="btn primary" href="#/case/new">${I.plus}New case</a>`)}
    <div class="tiles">
      <div class="tile hl"><small>Live cases</small><b>${live.length}</b><span>${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting</span></div>
      <div class="tile"><small>Clips with video</small><b>${filmed.length}<span style="display:inline;font-size:18px"> / ${clips.length}</span></b><span>${needs.length} still play as caption cards</span></div>
      <div class="tile"><small>Invested on the site</small><b id="tInv"><span class="spin"></span></b><span id="tInvN">&nbsp;</span></div>
      <div class="tile"><small>Comments</small><b id="tCom"><span class="spin"></span></b><span>Written on the site</span></div>
    </div>
    <h2 class="a-h">Needs a video <small>${needs.length} clips on live cases are caption cards</small></h2>
    ${needs.length ? `<div class="cgrid">${needs.slice(0, 12).map(clipCard).join("")}</div>`
      : `<div class="empty-card"><b>Every live clip has video</b>Nothing waiting.</div>`}
    <div class="cols">
      <div><h2 class="a-h">Latest pledges <small><a href="#/pledges">All</a></small></h2><div id="lp" class="list2"><div class="loading"><span class="spin"></span></div></div></div>
      <div><h2 class="a-h">Latest comments <small><a href="#/comments">All</a></small></h2><div id="lc" class="list2"><div class="loading"><span class="spin"></span></div></div></div>
    </div></div>`;

  const [p, c] = await Promise.all([
    sb.rpc("admin_pledges"),
    sb.from("comments").select("*", {count:"exact"}).order("created_at", {ascending:false}).limit(5)
  ]);
  if(!$("#tInv")) return;   /* navigated away */
  const pl = p.data || [];
  $("#tInv").textContent = usd(pl.reduce((s, r) => s + r.amount, 0));
  $("#tInvN").textContent = pl.length + " pledge" + (pl.length === 1 ? "" : "s");
  $("#tCom").textContent = num(c.count || 0);
  $("#lp").innerHTML = pl.slice(0, 5).map(pledgeLi).join("") || `<div class="empty">No pledges yet.</div>`;
  $("#lc").innerHTML = (c.data || []).map(r => commentLi(r, false)).join("") || `<div class="empty">No comments yet.</div>`;
}
const caseTitle = id => { const e = entry(id); return e ? (e.c.title || e.c.head || id) : id; };
const pledgeLi = r => `<div class="li"><span class="av">${esc((r.name || "?").charAt(0).toUpperCase())}</span>
  <div class="grow"><div class="who"><b>${esc(r.name)}</b>${r.display_name !== r.name ? `<small>shown as ${esc(r.display_name)}</small>` : ""}<small>· ${when(r.created_at)}</small></div>
  <p class="muted" style="margin-top:2px">${esc(caseTitle(r.case_id))}</p>${r.note ? `<p>“${esc(r.note)}”</p>` : ""}</div><b>${usd(r.amount)}</b></div>`;

/* ============ cases ============ */
let caseFilter = "all", caseQuery = "";
function pageCases(){
  const m = shell("cases");
  m.innerHTML = `<div class="a-inner">
    ${head("Cases", "Every case on the platform. Demo cases come from the code until you edit one, which saves a copy here that replaces it on the site.",
      `<a class="btn primary" href="#/case/new">${I.plus}New case</a>`)}
    <div class="bar"><input class="search inp" id="q" type="search" placeholder="Search cases" value="${esc(caseQuery)}">
      <div class="chips">${[["all","All"],["live","Live"],["draft","Drafts"],["hidden","Hidden"]].map(([k, t]) =>
        `<button class="chip" data-f="${k}" aria-pressed="${k === caseFilter}">${t}</button>`).join("")}</div></div>
    <div class="clist" id="clist"></div></div>`;
  const draw = () => {
    const q = caseQuery.toLowerCase();
    const list = entries().filter(e => (caseFilter === "all" || (caseFilter === "live" ? e.live : e.status === caseFilter))
      && (!q || [e.id, e.c.head, e.c.title, e.c.ngo, e.c.caseName].join(" ").toLowerCase().includes(q)));
    $("#clist").innerHTML = list.map(caseRow).join("") ||
      `<div class="empty-card"><b>No cases here</b>${caseFilter === "draft" ? "Drafts you save show up here until you publish them." : "Try a different search."}</div>`;
  };
  $("#q").addEventListener("input", e => { caseQuery = e.target.value; draw(); });
  $$("[data-f]").forEach(b => b.addEventListener("click", () => {
    caseFilter = b.dataset.f; $$("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); }));
  draw();
}
function caseRow(e){
  const c = e.c, cl = allClips([e]), vids = cl.filter(x => vidKind(x.v) !== "card").length;
  return `<a class="crow" href="#/case/${encodeURIComponent(e.id)}">
    <span class="thumb" style="--cat:${catColor(c)}">${heroArt(c)}${c.hero ? `<img class="fb" alt="" loading="lazy" src="${esc(c.hero.src)}">` : ""}</span>
    <span style="min-width:0"><span class="cat"><span class="dot" style="background:${catColor(c)}"></span>${esc((CATS[c.cat] || {}).label)}</span>
      <h3>${esc(c.head || c.title || "Untitled case")}</h3>
      <span class="sub"><span class="mono">${esc(e.id)}</span><span>${vids}/${cl.length} clips with video</span><span>Goal ${usd(c.goal)}</span></span></span>
    <span class="right">${scoreTiny(c, 34)}${statusPill(e.status, !!e.demo)}</span></a>`;
}

/* ============ case editor ============ */
const TABS = [["basics","Basics"],["story","60-second clip"],["clips","Clips"],["scores","Scores"],["money","Money & outcomes"],
              ["timeline","Timeline"],["people","People"],["details","Details"],["json","Raw data"]];

function pageCase(id, tab, clip){
  const isNew = id === "new";
  if(!draft || (isNew ? !draft.isNew : draft.isNew || draft.c.id !== id)){
    if(isNew){
      draft = {c:LJ_CMS.blankCase(""), isNew:true, status:"new", hasDemo:false, hasRow:false, dirty:false, idTouched:false};
    } else {
      const e = entry(id);
      if(!e){ shell("case").innerHTML = `<div class="a-inner"><div class="empty-card"><b>No case called “${esc(id)}”</b><a href="#/cases">Back to cases</a></div></div>`; return; }
      draft = {c:structuredClone(e.c), isNew:false, status:e.status, hasDemo:!!e.demo, hasRow:!!e.row, dirty:false};
    }
    if(!draft.c.hero) draft.c.hero = {src:"", credit:""};
  }
  if(!TABS.some(t => t[0] === tab)) tab = "basics";
  draft.tab = tab;
  const m = shell("case");
  m.innerHTML = `<div class="ed-top" id="edTop"></div>
    <div class="a-inner"><nav class="tabs" id="tabs"></nav>
    <div class="ed"><div id="tab"></div><aside class="ed-prev"><div class="pv" id="pv"><div id="pvHero"></div><div class="pv-body" id="pvBody"></div></div>
      <div class="card" id="vis" style="margin-top:14px"></div></aside></div></div>`;
  drawTop(); drawTabs(); drawTab(); drawPreview(true); drawVis();
  if(clip !== undefined){
    if(clip === "new"){
      draft.c.clips.push({id:uid(), title:"", milestone:0, secs:60, src:null, beats:[], lead:true});
      markDirty(); history.replaceState(null, "", `#/case/${enc()}/clips/${draft.c.clips.length - 1}`); lastHash = location.hash;
      drawTab(); openDrawer(draft.c.clips.length - 1);
    } else if(draft.c.clips[+clip]) openDrawer(+clip);
  } else closeDrawer(true);
}
const enc = () => encodeURIComponent(draft.isNew ? "new" : draft.c.id);

function drawTop(){
  const d = draft, c = d.c, live = d.status === "demo" || d.status === "published";
  const top = $("#edTop"); if(!top) return;
  top.classList.toggle("is-dirty", d.dirty);
  top.innerHTML = `<a class="back" href="#/cases">${I.back}Cases</a>
    <h1>${esc(c.head || c.title || "New case")}</h1>${statusPill(d.status, d.hasDemo)}<span class="dirty">● Unsaved</span>
    ${live && !d.isNew ? `<a class="btn line sm" href="/#case=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${I.ext}View on site</a>` : ""}
    ${live ? `<button class="btn primary sm" data-act="save">Save changes</button>`
      : d.status === "hidden" ? `<button class="btn line sm" data-act="save">Save</button><button class="btn primary sm" data-act="publish">Show on site</button>`
      : `<button class="btn line sm" data-act="save">Save draft</button><button class="btn primary sm" data-act="publish">Publish</button>`}`;
}
function drawTabs(){
  $("#tabs").innerHTML = TABS.map(([k, t]) => `<a href="#/case/${enc()}/${k}" ${k === draft.tab ? 'aria-current="page"' : ""}>${t}${
    k === "clips" ? `<span class="n">${draft.c.clips.length}</span>` : ""}</a>`).join("");
}
function drawVis(){
  const d = draft, el = $("#vis"); if(!el) return;
  const say = {demo:"Live on the site from the demo data in code. Saving here makes an edited copy that replaces it.",
    published: d.hasDemo ? "Live on the site, replacing the demo version." : "Live on the site.",
    draft:"Only admins can see this. Publish to put it on the site.", new:"Not saved yet.", hidden:"Taken off the site. Nothing is deleted."}[d.status];
  el.innerHTML = `<b style="font-size:15px">Visibility</b><p class="note" style="margin-top:4px">${say}</p><div class="row wrap" style="margin-top:12px">
    ${d.status === "demo" || d.status === "published" ? `<button class="btn line sm" data-act="hide">Hide from site</button>` : ""}
    ${d.hasRow && d.hasDemo ? `<button class="btn danger sm" data-act="revert">Revert to demo data</button>` : ""}
    ${d.hasRow && !d.hasDemo ? `<button class="btn danger sm" data-act="delete">${I.trash}Delete case</button>` : ""}</div>`;
}

/* The preview is the case card from the site, redrawn as you type. The
   photograph is only redrawn when it changes, so it doesn't flicker. */
let pvKey = "", pvT;
function drawPreview(force){
  const c = LJ_CMS.normalize(draft.c), hero = $("#pvHero"); if(!hero) return;
  const key = c.cat + "|" + (c.hero ? c.hero.src : "") + "|" + c.id;
  $("#pv").style.setProperty("--cat", catColor(c));
  const text = `<div class="pv-in"><span class="cpill"><span class="dot"></span>${esc(CATS[c.cat].label)}</span>
    <h2>${esc(c.head || "Your headline goes here")}</h2><small>${esc([c.caseName, c.court].filter(Boolean).join(" · ") || "Case name · Court")}</small></div>`;
  if(force || key !== pvKey){
    hero.className = "pv-hero";
    hero.innerHTML = heroArt(c) + (c.hero ? `<img class="fb" alt="" src="${esc(c.hero.src)}">` : "") + text;
    pvKey = key;
  } else hero.querySelector(".pv-in").outerHTML = text;
  const pct = Math.min(100, Math.round(c.baseRaised / c.goal * 100));
  const cl = allClips([{c}]), vids = cl.filter(x => vidKind(x.v) !== "card").length;
  $("#pvBody").innerHTML = `${scorePair(c, 64)}
    <div class="lbar"><i style="width:${pct}%;background:var(--cat)"></i></div>
    <div class="lnums"><span><b>${usd(c.baseRaised)}</b> of ${usd(c.goal)}</span><span>${num(c.baseBackers)} backers</span></div>
    <div class="pv-lock">${I.lock.replace("<svg", '<svg width="15" height="15"')}<span><b>Locked ~${lockYears(c)} years</b>, to ${endYear(c)} · ${esc(STAGES[c.stageIdx])} now</span></div>
    <div class="pv-lock">${I.clips.replace("<svg", '<svg width="15" height="15"')}<span>${vids} of ${cl.length} clips have video</span></div>
    <p class="pv-note">Scores are worked out from the factors on the Scores tab, the same way the site does it.</p>`;
}
const schedulePreview = () => { cancelAnimationFrame(pvT); pvT = requestAnimationFrame(() => { drawPreview(); drawViz(); }); };

function markDirty(){ if(!draft.dirty){ draft.dirty = true; drawTop(); } }

/* ---------- binding ----------
   Every input carries data-k, the path it writes to in the case, and data-t,
   how to read it. Nothing is re-rendered while you type except the preview
   and the charts, so the cursor never jumps. */
function getPath(o, path){ return path.split(".").reduce((x, k) => x == null ? x : x[k], o); }
function setPath(o, path, v){
  const ks = path.split(".");
  ks.slice(0, -1).forEach((k, i) => { if(o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; });
  o[ks[ks.length - 1]] = v;
}
function readField(el){
  const t = el.dataset.t || "s";
  if(el.type === "checkbox") return t === "b01" ? (el.checked ? 1 : 0) : el.checked;
  if(t === "n") return el.value === "" ? 0 : +el.value;
  if(t === "pct") return (+el.value || 0) / 100;
  if(t === "lines") return el.value.split("\n").map(x => x.trim()).filter(Boolean);
  if(t === "paras") return el.value.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if(t === "csvn") return el.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  return el.value;
}
function onField(e){
  const el = e.target.closest("[data-k]"); if(!el || !draft) return;
  const discrete = el.tagName === "SELECT" || el.type === "checkbox";
  if((e.type === "change") !== discrete) return;   /* each field is read once, on the event that suits it */
  const path = el.dataset.k;
  if(path === "id"){ draft.idTouched = true; el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }
  setPath(draft.c, path, readField(el));
  if(draft.isNew && !draft.idTouched && (path === "head" || path === "title")){
    draft.c.id = slug(draft.c.title || draft.c.head); const f = $('[data-k="id"]'); if(f) f.value = draft.c.id;
  }
  if(path === "trendingOn"){ draft.c.trending = el.checked ? {reason:"", kind:"backing", spark:[]} : null; delete draft.c.trendingOn; drawTab(); }
  if(/^why\.\d+\.kind$/.test(path)){
    const w = getPath(draft.c, path.replace(/\.kind$/, ""));
    if(w.kind === "dots"){ w.value = parseInt(w.value, 10) || 0; w.of = w.of || 100; } else delete w.of;
    drawTab();
  }
  if(/\.delta$/.test(path)) el.classList.toggle("up", +el.value > 0), el.classList.toggle("down", +el.value < 0);
  markDirty(); schedulePreview();
  if(el.closest("#drawer") && /^clips\.\d+\.title$/.test(path)) $("#drawer h2").textContent = el.value || "Untitled clip";
}

const TPL = {
  factor: () => ({label:"", delta:0, note:""}), impact: () => ({label:"", weight:0, score:50, note:""}),
  time: () => ["", "", 0], budget: () => ["", 0], stat: () => ["", ""],
  update: () => [new Date().toLocaleDateString("en-GB", {month:"short", year:"numeric"}), ""],
  why: () => ({kind:"stat", value:"", label:"", note:""})
};

async function onAct(e){
  const b = e.target.closest("[data-act],[data-add],[data-del],[data-mv],[data-cat],[data-clip]"); if(!b || !draft) return;
  const d = draft;
  if(b.dataset.cat){ d.c.cat = b.dataset.cat; markDirty(); drawTab(); drawPreview(); return; }
  if(b.dataset.clip !== undefined){ e.preventDefault(); location.hash = `#/case/${enc()}/clips/${b.dataset.clip}`; return; }
  if(b.dataset.add){ const arr = getPath(d.c, b.dataset.add) || []; arr.push(TPL[b.dataset.tpl]()); setPath(d.c, b.dataset.add, arr); markDirty(); redraw(); return; }
  if(b.dataset.del){ const ks = b.dataset.del.split("."), i = +ks.pop(); getPath(d.c, ks.join(".")).splice(i, 1); markDirty(); redraw(); return; }
  if(b.dataset.mv){
    const ks = b.dataset.mv.split("."), i = +ks.pop(), arr = getPath(d.c, ks.join(".")), j = i + (+b.dataset.dir);
    if(j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    /* clips point at timeline rows by index, so moving a row moves them too */
    if(ks.join(".") === "timeline") d.c.clips.forEach(cl => { cl.milestone = cl.milestone === i ? j : cl.milestone === j ? i : cl.milestone; });
    markDirty(); redraw();
    if(ks[0] === "clips" && $("#drawer").classList.contains("on")) location.hash = `#/case/${enc()}/clips/${j}`;
    return;
  }
  const act = b.dataset.act;
  if(act === "save") return save();
  if(act === "publish") return save("published");
  if(act === "hide") return save("hidden");
  if(act === "revert" || act === "delete"){
    if(!confirm(act === "revert" ? "Throw away every edit to this case and go back to the demo data?" : "Delete this case for good? Its uploaded files stay in the media library.")) return;
    const {error} = await sb.from("cases").delete().eq("id", d.c.id);
    if(error) return toast(error.message);
    S.rows.delete(d.c.id); const id = d.c.id; draft = null;
    toast(act === "revert" ? "Back to the demo data" : "Case deleted");
    const h = act === "revert" ? `#/case/${encodeURIComponent(id)}` : "#/cases";
    if(location.hash === h) route(); else location.hash = h;
    return;
  }
  if(act === "normw"){
    const f = d.c.impact.factors, t = f.reduce((s, x) => s + x.weight, 0) || 1;
    f.forEach(x => x.weight = Math.round(x.weight / t * 100) / 100); markDirty(); redraw(); return;
  }
  if(act === "applyjson"){
    try{ const c = JSON.parse($("#jsonBox").value); d.c = {...LJ_CMS.normalize({...c, id:d.c.id})}; if(!d.c.hero) d.c.hero = {src:"", credit:""};
      markDirty(); drawPreview(true); toast("Applied. Save to keep it."); }
    catch(err){ toast("That isn't valid JSON: " + err.message, 4000); }
    return;
  }
  if(act === "copyjson"){ navigator.clipboard.writeText($("#jsonBox").value).then(() => toast("Copied")); return; }
  if(act === "photo") return pickFile("image/*", f => takePhoto(f));
  if(act === "addclip"){ location.hash = `#/case/${enc()}/clips/new`; return; }
}
function redraw(){ const y = window.scrollY; drawTab(); if($("#drawer").classList.contains("on") && draft.openClip != null) drawDrawer(); drawPreview(); drawTabs(); window.scrollTo(0, y); }

/* ---------- saving ---------- */
function ensureId(){
  const d = draft;
  if(!d.isNew) return true;
  if(!d.c.id) d.c.id = slug(d.c.title || d.c.head);
  const clash = entries().some(e => e.id === d.c.id);
  if(!ID_OK(d.c.id) || clash){
    toast(clash ? "Another case already uses the ID “" + d.c.id + "”. Change it on Basics." : "Give the case a headline first, so it has an ID.", 4000);
    if(d.tab !== "basics") location.hash = `#/case/new/basics`;
    return false;
  }
  return true;
}
async function save(status){
  const d = draft; if(!d || !ensureId()) return false;
  const st = status || (d.status === "demo" ? "published" : d.status === "new" ? "draft" : d.status);
  const data = LJ_CMS.normalize(d.c);
  const btns = $$("#edTop .btn"); btns.forEach(b => b.disabled = true);
  const {data:row, error} = await sb.from("cases").upsert({id:d.c.id, data, status:st, updated_by:S.session.user.id}).select().single();
  btns.forEach(b => b.disabled = false);
  if(error){ toast("Couldn't save: " + error.message, 5000); return false; }
  S.rows.set(row.id, row);
  const wasNew = d.isNew;
  Object.assign(d, {status:st, isNew:false, hasRow:true, dirty:false});
  toast(st === "published" ? "Saved. It's live on the site." : st === "hidden" ? "Saved and hidden from the site" : "Saved as a draft");
  if(wasNew){
    const clipPart = $("#drawer").classList.contains("on") && draft.openClip != null ? "/" + draft.openClip : "";
    history.replaceState(null, "", `#/case/${encodeURIComponent(d.c.id)}/${d.tab}${clipPart}`); lastHash = location.hash;
    if(d.tab === "basics") drawTab();
  }
  drawTop(); drawTabs(); drawVis();
  return true;
}
document.addEventListener("keydown", e => {
  if((e.metaKey || e.ctrlKey) && e.key === "s" && draft){ e.preventDefault(); save(); }
  if(e.key === "Escape" && $("#drawer").classList.contains("on")) closeDrawer();
});

/* ---------- form pieces ---------- */
function fld(label, path, o={}){
  const v = getPath(draft.c, path), t = o.t || "s";
  let shown = v ?? "";
  if(t === "pct") shown = v == null ? "" : Math.round(v * 1000) / 10;
  if(t === "lines") shown = (v || []).join("\n");
  if(t === "paras") shown = (v || []).join("\n\n");
  if(t === "csvn") shown = (v || []).join(", ");
  const a = `class="inp${o.cls ? " " + o.cls : ""}" data-k="${path}" data-t="${t}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}${o.dis ? " disabled" : ""}${label === null ? ` aria-label="${esc(o.ph || path)}"` : ""}`;
  const input = o.area ? `<textarea ${a} rows="${o.rows || 3}">${esc(shown)}</textarea>`
    : o.opts ? `<select ${a}>${o.opts.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`
    : `<input ${a} type="${["n","pct"].includes(t) ? "number" : "text"}"${o.step ? ` step="${o.step}"` : ""}${o.min != null ? ` min="${o.min}"` : ""} value="${esc(shown)}">`;
  if(label === null) return input;
  return `<div${o.wide ? ' style="grid-column:1/-1"' : ""}><label class="f">${esc(label)}${o.help ? `<small>${esc(o.help)}</small>` : ""}</label>${input}</div>`;
}
const chk = (label, path, t) => `<label class="chk"><input type="checkbox" data-k="${path}"${t ? ` data-t="${t}"` : ""}${getPath(draft.c, path) ? " checked" : ""}>${esc(label)}</label>`;
const tools = (path, i, n, move=true) => `<span class="rep-tools">${move ? `<button class="ib" data-mv="${path}.${i}" data-dir="-1" ${i ? "" : "disabled"} aria-label="Move up">${I.up}</button>
  <button class="ib" data-mv="${path}.${i}" data-dir="1" ${i < n - 1 ? "" : "disabled"} aria-label="Move down">${I.down}</button>` : ""}
  <button class="ib del" data-del="${path}.${i}" aria-label="Remove">${I.trash}</button></span>`;
const addBtn = (path, tpl, t) => `<button class="add" data-add="${path}" data-tpl="${tpl}">+ ${t}</button>`;
const sec = (title, help, body) => `<section class="sec-card"><h3>${title}</h3>${help ? `<p class="help">${help}</p>` : ""}${body}</section>`;

function drawTab(){
  const el = $("#tab"); if(!el) return;
  el.innerHTML = ({basics:tabBasics, story:tabStory, clips:tabClips, scores:tabScores, money:tabMoney,
                   timeline:tabTimeline, people:tabPeople, details:tabDetails, json:tabJson}[draft.tab])();
  el.style.setProperty("--cat", catColor(draft.c));
  drawViz(); wireDrops(el);
}

function tabBasics(){
  const c = draft.c;
  return sec("The case", "What people read first, on the clip and at the top of the case page.", `
    ${fld("Headline", "head", {ph:"Forty families got eviction notices in the same week. No reason given.", help:"One sentence, a person not a statute"})}
    ${fld("Short title", "title", {ph:"Stop no-cause evictions in Maple County", help:"Used in lists and on the investments page"})}
    <label class="f">Category</label><div class="catpick">${Object.entries(CATS).map(([k, v]) =>
      `<button type="button" data-cat="${k}" style="--cat:${v.color}" aria-pressed="${c.cat === k}"><span class="dot"></span>${esc(v.label)}</button>`).join("")}</div>
    <div class="g2">${fld("Case name, as filed", "caseName", {ph:"Alvarez v. Northgate Property Management"})}${fld("Brought by", "ngo", {ph:"Tenant Defense Fund"})}</div>
    <div class="g3">${fld("Defendant", "defendant")}${fld("Court", "court")}${fld("Judge", "judge")}</div>
    <div class="g2">${fld("Vetted on", "vetted", {ph:"21 Apr 2026"})}
      ${fld("Case ID", "id", {dis:!draft.isNew, cls:"mono", help:draft.isNew ? "Made from the title. Lowercase and dashes." : "Fixed once saved", ph:"maple-evictions"})}</div>`)
  + sec("Banner photograph", "Sits over generated artwork in the category colour, so a missing photo never looks broken.", `
    <div class="vp" style="grid-template-columns:240px 1fr;margin-top:10px">
      <div class="thumb" style="aspect-ratio:16/10;border-radius:14px;--cat:${catColor(c)}">${heroArt(c)}${c.hero && c.hero.src ? `<img class="fb" alt="" src="${esc(c.hero.src)}">` : ""}</div>
      <div><div class="row"><button class="btn line sm" data-act="photo">${I.upload}Upload a photo</button><span class="prog-t" id="photoProg"></span></div>
        ${fld("Or paste an image link", "hero.src", {ph:"https://…"})}${fld("Credit", "hero.credit", {ph:"Photo: …"})}</div></div>`)
  + sec("Trending", "Puts the case in the Trending rail and badges it everywhere.", `
    <div style="margin-top:10px"><label class="chk"><input type="checkbox" data-k="trendingOn"${c.trending ? " checked" : ""}>Show this case as trending</label></div>
    ${c.trending ? `<div class="g3">${fld("Why it's trending", "trending.reason", {ph:"+1,842 backers this week"})}
      ${fld("Kind", "trending.kind", {opts:[["backing","Backing"],["news","In the news"],["talk","Talked about"]]})}
      ${fld("Last 7 days", "trending.spark", {t:"csvn", ph:"41, 58, 49, 77, 96, 142, 188"})}</div>` : ""}`);
}

function tabStory(){
  return sec("The 60-second clip", "Opens the case page and plays in the Watch feed. Upload a vertical video, paste a YouTube or Vimeo link, or leave it empty and it plays as a caption card made from the beats below.",
    vpHTML("hero"))
  + sec("Beats", "One line per beat, about five. They're the captions when there's no video, and the written version when there is.",
    fld(null, "beats", {t:"lines", area:true, rows:6, ph:"Forty families got eviction notices in one week.\nNo reason given. Rents doubled after.\n…"}));
}

function tabClips(){
  const c = draft.c;
  return sec("Clips", "Short vertical clips, each tied to a moment on the timeline. They play in the case's clip rail, the full-screen player and the Watch feed.",
    `<div class="cgrid" style="margin-top:14px">${c.clips.map((cl, k) => clipCard({e:{c, id:c.id}, k, v:{...cl, src:cl.src || ""}, title:cl.title || "Untitled clip"}, true)).join("")}
      <button class="ccard addc" data-act="addclip"><span class="thumb"><span>${I.plus}Add a clip</span></span></button></div>`);
}

function tabScores(){
  const c = draft.c;
  return sec("Chance to win", "Starts at how often cases like this win, then each factor moves it up or down. The score is never typed in.", `
    <div class="g2">${fld("Base rate", "merit.base", {t:"n", help:"% of similar cases that win", min:0})}
      <div><label class="f">Chance to win, worked out</label><div class="big" data-viz="merit" style="color:var(--merit)"></div></div></div>
    ${fld("Where the base rate comes from", "merit.baseNote", {area:true, rows:2})}
    <label class="f">Factors <small>Label · points up or down · why</small></label>
    <div class="rep">${c.merit.factors.map((f, i) => `<div class="rep-row r-factor">
      ${fld(null, `merit.factors.${i}.label`, {ph:"Factor"})}
      ${fld(null, `merit.factors.${i}.delta`, {t:"n", ph:"±", cls:"delta " + (f.delta > 0 ? "up" : f.delta < 0 ? "down" : "")})}
      ${fld(null, `merit.factors.${i}.note`, {area:true, rows:2, ph:"Why it moves the number", cls:"note-inp"})}
      ${tools("merit.factors", i, c.merit.factors.length)}</div>`).join("")}</div>
    ${addBtn("merit.factors", "factor", "Add a factor")}
    <div class="viz-box" data-viz="waterfall"></div>`)
  + sec("Social impact", "The weighted average of its factors. Weights should add up to 100%.", `
    <div class="rep">${c.impact.factors.map((f, i) => `<div class="rep-row r-impact">
      ${fld(null, `impact.factors.${i}.label`, {ph:"Factor"})}
      ${fld(null, `impact.factors.${i}.weight`, {t:"pct", ph:"Weight %"})}
      ${fld(null, `impact.factors.${i}.score`, {t:"n", ph:"Score", min:0})}
      ${fld(null, `impact.factors.${i}.note`, {area:true, rows:2, ph:"What this is based on", cls:"note-inp"})}
      ${tools("impact.factors", i, c.impact.factors.length)}</div>`).join("")}</div>
    ${addBtn("impact.factors", "impact", "Add a factor")}
    <div data-viz="wsum"></div>
    <div class="viz-box" data-viz="bloom"></div>`);
}

function tabMoney(){
  const c = draft.c;
  return sec("Funding", "Starting numbers for the case. Real pledges from the site are added on top of these.", `
    <div class="g2">${fld("Goal", "goal", {t:"n", help:"$", min:1})}${fld("Already raised", "baseRaised", {t:"n", help:"$", min:0})}
      ${fld("Backers so far", "baseBackers", {t:"n", min:0})}${fld("Watching now", "watching", {t:"n", min:0})}</div>`)
  + sec("How it ends", "The three endings on the outcome fan. The chances should add up to 100%.", `
    <div class="g3">${fld("Win", "outcomes.win", {t:"pct", help:"%"})}${fld("Settle", "outcomes.settle", {t:"pct", help:"%"})}${fld("Lose", "outcomes.lose", {t:"pct", help:"%"})}</div>
    <div data-viz="osum"></div>
    <div class="g2">${fld("Award, as a multiple of the goal", "outcomes.awardMult", {t:"n", step:.1, min:0})}
      ${fld("A settlement pays", "outcomes.settleShare", {t:"pct", help:"% of a win"})}</div>
    ${fld("Note under the fan", "outcomes.note", {area:true, rows:2})}`)
  + sec("Stages and lock-in", "Each stage's length is the schedule, so the runway and the lock-in can't disagree.", `
    <div class="g3">${fld("Started", "start", {ph:"Apr 2026"})}${fld("Start year", "startYear", {t:"n"})}
      ${fld("Stage now", "stageIdx", {t:"n", opts:STAGES.map((s, i) => [i, s])})}</div>
    <label class="f">Months in each stage</label>
    <div class="g6">${STAGES.map((s, i) => `<div><small class="muted" style="font-size:12px">${s}</small>${fld(null, `stageMonths.${i}`, {t:"n", min:1, ph:s})}</div>`).join("")}</div>
    <div class="viz-box" data-viz="runway"></div>`)
  + sec("What the money pays for", "", `<div class="rep">${c.budget.map((r, i) => `<div class="rep-row r-budget">
      ${fld(null, `budget.${i}.0`, {ph:"Expert witnesses"})}${fld(null, `budget.${i}.1`, {t:"n", ph:"$"})}${tools("budget", i, c.budget.length, false)}</div>`).join("")}</div>
    ${addBtn("budget", "budget", "Add a line")}<div data-viz="btot"></div>`);
}

function tabTimeline(){
  const c = draft.c;
  return sec("Timeline", "Milestones in order. Clips are tied to these, and a ticked one is done.", `
    <div class="rep">${c.timeline.map((r, i) => `<div class="rep-row r-time">
      ${fld(null, `timeline.${i}.0`, {ph:"Complaint filed"})}${fld(null, `timeline.${i}.1`, {ph:"Jul 2026"})}
      <label class="chk" style="padding-top:8px"><input type="checkbox" data-k="timeline.${i}.2" data-t="b01"${r[2] ? " checked" : ""}>Done</label>
      ${tools("timeline", i, c.timeline.length)}</div>`).join("")}</div>
    ${addBtn("timeline", "time", "Add a milestone")}`)
  + sec("Updates from the legal team", "Newest first. Backers see these on the case page.", `
    <div class="rep">${c.updates.map((r, i) => `<div class="rep-row r-update">
      ${fld(null, `updates.${i}.0`, {ph:"Sep 2026"})}${fld(null, `updates.${i}.1`, {area:true, rows:2, ph:"What happened", cls:"note-inp"})}
      ${tools("updates", i, c.updates.length)}</div>`).join("")}</div>
    ${addBtn("updates", "update", "Add an update")}`);
}

function tabPeople(){
  const c = draft.c;
  return sec("Plaintiff", "", `<div class="g2">${fld("Name", "people.plaintiff.name")}${fld("Role", "people.plaintiff.role")}</div>
      ${fld("Bio", "people.plaintiff.bio", {area:true})}`)
  + sec("Lead counsel", "", `<div class="g3">${fld("Name", "people.attorney.name")}${fld("Role", "people.attorney.role")}${fld("Headline stat", "people.attorney.stat", {ph:"200+ evictions defended"})}</div>
      ${fld("Bio", "people.attorney.bio", {area:true})}`)
  + sec("Firm", "", `<div class="g2">${fld("Name", "people.firm.name")}${fld("What it is", "people.firm.kind", {ph:"Non-profit legal aid, founded 2016"})}</div>
      ${fld("About", "people.firm.bio", {area:true})}
      <label class="f">Numbers <small>Shown in a row under the firm</small></label>
      <div class="rep">${c.people.firm.stats.map((r, i) => `<div class="rep-row r-stat">
        ${fld(null, `people.firm.stats.${i}.0`, {ph:"Cases brought"})}${fld(null, `people.firm.stats.${i}.1`, {ph:"1,204"})}${tools("people.firm.stats", i, c.people.firm.stats.length, false)}</div>`).join("")}</div>
      ${addBtn("people.firm.stats", "stat", "Add a number")}`);
}

function tabDetails(){
  const c = draft.c;
  return sec("The case in full", "The plain-English summary. Leave a blank line between paragraphs.",
      fld(null, "summary", {t:"paras", area:true, rows:8}))
  + sec("Why you should care", "Three numbers work best. A dot grid shows “x of y”; the others show the value large.", `
    <div class="rep">${c.why.map((w, i) => `<div class="rep-row r-why">
      ${fld(null, `why.${i}.kind`, {opts:[["stat","Big number"],["delta","Change"],["dots","Dot grid"]]})}
      ${fld(null, `why.${i}.value`, {t:w.kind === "dots" ? "n" : "s", ph:w.kind === "dots" ? "40" : "112 people"})}
      ${w.kind === "dots" ? fld(null, `why.${i}.of`, {t:"n", ph:"of 52"}) : "<span></span>"}
      ${fld(null, `why.${i}.label`, {ph:"facing displacement"})}
      ${tools("why", i, c.why.length)}
      <div class="wide">${fld(null, `why.${i}.note`, {ph:"31 of them children under 12."})}</div></div>`).join("")}</div>
    ${addBtn("why", "why", "Add a number")}`)
  + sec("Community score", "How many ratings of each star the case starts with.", `
    <div class="g6" style="grid-template-columns:repeat(5,1fr)">${[1,2,3,4,5].map(s => `<div><small class="muted">${s} ★</small>${fld(null, `rating.counts.${s-1}`, {t:"n", min:0})}</div>`).join("")}</div>`);
}

function tabJson(){
  return sec("Raw data", "The whole case, exactly as the site reads it. Edit anything the form doesn't cover, then Apply and Save.", `
    <textarea class="inp mono" id="jsonBox" rows="28" spellcheck="false" style="margin-top:10px">${esc(JSON.stringify(LJ_CMS.normalize(draft.c), null, 2))}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn dark sm" data-act="applyjson">Apply</button><button class="btn line sm" data-act="copyjson">${I.copy}Copy</button></div>`);
}

/* the charts on the form are the site's own charts, redrawn as you type */
function drawViz(){
  if(!draft) return;
  const c = LJ_CMS.normalize(draft.c);
  const put = (k, html) => $$(`[data-viz="${k}"]`).forEach(el => el.innerHTML = html);
  put("merit", meritScore(c) + "%");
  put("waterfall", waterfall(c));
  put("bloom", bloom(c) + bloomLegend(c));
  put("runway", runway(c) + `<p class="note" style="text-align:center">Locked about ${lockYears(c)} years, ending ${endYear(c)}</p>`);
  const ws = Math.round(c.impact.factors.reduce((s, f) => s + f.weight, 0) * 100);
  put("wsum", `<div class="warn ${ws === 100 ? "ok" : ""}">Weights add up to <b>${ws}%</b>${ws === 100 ? "" : `<button class="btn line sm" data-act="normw">Make them 100%</button>`}</div>`);
  const os = Math.round((c.outcomes.win + c.outcomes.settle + c.outcomes.lose) * 100);
  put("osum", `<div class="warn ${os === 100 ? "ok" : ""}">The three chances add up to <b>${os}%</b>${os === 100 ? "" : " — they should make 100%"}</div>`);
  put("btot", c.budget.length ? `<p class="note">Total <b>${usd(c.budget.reduce((s, [, n]) => s + n, 0))}</b> against a goal of ${usd(c.goal)}</p>` : "");
}

/* ============ clips and video ============ */
function clipCard(x, inEditor){
  const c = x.e.c, v = x.v, kind = vidKind(v), photo = v.poster || (c.hero && c.hero.src);
  const href = inEditor ? null : x.k === "hero" ? `#/case/${encodeURIComponent(x.e.id)}/story` : `#/case/${encodeURIComponent(x.e.id)}/clips/${x.k}`;
  const badge = kind === "file" ? `<span class="pill vid"><i></i>Video</span>` : kind === "embed" ? `<span class="pill vid"><i></i>${esc(v.credit || "Embedded")}</span>`
    : `<span class="pill need"><i></i>Needs video</span>`;
  const inner = `<span class="thumb" style="--cat:${catColor(c)}">${heroArt(c, typeof x.k === "number" ? x.k + 3 : 0)}${
      photo ? `<img class="fb" alt="" loading="lazy" src="${esc(photo)}">` : v.src ? `<video src="${esc(v.src)}#t=0.5" muted playsinline preload="metadata"></video>` : ""}
      <span class="badges">${badge}${v.lead ? `<span class="pill live"><i></i>Leads feed</span>` : ""}</span>
      ${kind !== "embed" ? `<span class="dur">${Math.floor(v.secs / 60)}:${String(v.secs % 60).padStart(2, "0")}</span>` : ""}</span>
    <span class="ct">${esc(x.title)}</span><span class="cm">${inEditor ? esc(milestone(c, v.milestone)) : esc(c.title || c.head || x.e.id)}</span>`;
  return inEditor ? `<button class="ccard" data-clip="${x.k}">${inner}</button>` : `<a class="ccard" href="${href}">${inner}</a>`;
}

let clipFilter = "all", clipCase = "";
function pageClips(){
  const m = shell("clips");
  const es = entries().filter(e => e.status !== "hidden");
  m.innerHTML = `<div class="a-inner">
    ${head("Clips & video", "Every clip on the platform. Open one to upload vertical video, paste a YouTube or Vimeo link, or change its words.",
      `<select class="inp" id="newIn" style="width:auto"><option value="">Add a clip to…</option>${es.map(e => `<option value="${esc(e.id)}">${esc(e.c.title || e.c.head || e.id)}</option>`).join("")}</select>`)}
    <div class="bar"><select class="inp" id="cf" style="width:auto;max-width:320px"><option value="">All cases</option>${es.map(e =>
        `<option value="${esc(e.id)}"${clipCase === e.id ? " selected" : ""}>${esc(e.c.title || e.c.head || e.id)}</option>`).join("")}</select>
      <div class="chips">${[["all","All"],["need","Needs video"],["file","Uploaded"],["embed","Linked"]].map(([k, t]) =>
        `<button class="chip" data-f="${k}" aria-pressed="${k === clipFilter}">${t}</button>`).join("")}</div></div>
    <div id="cg"></div></div>`;
  const draw = () => {
    const list = allClips(es.filter(e => !clipCase || e.id === clipCase))
      .filter(x => clipFilter === "all" || (clipFilter === "need" ? vidKind(x.v) === "card" : vidKind(x.v) === clipFilter));
    $("#cg").innerHTML = list.length ? `<div class="cgrid">${list.map(x => clipCard(x)).join("")}</div>`
      : `<div class="empty-card"><b>Nothing here</b>Try another filter.</div>`;
  };
  $("#cf").addEventListener("change", e => { clipCase = e.target.value; draw(); });
  $("#newIn").addEventListener("change", e => { if(e.target.value) location.hash = `#/case/${encodeURIComponent(e.target.value)}/clips/new`; });
  $$("[data-f]").forEach(b => b.addEventListener("click", () => {
    clipFilter = b.dataset.f; $$("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); }));
  draw();
}

/* ---------- the drawer: one clip ---------- */
const drawer = $("#drawer"), scrim2 = $("#scrim2");
function openDrawer(k){
  draft.openClip = k; drawDrawer();
  drawer.classList.add("on"); scrim2.classList.add("on");
}
function drawDrawer(){
  const k = draft.openClip, c = draft.c, cl = c.clips[k]; if(!cl) return closeDrawer();
  drawer.innerHTML = `<div class="drawer-top"><button class="ib" id="dClose" aria-label="Close">${I.x}</button>
      <h2>${esc(cl.title || "Untitled clip")}</h2><span class="muted" style="font-size:13px">Clip ${k + 1} of ${c.clips.length}</span></div>
    <div class="drawer-body">
      ${vpHTML(k)}
      ${fld("Title", `clips.${k}.title`, {ph:"Meet Maria"})}
      <div class="g3">${fld("Tied to", `clips.${k}.milestone`, {t:"n", opts:(c.timeline.length ? c.timeline : [["Case file"]]).map((r, i) => [i, r[0] || "Milestone " + (i + 1)])})}
        ${fld("Length", `clips.${k}.secs`, {t:"n", help:"seconds", min:1})}${fld("Credit", `clips.${k}.credit`, {ph:"YouTube"})}</div>
      ${fld("Beats", `clips.${k}.beats`, {t:"lines", area:true, rows:5, help:"One line each. Captions when there's no video."})}
      <div class="row wrap" style="margin-top:22px">
        <button class="btn line sm" data-mv="clips.${k}" data-dir="-1" ${k ? "" : "disabled"}>${I.up}Earlier</button>
        <button class="btn line sm" data-mv="clips.${k}" data-dir="1" ${k < c.clips.length - 1 ? "" : "disabled"}>${I.down}Later</button>
        <span class="grow"></span><button class="btn danger sm" id="dDel">${I.trash}Remove clip</button>
        <button class="btn dark sm" id="dDone">Done</button></div>
    </div>`;
  $("#dClose").onclick = closeDrawer; $("#dDone").onclick = closeDrawer;
  $("#dDel").onclick = () => { if(!confirm("Remove this clip? Its video stays in the media library.")) return;
    c.clips.splice(k, 1); markDirty(); closeDrawer(); };
  wireDrops(drawer);
}
function closeDrawer(quiet){
  if(!drawer.classList.contains("on")) return;
  drawer.classList.remove("on"); scrim2.classList.remove("on");
  if(draft) draft.openClip = null;
  if(!quiet && draft){ location.hash = `#/case/${enc()}/clips`; }
}
scrim2.addEventListener("click", () => closeDrawer());
drawer.addEventListener("input", onField); drawer.addEventListener("change", onField); drawer.addEventListener("click", onAct);

/* ---------- the video picker, for the 60-second clip and every short one ----------
   "hero" is the case's own clip (video, embed, poster, heroLead); a number is
   an entry in clips[] (src, embed, poster, lead). */
function getVid(t){ const c = draft.c; return t === "hero" ? heroVid(c) : {...c.clips[t], src:c.clips[t].src || ""}; }
function setVid(t, v){
  const c = draft.c;
  if(t === "hero"){
    ["src","embed","poster"].forEach(k => { if(k in v){ const f = k === "src" ? "video" : k; if(v[k]) c[f] = v[k]; else delete c[f]; } });
    if("lead" in v) c.heroLead = v.lead;
  } else {
    const cl = c.clips[t];
    Object.entries(v).forEach(([k, x]) => { if(x === null || x === "") { if(k === "src") cl.src = null; else delete cl[k]; } else cl[k] = x; });
  }
}
function vpHTML(t){
  const c = draft.c, v = getVid(t), kind = vidKind(v), base = t === "hero" ? "" : `clips.${t}.`;
  const stage = kind === "file"
    ? `<video src="${esc(v.src)}" ${v.poster ? `poster="${esc(v.poster)}"` : ""} controls playsinline preload="metadata"></video>`
    : kind === "embed" ? `<iframe src="${esc(v.embed)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : `${heroArt(c)}${(v.poster || (c.hero && c.hero.src)) ? `<img class="fb" alt="" src="${esc(v.poster || c.hero.src)}" style="opacity:.5">` : ""}
       <p class="cap"><span>${esc((v.beats || [])[0] || c.head || "Caption card")}</span></p><span class="lbl">No video yet · plays as a caption card</span>`;
  return `<div class="vp" data-vp="${t}" style="margin-top:12px">
    <div class="vp-stage" style="--cat:${catColor(c)}">${stage}</div>
    <div>
      <div class="drop" data-drop="${t}"><b>${kind === "file" ? "Replace the video" : "Drop a vertical video here"}</b>
        <p>MP4 or MOV, 9:16 works best. The length and a poster frame are taken from the file, and the case saves as soon as it's uploaded.</p>
        <div class="row"><button class="btn primary sm" data-pick="${t}">${I.upload}Choose a video</button></div>
        <div class="prog" hidden><i></i></div><div class="prog-t" hidden></div></div>
      <div class="or2">or paste a link</div>
      <div class="row"><input class="inp grow" data-link="${t}" placeholder="YouTube, Shorts, Vimeo or a .mp4 link" value="${esc(v.embed || (kind === "file" && !v.src.includes("/storage/v1/") ? v.src : ""))}">
        <button class="btn dark sm" data-uselink="${t}">Use link</button></div>
      <div class="row wrap" style="margin-top:14px">
        ${kind !== "card" ? `<label class="chk"><input type="checkbox" data-k="${t === "hero" ? "heroLead" : base + "lead"}"${v.lead ? " checked" : ""}>Lead the Watch feed</label><span class="grow"></span>` : ""}
        <button class="btn line sm" data-poster="${t}">${I.media}${v.poster ? "Change poster" : "Add a poster"}</button>
        ${kind !== "card" ? `<button class="btn danger sm" data-clear="${t}">Remove video</button>` : ""}</div>
    </div></div>`;
}

function pickFile(accept, cb, multiple){
  const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = !!multiple;
  i.onchange = () => i.files.length && cb(multiple ? [...i.files] : i.files[0]); i.click();
}
function wireDrops(root){
  $$("[data-pick]", root).forEach(b => b.onclick = () => pickFile("video/*", f => takeVideo(b.dataset.pick, f)));
  $$("[data-poster]", root).forEach(b => b.onclick = () => pickFile("image/*", f => takePoster(b.dataset.poster, f)));
  $$("[data-clear]", root).forEach(b => b.onclick = () => { const t = key(b.dataset.clear);
    setVid(t, {src:null, embed:null, poster:null, lead:false}); markDirty(); redrawVid(t); });
  $$("[data-uselink]", root).forEach(b => b.onclick = () => useLink(key(b.dataset.uselink), $(`[data-link="${b.dataset.uselink}"]`, root).value));
  $$("[data-link]", root).forEach(i => i.onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); useLink(key(i.dataset.link), i.value); } });
  $$("[data-drop]", root).forEach(z => {
    z.ondragover = e => { e.preventDefault(); z.classList.add("over"); };
    z.ondragleave = () => z.classList.remove("over");
    z.ondrop = e => { e.preventDefault(); z.classList.remove("over"); const f = e.dataTransfer.files[0]; if(f) takeVideo(z.dataset.drop, f); };
  });
}
const key = t => t === "hero" ? "hero" : +t;
function redrawVid(t){
  if(t === "hero") drawTab(); else { drawDrawer(); }
  drawPreview();
}

/* YouTube (including Shorts), Vimeo, a direct file, or any other player URL */
function parseLink(u){
  u = String(u || "").trim(); if(!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if(m) return {embed:`https://www.youtube.com/embed/${m[1]}`, poster:`https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, credit:"YouTube", src:null};
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m) return {embed:`https://player.vimeo.com/video/${m[1]}?background=1`, credit:"Vimeo", src:null};
  if(/^https?:\/\/.+\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return {src:u, embed:null};
  if(/^https?:\/\//.test(u)) return {embed:u, credit:new URL(u).hostname.replace(/^www\./, ""), src:null};
  return null;
}
async function useLink(t, u){
  const p = parseLink(u);
  if(!p) return toast("Paste a full link, starting with https://");
  setVid(t, {poster:null, ...p, lead:true});
  markDirty(); redrawVid(t);
  if(await save()) redrawVid(t);
}

/* Upload straight to Storage with XHR rather than the client library, for
   one reason: the progress bar. A minute of vertical video is tens of MB. */
async function upload(file, path, onProg){
  const {data:{session}} = await sb.auth.getSession();
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("POST", `${CFG.SUPABASE_URL}/storage/v1/object/media/${path.split("/").map(encodeURIComponent).join("/")}`);
    x.setRequestHeader("Authorization", "Bearer " + session.access_token);
    x.setRequestHeader("apikey", CFG.SUPABASE_ANON_KEY);
    x.setRequestHeader("x-upsert", "true");
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.setRequestHeader("cache-control", "max-age=31536000");
    if(onProg) x.upload.onprogress = e => e.lengthComputable && onProg(e.loaded / e.total);
    x.onload = () => {
      if(x.status < 300) return res(sb.storage.from("media").getPublicUrl(path).data.publicUrl);
      let msg = x.statusText; try{ const j = JSON.parse(x.responseText); msg = j.message || j.error || msg; }catch(e){}
      if(x.status === 413 || /maximum allowed size|too large/i.test(msg))
        msg = "This file is over the storage size limit (50 MB on Supabase's free plan). Compress it, or raise the limit in Supabase under Storage → Settings.";
      rej(new Error(msg));
    };
    x.onerror = () => rej(new Error("The upload was cut off. Check the connection and try again."));
    x.send(file);
  });
}
const fileName = f => Date.now().toString(36) + "-" + (slug(f.name.replace(/\.[^.]+$/, "")) || "file") + (f.name.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();

/* the length, the shape and a poster frame, read from the file before it goes */
function probeVideo(file){
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), v = document.createElement("video"); let done = false;
    const finish = poster => { if(done) return; done = true;
      resolve({duration:v.duration || 0, width:v.videoWidth, height:v.videoHeight, poster}); URL.revokeObjectURL(url); };
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 3) / 3); };
    v.onseeked = () => {
      try{
        const w = Math.min(720, v.videoWidth || 720), h = Math.round(w * (v.videoHeight || 16) / (v.videoWidth || 9));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(v, 0, 0, w, h);
        cv.toBlob(b => finish(b), "image/jpeg", .82);
      }catch(e){ finish(null); }
    };
    v.onerror = () => finish(null);
    setTimeout(() => finish(null), 10000);
  });
}

async function takeVideo(t, file){
  t = key(t);
  if(!file.type.startsWith("video/")) return toast("That isn't a video file");
  if(!ensureId()) return;
  const box = $(`[data-drop="${t}"]`), bar = box.querySelector(".prog"), txt = box.querySelector(".prog-t");
  bar.hidden = txt.hidden = false; box.querySelectorAll("button").forEach(b => b.disabled = true);
  const say = s => txt.textContent = s;
  try{
    say("Reading the video…");
    const meta = await probeVideo(file);
    const stamp = fileName(file), id = draft.c.id;
    say(`Uploading ${bytes(file.size)}…`);
    const src = await upload(file, `videos/${id}/${stamp}`, p => { bar.firstChild.style.width = (p * 100).toFixed(1) + "%"; say(`Uploading… ${Math.round(p * 100)}% of ${bytes(file.size)}`); });
    let poster = null;
    if(meta.poster){ say("Saving the poster frame…"); poster = await upload(new File([meta.poster], "poster.jpg", {type:"image/jpeg"}), `images/${id}/${stamp.replace(/\.[^.]+$/, "")}-poster.jpg`).catch(() => null); }
    const secs = Math.max(1, Math.round(meta.duration || 0)) || undefined;
    setVid(t, {src, embed:null, poster, lead:true, ...(t !== "hero" && secs ? {secs, credit:null} : {})});
    markDirty();
    say("Saving the case…");
    if(await save()){
      redrawVid(t);
      if(meta.width && meta.width > meta.height) toast("Uploaded. Heads up: it's landscape, and the feed crops everything to 9:16.", 5000);
    } else { say("Uploaded, but the case didn't save. Try Save again."); box.querySelectorAll("button").forEach(b => b.disabled = false); }
  }catch(e){
    console.error(e); say(e.message); toast("Upload failed", 3000);
    box.querySelectorAll("button").forEach(b => b.disabled = false);
  }
}
async function takePoster(t, file){
  t = key(t);
  if(!file.type.startsWith("image/")) return toast("Choose an image for the poster");
  if(!ensureId()) return;
  toast("Uploading the poster…");
  try{
    const url = await upload(file, `images/${draft.c.id}/${fileName(file)}`);
    setVid(t, {poster:url}); markDirty(); redrawVid(t); await save();
  }catch(e){ toast(e.message, 5000); }
}
async function takePhoto(file){
  if(!ensureId()) return;
  const p = $("#photoProg"); if(p) p.textContent = "Uploading…";
  try{
    const url = await upload(file, `images/${draft.c.id}/${fileName(file)}`, x => { if(p) p.textContent = `Uploading… ${Math.round(x * 100)}%`; });
    draft.c.hero = {src:url, credit:(draft.c.hero && draft.c.hero.credit) || ""};
    markDirty(); drawTab(); drawPreview(); await save();
  }catch(e){ if(p) p.textContent = e.message; }
}

/* ============ media library ============ */
async function pageMedia(){
  const m = shell("media");
  m.innerHTML = `<div class="a-inner">${head("Media library", "Every file uploaded from the admin. Links here are public, so they can be pasted anywhere a case takes a link.",
    `<button class="btn primary" id="up">${I.upload}Upload files</button>`)}
    <div class="prog-t" id="upT"></div><div id="mg"><div class="loading"><span class="spin"></span></div></div></div>`;
  $("#up").onclick = () => pickFile("video/*,image/*", async files => {
    for(const [i, f] of files.entries()){
      $("#upT").textContent = `Uploading ${i + 1} of ${files.length}: ${f.name}`;
      try{ await upload(f, `${f.type.startsWith("video/") ? "videos" : "images"}/library/${fileName(f)}`, p => $("#upT").textContent = `Uploading ${f.name}… ${Math.round(p * 100)}%`); }
      catch(e){ toast(e.message, 5000); }
    }
    $("#upT").textContent = ""; pageMedia();
  }, true);

  const files = [];
  for(const top of ["videos","images"]){
    const {data:dirs, error} = await sb.storage.from("media").list(top, {limit:1000});
    if(error){ $("#mg").innerHTML = `<div class="empty-card"><b>Couldn't read the library</b>${esc(error.message)}</div>`; return; }
    for(const d of dirs || []){
      if(d.id){ files.push({...d, path:`${top}/${d.name}`}); continue; }
      const {data} = await sb.storage.from("media").list(`${top}/${d.name}`, {limit:1000});
      (data || []).filter(f => f.id && !f.name.startsWith(".")).forEach(f => files.push({...f, path:`${top}/${d.name}/${f.name}`}));
    }
  }
  if(!$("#mg")) return;
  files.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const used = entries().map(e => [e, JSON.stringify(e.c)]);
  const html = files.map(f => {
    const url = sb.storage.from("media").getPublicUrl(f.path).data.publicUrl, vid = (f.metadata && f.metadata.mimetype || "").startsWith("video/");
    const users = used.filter(([, s]) => s.includes(url)).map(([e]) => e);
    return `<div class="mcard"><span class="thumb">${vid ? `<video src="${esc(url)}#t=0.5" muted playsinline preload="metadata"></video>` : `<img alt="" loading="lazy" src="${esc(url)}">`}</span>
      <div class="mi"><b title="${esc(f.path)}">${esc(f.name)}</b><span class="muted">${bytes(f.metadata && f.metadata.size)} · ${when(f.created_at)}</span>
        <span class="muted">${users.length ? "Used in " + users.map(e => `<a href="#/case/${encodeURIComponent(e.id)}">${esc(e.c.title || e.id)}</a>`).join(", ") : "Not used"}</span>
        <span class="row"><button class="btn line sm" data-copy="${esc(url)}">${I.copy}Link</button>
        <button class="ib del" data-rm="${esc(f.path)}" data-used="${users.length}" aria-label="Delete">${I.trash}</button></span></div></div>`;
  }).join("");
  $("#mg").innerHTML = files.length ? `<div class="mgrid">${html}</div>` : `<div class="empty-card"><b>Nothing uploaded yet</b>Videos you upload to a case land here too.</div>`;
  $$("[data-copy]").forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Link copied")));
  $$("[data-rm]").forEach(b => b.onclick = async () => {
    if(!confirm(+b.dataset.used ? "This file is used by a case, which will fall back to a caption card. Delete it anyway?" : "Delete this file for good?")) return;
    const {error} = await sb.storage.from("media").remove([b.dataset.rm]);
    if(error) return toast(error.message);
    b.closest(".mcard").remove(); toast("Deleted");
  });
}

/* ============ pledges ============ */
async function pagePledges(){
  const m = shell("pledges");
  m.innerHTML = `<div class="a-inner">${head("Pledges", "Real pledges made on the site, with the real names and notes backers leave for the legal team. The demo's starting numbers aren't included.",
    `<button class="btn line" id="csv" disabled>Export CSV</button>`)}<div id="pb"><div class="loading"><span class="spin"></span></div></div></div>`;
  const {data, error} = await sb.rpc("admin_pledges");
  if(!$("#pb")) return;
  if(error) return $("#pb").innerHTML = `<div class="empty-card"><b>Couldn't load pledges</b>${esc(error.message)}</div>`;
  const tot = data.reduce((s, r) => s + r.amount, 0), people = new Set(data.map(r => r.actor_id)).size;
  const by = {}; data.forEach(r => by[r.case_id] = (by[r.case_id] || 0) + r.amount);
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]), max = top.length ? top[0][1] : 1;
  $("#pb").innerHTML = `<div class="tiles">
      <div class="tile hl"><small>Invested</small><b>${usd(tot)}</b><span>No money moves yet</span></div>
      <div class="tile"><small>Pledges</small><b>${num(data.length)}</b></div>
      <div class="tile"><small>Backers</small><b>${num(people)}</b><span>Accounts and devices</span></div>
      <div class="tile"><small>Average</small><b>${usd(data.length ? tot / data.length : 0)}</b></div></div>
    ${top.length ? `<h2 class="a-h">By case</h2><div class="card hbars">${top.map(([id, n]) => { const e = entry(id);
      return `<div class="hbar" style="--cat:${e ? catColor(e.c) : "var(--ink)"}"><span class="t">${esc(caseTitle(id))}</span><b>${usd(n)}</b>
        <div class="lbar"><i style="width:${(n / max * 100).toFixed(1)}%"></i></div></div>`; }).join("")}</div>` : ""}
    <h2 class="a-h">Every pledge</h2>
    ${data.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Case</th><th>Real name</th><th>Shown as</th><th>Note</th><th class="num">Amount</th></tr></thead><tbody>
      ${data.map(r => `<tr><td>${when(r.created_at)}</td><td>${esc(caseTitle(r.case_id))}</td><td><b>${esc(r.name)}</b>${r.user_id ? "" : ' <small class="muted">signed out</small>'}</td>
        <td>${esc(r.display_name)}</td><td><span class="clip2">${esc(r.note || "")}</span></td><td class="num"><b>${usd(r.amount)}</b></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty-card"><b>No pledges yet</b>They show up here the moment someone invests on the site.</div>`}`;
  const b = $("#csv"); b.disabled = !data.length;
  b.onclick = () => {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["created_at","case_id","case","name","display_name","amount","note","signed_in"],
      ...data.map(r => [r.created_at, r.case_id, caseTitle(r.case_id), r.name, r.display_name, r.amount, r.note, r.user_id ? "yes" : "no"])];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], {type:"text/csv"}));
    a.download = "launchjustice-pledges.csv"; a.click();
  };
}

/* ============ comments ============ */
let comCase = "";
async function pageComments(){
  const m = shell("comments");
  m.innerHTML = `<div class="a-inner">${head("Comments", "What people have written on the site, newest first. The seeded discussion in the demo isn't here, only real comments.")}
    <div class="bar"><select class="inp" id="cc" style="width:auto;max-width:320px"><option value="">All cases</option>${entries().map(e =>
      `<option value="${esc(e.id)}"${comCase === e.id ? " selected" : ""}>${esc(e.c.title || e.c.head || e.id)}</option>`).join("")}</select></div>
    <div id="cl" class="list2"><div class="loading"><span class="spin"></span></div></div></div>`;
  $("#cc").onchange = e => { comCase = e.target.value; pageComments(); };
  let q = sb.from("comments").select("*").order("created_at", {ascending:false}).limit(500);
  if(comCase) q = q.eq("case_id", comCase);
  const {data, error} = await q;
  if(!$("#cl")) return;
  if(error) return $("#cl").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  $("#cl").innerHTML = data.map(r => commentLi(r, true)).join("") || `<div class="empty">No comments${comCase ? " on this case" : ""} yet.</div>`;
  $$("[data-delc]").forEach(b => b.onclick = async () => {
    if(!confirm("Delete this comment from the site?")) return;
    const {error} = await sb.from("comments").delete().eq("id", b.dataset.delc);
    if(error) return toast(error.message);
    b.closest(".li").remove(); toast("Comment deleted");
  });
}
const commentLi = (r, del) => `<div class="li"><span class="av">${esc((r.name || "?").charAt(0).toUpperCase())}</span>
  <div class="grow"><div class="who"><b>${esc(r.name)}</b>${r.is_backer ? '<i class="tag">Backer</i>' : ""}<small>${when(r.created_at)} · ${esc(caseTitle(r.case_id))}</small></div>
  <p>${esc(r.body)}</p></div>${del ? `<button class="ib del" data-delc="${r.id}" aria-label="Delete comment">${I.trash}</button>` : ""}</div>`;

/* ============ team ============ */
async function pageTeam(){
  const m = shell("team");
  m.innerHTML = `<div class="a-inner">${head("Team", "Who can open the admin. Every change is checked against this list by the database itself, so a leaked link is a sign-in screen and nothing more.")}
    <div class="card" style="max-width:640px"><form id="addA" class="row"><input class="inp grow" id="ae" type="email" placeholder="name@example.com" required>
      <button class="btn primary" type="submit">${I.plus}Add admin</button></form>
      <p class="note">They sign in here with a LaunchJustice account on that email, created on the site. Its email has to be confirmed.</p></div>
    <div id="al" class="list2" style="max-width:640px;margin-top:14px"><div class="loading"><span class="spin"></span></div></div></div>`;
  $("#addA").onsubmit = async e => {
    e.preventDefault();
    const email = $("#ae").value.trim().toLowerCase(); if(!email.includes("@")) return;
    const {error} = await sb.from("admins").insert({email, added_by:S.session.user.email});
    if(error) return toast(error.code === "23505" ? "Already an admin" : error.message);
    toast("Added " + email); pageTeam();
  };
  const {data, error} = await sb.from("admins").select("*").order("created_at");
  if(!$("#al")) return;
  if(error) return $("#al").innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  const me = (S.session.user.email || "").toLowerCase();
  $("#al").innerHTML = data.map(a => `<div class="li"><span class="av">${esc(a.email.charAt(0).toUpperCase())}</span>
    <div class="grow"><div class="who"><b>${esc(a.email)}</b>${a.email === me ? '<i class="tag team">You</i>' : ""}</div>
    <p class="muted" style="font-size:13px">Added ${when(a.created_at)}${a.added_by && a.added_by !== "setup" ? " by " + esc(a.added_by) : ""}</p></div>
    ${a.email === me ? "" : `<button class="btn danger sm" data-rma="${esc(a.email)}">Remove</button>`}</div>`).join("");
  $$("[data-rma]").forEach(b => b.onclick = async () => {
    if(!confirm(`Remove ${b.dataset.rma} from the admin?`)) return;
    const {error} = await sb.from("admins").delete().eq("email", b.dataset.rma);
    if(error) return toast(error.message);
    toast("Removed"); pageTeam();
  });
}

start();
