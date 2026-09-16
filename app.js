/* ============ demo content (fictional cases) ============ */
const CATS = {
  immigration:{label:"Immigration", color:"#2F5BEA"},
  environment:{label:"Environment", color:"#1F8A5B"},
  housing:{label:"Housing", color:"#8B5CF6"},
  labor:{label:"Workers' rights", color:"#D97706"},
  disability:{label:"Disability rights", color:"#0E7490"},
  privacy:{label:"Privacy", color:"#DB2777"}
};
const CASES = [
  {id:"asylum-backlog", cat:"immigration", title:"End years-long waits for asylum hearings",
   ngo:"Open Door Legal Collective", defendant:"U.S. Department of Homeland Security",
   court:"U.S. District Court, N.D. California", stage:"Complaint filed", goal:180000, baseRaised:61400, baseBackers:212,
   beats:["Maria has waited four years for her asylum hearing.","Thousands of families are stuck in the same line.","The law requires a timely hearing. It isn't happening.","We're asking a federal court to enforce it.","Help fund the case that could clear the backlog."],
   summary:["Asylum seekers in the Bay Area are waiting four years or more for a first hearing, with no work authorization for much of that time and no way to plan their lives.","This class action argues that the delay violates the government's own statutory deadlines and asks the court to order a plan to process pending cases within a set timeframe."],
   budget:[["Attorney and paralegal time",92000],["Expert witnesses",38000],["Discovery and depositions",32000],["Court and filing costs",18000]],
   timeline:[["Plaintiffs recruited and interviewed","Jan 2026",1],["Complaint filed","Jun 2026",1],["Government response due","Oct 2026",0],["Class certification motion","Early 2027",0]],
   updates:[["Aug 2026","Two more families joined as named plaintiffs after the first clip went out to supporters."]]},
  {id:"riverside-water", cat:"environment", title:"Clean drinking water for Riverside Township",
   ngo:"Watershed Justice Project", defendant:"State Department of Environmental Quality",
   court:"State Superior Court", stage:"Pre-filing investigation", goal:95000, baseRaised:48200, baseBackers:167,
   beats:["Riverside's tap water failed nitrate tests 11 times.","Parents buy bottled water for their babies.","The state knew and renewed the permits anyway.","We're taking the permits to court.","Back the case for clean water."],
   summary:["Residents of Riverside Township have received repeated notices that their tap water exceeds nitrate limits, while upstream discharge permits were renewed without new conditions.","The case challenges those renewals and asks the court to require enforceable limits and monitoring."],
   budget:[["Water testing and hydrology experts",41000],["Attorney time",38000],["Community outreach and filings",16000]],
   timeline:[["Independent water testing","Mar 2026",1],["Records requests completed","Jul 2026",1],["Petition filed","Nov 2026",0]],
   updates:[]},
  {id:"maple-evictions", cat:"housing", title:"Stop no-cause evictions in Maple County",
   ngo:"Tenant Defense Fund", defendant:"Northgate Property Management",
   court:"County Circuit Court", stage:"Complaint filed", goal:60000, baseRaised:39750, baseBackers:301,
   beats:["Forty families got eviction notices in one week.","No reason given. Rents doubled after.","Local law requires cause. We say it was ignored.","Tenants are fighting back together.","Stand with them in court."],
   summary:["Tenants across three buildings received simultaneous no-cause notices shortly after the buildings changed hands. Units were relisted at nearly double the rent.","The suit argues the notices violate the county's just-cause ordinance and seeks to void them."],
   budget:[["Attorney time",34000],["Tenant organizing and translation",14000],["Court costs",12000]],
   timeline:[["Tenant association formed","Apr 2026",1],["Complaint filed","Jul 2026",1],["Hearing on injunction","Oct 2026",0]],
   updates:[["Sep 2026","The court scheduled a hearing on our request to pause the evictions."]]},
  {id:"farmworker-wages", cat:"labor", title:"Recover unpaid wages for farmworkers",
   ngo:"Field Workers Alliance", defendant:"Valley Harvest Contracting LLC",
   court:"U.S. District Court, E.D. Washington", stage:"Discovery", goal:120000, baseRaised:22900, baseBackers:94,
   beats:["Ten-hour days. Paid for seven.","Over 300 workers, three harvest seasons.","Their pay stubs tell the story.","Now a court will hear it.","Help them get what they earned."],
   summary:["Seasonal workers report being paid for fewer hours than they worked, with breaks deducted that were never taken.","The case seeks back wages and damages under federal and state wage law."],
   budget:[["Attorney time",64000],["Payroll forensic accountant",30000],["Depositions and interpreters",26000]],
   timeline:[["Complaint filed","Nov 2025",1],["Motion to dismiss denied","Mar 2026",1],["Discovery","Ongoing",0],["Trial date","2027",0]],
   updates:[]},
  {id:"transit-access", cat:"disability", title:"Accessible buses for wheelchair users",
   ngo:"Equal Route Coalition", defendant:"Metro Regional Transit Authority",
   court:"U.S. District Court", stage:"Settlement talks", goal:75000, baseRaised:57300, baseBackers:188,
   beats:["The ramp is broken again.","Riders wait for a second bus. Then a third.","One in five ramps failed inspection.","The law says transit must be accessible.","Fund the fix."],
   summary:["Wheelchair users are routinely passed by buses with broken ramps or lifts, making trips to work and medical appointments unreliable.","The case seeks a maintenance plan and independent monitoring under the ADA."],
   budget:[["Attorney time",40000],["Accessibility audit",20000],["Monitoring during settlement",15000]],
   timeline:[["Complaint filed","Sep 2025",1],["Mediation begun","May 2026",1],["Settlement terms","Fall 2026",0]],
   updates:[]},
  {id:"school-facial-rec", cat:"privacy", title:"No facial recognition in public schools",
   ngo:"Student Privacy Watch", defendant:"Lakeview Unified School District",
   court:"State Superior Court", stage:"Pre-filing investigation", goal:50000, baseRaised:9800, baseBackers:41,
   beats:["Every student's face, scanned every morning.","Parents were never asked.","Nobody knows who sees the data.","We think state privacy law was broken.","Help us find out in court."],
   summary:["The district installed face-scanning cameras at school entrances without a public vote or parental consent.","The planned suit would ask the court to halt the program and require deletion of collected data."],
   budget:[["Attorney time",30000],["Technical expert",14000],["Filing and records",6000]],
   timeline:[["Records requests sent","Aug 2026",1],["Petition filed","Dec 2026",0]],
   updates:[]}
];
const byId = Object.fromEntries(CASES.map(c=>[c.id,c]));
const BEAT_MS = 12000; /* 5 beats x 12s = a 60-second clip */

/* ============ helpers ============ */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const usd = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const ago = t => { const s=(Date.now()-t)/1000; if(s<60) return "just now"; if(s<3600) return Math.floor(s/60)+"m"; if(s<86400) return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; };
function ls(k, v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v);}catch(e){ return null; } }
let deviceId = ls("lj_device"); if(!deviceId){ deviceId = "d"+Math.random().toString(36).slice(2,10); ls("lj_device",deviceId); }
const toastEl = $("#toast"); let toastT;
function toast(m){ toastEl.textContent=m; toastEl.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.remove("on"),2200); }
const icons = {
  pledge:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  heartFill:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play:'<svg viewBox="0 0 24 24" width="28" height="28" fill="#fff"><path d="M8 5v14l11-7z"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>'
};

/* ============ data layer ============
   Shared mode: Supabase, when SUPABASE_URL and SUPABASE_ANON_KEY are set in config.js.
   Local mode: pledges and comments are saved in this browser only. */
const store = { pledges:[], comments:[], live:false };
let sb = null;
function loadLocal(){ try{ const d = JSON.parse(ls("lj_local")||"{}"); store.pledges=d.pledges||[]; store.comments=d.comments||[]; }catch(e){} }
function saveLocal(){ ls("lj_local", JSON.stringify({pledges:store.pledges, comments:store.comments})); }
loadLocal();

const CFG = window.LJ_CONFIG || {};
async function fetchAll(){
  const [p, c, l] = await Promise.all([
    sb.from("pledges").select("id, case_id, display_name, amount, device_id, created_at").order("created_at",{ascending:true}).limit(5000),
    sb.from("comments").select("*").order("created_at",{ascending:false}).limit(2000),
    sb.from("comment_likes").select("comment_id, device_id").limit(10000)
  ]);
  if(p.error || c.error || l.error) throw (p.error||c.error||l.error);
  const likes = {};
  l.data.forEach(r=>{ (likes[r.comment_id] ||= {})[r.device_id] = true; });
  store.pledges = p.data.map(r=>({id:r.id, caseId:r.case_id, name:r.display_name, displayName:r.display_name, amount:+r.amount, createdAt:Date.parse(r.created_at), deviceId:r.device_id}));
  store.comments = c.data.map(r=>({id:r.id, caseId:r.case_id, name:r.name, text:r.body, backer:r.is_backer, createdAt:Date.parse(r.created_at), deviceId:r.device_id, likes:likes[r.id]||{}}));
  store.live = true;
  refresh();
}
let refetchT;
const scheduleFetch = () => { clearTimeout(refetchT); refetchT = setTimeout(()=>fetchAll().catch(console.error), 250); };

async function initDb(){
  if(!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)) { refresh(); return; }
  try{
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    await fetchAll();
    sb.channel("lj-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"pledges"},scheduleFetch)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},scheduleFetch)
      .on("postgres_changes",{event:"*",schema:"public",table:"comment_likes"},scheduleFetch)
      .subscribe();
  }catch(e){
    console.error("Supabase unavailable, using local mode", e);
    sb = null; store.live = false; loadLocal(); refresh();
  }
}

async function addPledge(p){
  if(sb){
    const {error} = await sb.from("pledges").insert({case_id:p.caseId, name:p.name, display_name:p.displayName, amount:p.amount, note:p.note||null, device_id:p.deviceId});
    if(error) throw error; scheduleFetch();
  } else { store.pledges.push({id:"l"+Date.now(), ...p}); saveLocal(); refresh(); }
}
async function addComment(c){
  if(sb){
    const {error} = await sb.from("comments").insert({case_id:c.caseId, name:c.name, body:c.text, is_backer:!!c.backer, device_id:c.deviceId});
    if(error) throw error; scheduleFetch();
  } else { store.comments.push({id:"l"+Date.now(), ...c}); saveLocal(); refresh(); }
}
async function toggleLike(cm){
  const on = !(cm.likes && cm.likes[deviceId]);
  if(sb){
    const q = on
      ? sb.from("comment_likes").upsert({comment_id:cm.id, device_id:deviceId})
      : sb.from("comment_likes").delete().eq("comment_id",cm.id).eq("device_id",deviceId);
    const {error} = await q; if(error) throw error; scheduleFetch();
  } else { cm.likes = {...(cm.likes||{}), [deviceId]:on}; saveLocal(); refresh(); }
}

const pledgesFor = id => store.pledges.filter(p=>p.caseId===id);
const commentsFor = id => store.comments.filter(c=>c.caseId===id).sort((a,b)=>b.createdAt-a.createdAt);
const raised = c => c.baseRaised + pledgesFor(c.id).reduce((s,p)=>s+(+p.amount||0),0);
const backers = c => c.baseBackers + pledgesFor(c.id).length;
const pct = c => Math.min(100, Math.round(raised(c)/c.goal*100));
const likeCount = cm => Object.values(cm.likes||{}).filter(Boolean).length;

/* live stat bindings — update in place so the feed never re-renders */
function refresh(){
  document.querySelectorAll("[data-raised]").forEach(el=>el.textContent=usd(raised(byId[el.dataset.raised])));
  document.querySelectorAll("[data-backers]").forEach(el=>{ const n=backers(byId[el.dataset.backers]); el.textContent = n+(n===1?" backer":" backers"); });
  document.querySelectorAll("[data-pct]").forEach(el=>el.style.width=pct(byId[el.dataset.pct])+"%");
  document.querySelectorAll("[data-ccount]").forEach(el=>el.textContent=commentsFor(el.dataset.ccount).length);
  document.querySelectorAll("[data-pctlabel]").forEach(el=>el.textContent=pct(byId[el.dataset.pctlabel])+"% funded");
  document.querySelectorAll("[data-comments]").forEach(el=>renderComments(el, el.dataset.comments));
  document.querySelectorAll(".live").forEach(el=>{ el.classList.toggle("on",store.live); el.lastChild.textContent = store.live?"Shared with all backers":"Saved on this device only"; });
  if(current==="mine") renderMine();
}

/* ============ clip (simulated 60s video) ============ */
function clipHTML(c){
  return `<div class="stage" style="--cat:${CATS[c.cat].color}"></div>
    <div class="segs">${c.beats.map(()=>'<div class="seg"><i></i></div>').join("")}</div>
    <div class="clip-note">Clip preview for ${esc(c.ngo)}</div>
    <div class="caption" aria-live="off"><p class="enter"><span>${esc(c.beats[0])}</span></p></div>
    <button class="tap" aria-label="Pause or play clip"></button>
    <div class="pause-ico"><div>${icons.play}</div></div>`;
}
class Clip{
  constructor(root, c){ this.root=root; this.c=c; this.t=0; this.beat=-1; this.playing=false; this.userPaused=false;
    this.p=root.querySelector(".caption p"); this.segs=[...root.querySelectorAll(".seg i")]; this.stage=root.querySelector(".stage");
    root.querySelector(".tap").addEventListener("click",()=>{ this.userPaused=!this.userPaused; this.userPaused?this.pause():this.play(); });
    this.show(0); }
  show(i){ if(i===this.beat) return; this.beat=i; this.p.classList.remove("lit","enter"); this.p.firstChild.textContent=this.c.beats[i];
    void this.p.offsetWidth; this.p.classList.add("enter"); requestAnimationFrame(()=>requestAnimationFrame(()=>this.p.classList.add("lit"))); }
  play(){ if(this.userPaused) return; this.playing=true; this.stage.classList.remove("paused"); this.last=performance.now(); }
  pause(){ this.playing=false; this.stage.classList.add("paused"); }
  tick(now){ if(!this.playing) return; this.t=(this.t+(now-this.last))%(BEAT_MS*this.c.beats.length); this.last=now;
    const i=Math.floor(this.t/BEAT_MS); this.show(i);
    this.segs.forEach((s,k)=>s.style.width=(k<i?100:k>i?0:((this.t-i*BEAT_MS)/BEAT_MS*100))+"%"); }
}
const clips = new Set();
(function loop(now){ clips.forEach(c=>c.tick(now)); requestAnimationFrame(loop); })(performance.now());

/* ============ watch feed ============ */
const feed = $("#v-watch");
const feedClips = {};
function renderFeed(){
  feed.innerHTML = CASES.map(c=>`
  <article class="reel" data-id="${c.id}" aria-label="${esc(c.title)}">
    ${clipHTML(c)}
    <div class="topbar"><div class="wordmark">Launch<span>Justice</span></div><div class="demo-pill">Demo cases</div></div>
    <div class="rail">
      <button data-act="pledge"><span class="ic pledge">${icons.pledge}</span>Pledge</button>
      <button data-act="discuss"><span class="ic">${icons.chat}</span><span data-ccount="${c.id}">0</span></button>
      <button data-act="details"><span class="ic">${icons.info}</span>Details</button>
      <button data-act="share"><span class="ic">${icons.share}</span>Share</button>
    </div>
    <div class="meta" style="--cat:${CATS[c.cat].color}">
      <div class="org"><span class="dot"></span>${esc(c.ngo)}</div>
      <h2>${esc(c.title)}</h2>
      <div class="vs">vs. ${esc(c.defendant)}</div>
      <div class="bar"><i data-pct="${c.id}"></i></div>
      <div class="nums"><span><b data-raised="${c.id}"></b> of ${usd(c.goal)}</span><span data-backers="${c.id}"></span></div>
      <button class="more-btn" data-act="details">See the full case</button>
    </div>
  </article>`).join("");
  feed.querySelectorAll(".reel").forEach(el=>{
    const c = byId[el.dataset.id]; const clip = new Clip(el, c); feedClips[c.id]=clip; clips.add(clip);
    el.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const a=b.dataset.act;
      if(a==="pledge") openPledge(c.id);
      if(a==="discuss") openDiscuss(c.id);
      if(a==="details") openCase(c.id);
      if(a==="share") shareCase(c);
    }));
  });
  const io = new IntersectionObserver(es=>es.forEach(e=>{
    const clip=feedClips[e.target.dataset.id];
    if(e.isIntersecting && e.intersectionRatio>.6 && current==="watch" && !sheetOpen) { activeFeed=e.target.dataset.id; clip.play(); } else clip.pause();
  }),{root:feed, threshold:[0,.6,1]});
  feed.querySelectorAll(".reel").forEach(el=>io.observe(el));
}
let activeFeed = CASES[0].id;
function feedPlay(on){ Object.entries(feedClips).forEach(([id,cl])=> (on && id===activeFeed) ? cl.play() : cl.pause()); }
async function shareCase(c){
  const text = `${c.title} — back this case on LaunchJustice`;
  try{ await navigator.clipboard.writeText(text); toast("Case name copied to share"); }
  catch(e){ toast("Sharing links arrive in a later version"); }
}

/* ============ cases list ============ */
let filter = "all", query = "";
function renderCases(){
  const v = $("#v-cases");
  v.innerHTML = `<div class="head">
      <h1>Cases</h1><p>Public-interest lawsuits you can help fund.</p>
      <input class="search" type="search" placeholder="Search by issue, NGO or defendant" aria-label="Search cases" value="${esc(query)}">
      <div class="chips" role="group" aria-label="Filter by issue">
        <button class="chip" data-f="all" aria-pressed="${filter==="all"}">All</button>
        ${Object.entries(CATS).map(([k,v])=>`<button class="chip" data-f="${k}" aria-pressed="${filter===k}">${v.label}</button>`).join("")}
      </div></div><div class="list" id="caseList"></div>`;
  const s = v.querySelector(".search");
  s.addEventListener("input",()=>{ query=s.value; renderCaseList(); });
  v.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{ filter=b.dataset.f; v.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b)); renderCaseList(); }));
  renderCaseList();
}
function renderCaseList(){
  const q = query.trim().toLowerCase();
  const list = CASES.filter(c=>(filter==="all"||c.cat===filter) && (!q || [c.title,c.ngo,c.defendant,CATS[c.cat].label].join(" ").toLowerCase().includes(q)));
  const el = $("#caseList");
  el.innerHTML = list.length ? list.map(c=>`
    <button class="case" data-id="${c.id}" style="--cat:${CATS[c.cat].color}">
      <div class="cat"><span class="dot"></span>${CATS[c.cat].label}<span style="margin-left:auto">${esc(c.stage)}</span></div>
      <h3><span class="mark">${esc(c.title)}</span></h3>
      <div class="who">${esc(c.ngo)} vs. ${esc(c.defendant)}</div>
      <div class="lbar"><i data-pct="${c.id}"></i></div>
      <div class="lnums"><span><b data-raised="${c.id}"></b> of ${usd(c.goal)}</span><span data-backers="${c.id}"></span></div>
    </button>`).join("") : `<div class="empty">No cases match that search. Try another issue or clear the filter.</div>`;
  el.querySelectorAll(".case").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.id)));
  refresh();
}

/* ============ case detail ============ */
let detailClip=null, detailTab="overview";
function openCase(id){
  const c = byId[id]; const v=$("#v-case"); detailTab="overview";
  if(detailClip){ clips.delete(detailClip); }
  v.innerHTML = `
  <div class="dhero reel" data-id="${c.id}">${clipHTML(c)}
    <button class="back" id="backBtn">${icons.back}Back</button></div>
  <div class="dbody" style="--cat:${CATS[c.cat].color}">
    <div class="case" style="border:0;padding:0;background:none;margin:0"><div class="cat"><span class="dot"></span>${CATS[c.cat].label}</div></div>
    <h1>${esc(c.title)}</h1>
    <div style="color:var(--muted);font-size:15px">Brought by <b style="color:var(--ink)">${esc(c.ngo)}</b></div>
    <div style="margin-top:18px"><span class="big" data-raised="${c.id}"></span> <span style="color:var(--muted)">pledged of ${usd(c.goal)}</span></div>
    <div class="lbar" style="margin-top:8px;height:8px"><i data-pct="${c.id}"></i></div>
    <div class="lnums"><span data-pctlabel="${c.id}"></span><span data-backers="${c.id}"></span></div>
    <dl class="facts">
      <div><dt>Defendant</dt><dd>${esc(c.defendant)}</dd></div>
      <div><dt>Court</dt><dd>${esc(c.court)}</dd></div>
      <div><dt>Stage</dt><dd>${esc(c.stage)}</dd></div>
      <div><dt>Funding goal</dt><dd>${usd(c.goal)}</dd></div>
    </dl>
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="overview" aria-selected="true">Overview</button>
      <button role="tab" data-tab="discussion" aria-selected="false">Discussion (<span data-ccount="${c.id}">0</span>)</button>
    </div>
    <div id="tab-overview">
      <div class="prose">${c.summary.map(p=>`<p>${esc(p)}</p>`).join("")}</div>
      <h4>What the money pays for</h4>
      <div class="budget">${c.budget.map(([k,n])=>`<div><span>${esc(k)}</span><span>${usd(n)}</span></div>`).join("")}</div>
      <h4>Case timeline</h4>
      <ol class="tl">${c.timeline.map(([t,d,done])=>`<li class="${done?"done":""}">${esc(t)}<small>${esc(d)}</small></li>`).join("")}</ol>
      <h4>Updates from the legal team</h4>
      ${c.updates.length? c.updates.map(([d,t])=>`<div class="prose" style="font-size:16px"><p><b style="font-family:var(--ui)">${esc(d)}</b><br>${esc(t)}</p></div>`).join("") : `<p style="color:var(--muted);font-size:15px">No updates yet. Backers will see new filings and rulings here.</p>`}
    </div>
    <div id="tab-discussion" hidden>${composerHTML(c.id)}<div data-comments="${c.id}"></div></div>
  </div>`;
  v.querySelector("#backBtn").addEventListener("click",()=>go(prevView||"cases"));
  v.querySelectorAll("[role=tab]").forEach(t=>t.addEventListener("click",()=>{
    v.querySelectorAll("[role=tab]").forEach(x=>x.setAttribute("aria-selected",x===t));
    $("#tab-overview").hidden = t.dataset.tab!=="overview";
    $("#tab-discussion").hidden = t.dataset.tab!=="discussion";
  }));
  wireComposer(v, c.id);
  detailClip = new Clip(v.querySelector(".dhero"), c); clips.add(detailClip);
  $("#ctaBtn").onclick = ()=>openPledge(c.id);
  v.scrollTop = 0;
  go("case");
  refresh();
}

/* ============ discussion ============ */
function composerHTML(id){
  return `<div class="composer"><textarea rows="1" maxlength="600" placeholder="Why does this case matter to you?" aria-label="Write a comment"></textarea>
  <button class="btn ghost" data-post="${id}">Post</button></div>
  <div class="err" data-cerr></div>`;
}
function wireComposer(root, id){
  const ta = root.querySelector(".composer textarea"), btn = root.querySelector("[data-post]"), err = root.querySelector("[data-cerr]");
  btn.addEventListener("click", async ()=>{
    const text = ta.value.trim();
    if(!text){ err.textContent="Write something before posting."; return; }
    const name = getName();
    if(!name){ openNameThen(()=>btn.click()); return; }
    btn.disabled=true; err.textContent="";
    try{
      await addComment({caseId:id, name, text, createdAt:Date.now(), deviceId, backer: pledgesFor(id).some(p=>p.deviceId===deviceId), likes:{}});
      ta.value=""; toast("Comment posted");
    }catch(e){ err.textContent = "Couldn't post. Check your connection and try again."; }
    btn.disabled=false;
  });
}
function renderComments(el, id){
  const list = commentsFor(id);
  el.innerHTML = list.length ? list.map(cm=>{
    const mine = cm.likes && cm.likes[deviceId];
    return `<div class="cmt"><div class="av">${esc((cm.name||"?").trim().charAt(0).toUpperCase())}</div><div style="flex:1;min-width:0">
      <div class="top"><b>${esc(cm.name)}</b>${cm.backer?'<span class="badge">Backer</span>':""} <span>${ago(cm.createdAt)}</span></div>
      <p>${esc(cm.text)}</p>
      <button class="like" data-like="${esc(cm.id)}" aria-pressed="${!!mine}">${mine?icons.heartFill:icons.heart}Stand with this <span>${likeCount(cm)||""}</span></button>
    </div></div>`}).join("") : `<div class="empty" style="padding:24px 0">Start the conversation. Share why this case matters to you.</div>`;
  el.querySelectorAll("[data-like]").forEach(b=>b.addEventListener("click",()=>{
    const cm = store.comments.find(x=>x.id===b.dataset.like); if(cm) toggleLike(cm).catch(()=>toast("Couldn't save that. Try again."));
  }));
}

/* ============ sheets ============ */
const sheet=$("#sheet"), scrim=$("#scrim"); let sheetOpen=false, lastFocus=null;
function openSheet(html){
  lastFocus=document.activeElement; sheet.innerHTML='<div class="grip"></div>'+html;
  sheet.classList.add("on"); scrim.classList.add("on"); sheetOpen=true; feedPlay(false);
  setTimeout(()=>{ const f=sheet.querySelector("input,textarea,button"); f&&f.focus(); },250);
}
function closeSheet(){
  sheet.classList.remove("on"); scrim.classList.remove("on"); sheetOpen=false;
  if(current==="watch") feedPlay(true);
  lastFocus && lastFocus.focus && lastFocus.focus();
}
scrim.addEventListener("click",closeSheet);
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && sheetOpen) closeSheet(); });
const getName = ()=> (ls("lj_name")||"").trim();

function openNameThen(cb){
  openSheet(`<h2 id="sheetTitle">What should we call you?</h2><p class="sub">No account needed. Your name shows next to your comments.</p>
    <input class="inp" id="nm" maxlength="40" autocomplete="name" placeholder="Your name">
    <div class="err" id="nmErr"></div><button class="btn primary" id="nmGo" style="margin-top:8px">Continue</button>`);
  $("#nmGo").onclick=()=>{ const n=$("#nm").value.trim(); if(!n){ $("#nmErr").textContent="Enter a name to continue."; return; } ls("lj_name",n); closeSheet(); cb(); };
}

function openPledge(id){
  const c = byId[id]; let amt = 100;
  openSheet(`<h2 id="sheetTitle">Pledge to this case</h2>
  <p class="sub">${esc(c.title)}</p>
  <label class="f" for="pName">Your name</label>
  <input class="inp" id="pName" maxlength="40" autocomplete="name" value="${esc(getName())}" placeholder="First and last name">
  <label class="f" id="amtLbl">Amount</label>
  <div class="amts" role="group" aria-labelledby="amtLbl">${[25,50,100,250].map(a=>`<button data-a="${a}" aria-pressed="${a===amt}">$${a}</button>`).join("")}</div>
  <div class="money" style="margin-top:8px"><span>$</span><input class="inp" id="pAmt" inputmode="numeric" placeholder="Other amount" aria-label="Other amount"></div>
  <label class="f" for="pNote">Message to the legal team <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
  <textarea class="inp" id="pNote" rows="2" maxlength="280" placeholder="Why you're backing this case"></textarea>
  <label class="check"><input type="checkbox" id="pPublic" checked> Show my name to other backers</label>
  <div class="notice">This is a pledge, not a payment. No money moves today. We'll contact you when payments open.</div>
  <div class="err" id="pErr"></div>
  <button class="btn primary" id="pGo">Pledge $100</button>`);
  const goBtn=$("#pGo"), other=$("#pAmt");
  const setAmt = a => { amt=a; goBtn.textContent = a>0 ? `Pledge ${usd(a)}` : "Pledge"; };
  sheet.querySelectorAll("[data-a]").forEach(b=>b.addEventListener("click",()=>{
    other.value=""; sheet.querySelectorAll("[data-a]").forEach(x=>x.setAttribute("aria-pressed",x===b)); setAmt(+b.dataset.a);
  }));
  other.addEventListener("input",()=>{
    other.value = other.value.replace(/[^\d]/g,"").slice(0,7);
    sheet.querySelectorAll("[data-a]").forEach(x=>x.setAttribute("aria-pressed","false")); setAmt(+other.value||0);
  });
  goBtn.addEventListener("click", async ()=>{
    const name=$("#pName").value.trim(), err=$("#pErr");
    if(!name){ err.textContent="Enter your name so the NGO knows who pledged."; $("#pName").focus(); return; }
    if(!(amt>=1)){ err.textContent="Choose an amount or enter one of at least $1."; return; }
    ls("lj_name",name); goBtn.disabled=true; err.textContent="";
    const pub = $("#pPublic").checked;
    try{
      await addPledge({caseId:id, name, displayName: pub?name:"Anonymous backer", amount:amt, note:$("#pNote").value.trim(), createdAt:Date.now(), deviceId});
      pledgeDone(c, amt);
    }catch(e){
      goBtn.disabled=false;
      err.textContent = "Couldn't record the pledge. Check your connection and try again.";
    }
  });
}
function pledgeDone(c, amt){
  sheet.innerHTML = `<div class="grip"></div><div class="center">
    <div class="done-mark">${icons.check}</div>
    <h2 id="sheetTitle">Pledge recorded</h2>
    <p class="sub" style="margin-top:6px">You pledged ${usd(amt)} to ${esc(c.ngo)}. No money has moved. We'll reach out when payments open.</p>
    <button class="btn primary" id="dDisc">Join the discussion</button>
    <button class="btn ghost" id="dClose" style="width:100%;margin-top:8px">Keep watching</button></div>`;
  $("#dDisc").onclick=()=>{ closeSheet(); openDiscuss(c.id); };
  $("#dClose").onclick=()=>{ closeSheet(); };
  $("#dDisc").focus();
}
function openDiscuss(id){
  const c=byId[id];
  openSheet(`<h2 id="sheetTitle">Discussion</h2><p class="sub">${esc(c.title)}</p>${composerHTML(id)}<div data-comments="${id}"></div>`);
  wireComposer(sheet, id); refresh();
}

/* ============ my pledges ============ */
function renderMine(){
  const v=$("#v-mine"); const mine = store.pledges.filter(p=>p.deviceId===deviceId).sort((a,b)=>b.createdAt-a.createdAt);
  const total = mine.reduce((s,p)=>s+(+p.amount||0),0); const nCases = new Set(mine.map(p=>p.caseId)).size;
  v.innerHTML = `<div class="head"><h1>My pledges</h1><p>${getName()?`Pledging as ${esc(getName())}`:"Pledges you make appear here."}</p></div>
  <div class="list">
    <div class="stat-row"><div class="stat"><small>Total pledged</small><span class="big">${usd(total)}</span></div>
    <div class="stat"><small>Cases backed</small><span class="big">${nCases}</span></div></div>
    <div class="live" style="margin:4px 0 10px"><i></i><span></span></div>
    ${mine.length? mine.map(p=>{ const c=byId[p.caseId]; if(!c) return ""; return `<button class="prow" data-id="${c.id}">
      <div><div class="t">${esc(c.title)}</div><small>${esc(c.ngo)}, ${ago(p.createdAt)} ago</small></div><b>${usd(p.amount)}</b></button>`; }).join("")
    : `<div class="empty">You haven't pledged yet. Watch a few clips and back a case you believe in.<br><br><button class="btn primary" style="width:auto" id="goWatch">Watch cases</button></div>`}
  </div>`;
  v.querySelectorAll(".prow").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.id)));
  const gw=v.querySelector("#goWatch"); gw && gw.addEventListener("click",()=>go("watch"));
  v.querySelectorAll(".live").forEach(el=>{ el.classList.toggle("on",store.live); el.lastChild.textContent = store.live?"Shared with all backers":"Saved on this device only"; });
}

/* ============ navigation ============ */
let current="watch", prevView=null;
function go(view){
  if(view!=="case" && current!=="case") prevView=null;
  if(view==="case" && current!=="case") prevView=current;
  current=view;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on", v.id==="v-"+view));
  const nav=$("#nav"); nav.classList.toggle("dark", view==="watch");
  nav.querySelectorAll("button").forEach(b=>{ const on = b.dataset.go===view || (view==="case" && b.dataset.go===prevView); on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"); });
  $("#cta").classList.toggle("on", view==="case");
  feedPlay(view==="watch" && !sheetOpen);
  if(detailClip){ view==="case" ? detailClip.play() : detailClip.pause(); }
  if(view==="cases" && !$("#caseList")) renderCases();
  if(view==="mine") renderMine();
}
$("#nav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

renderFeed(); renderCases(); go("watch"); refresh();
initDb();
