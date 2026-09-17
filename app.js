/* =====================================================================
   LaunchJustice
   ---------------------------------------------------------------------
   data.js   the demo content and the score model
   viz.js    every chart, drawn as inline SVG
   app.js    this file: state, screens and interaction
   ===================================================================== */

const byId = Object.fromEntries(CASES.map(c=>[c.id,c]));
const BEAT_MS = 12000; /* 5 beats x 12s = a 60-second clip */

/* ============ helpers ============ */
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const usd = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
/* $1.24M rather than $1,244,300 wherever the exact dollar does not matter */
const numShort = n => n>=1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,"")+"M" : n>=1e4 ? Math.round(n/1e3)+"k" : num(n);
const usdShort = n => n>=1e6 ? "$"+(n/1e6).toFixed(n>=1e7?0:2).replace(/\.00$/,"")+"M"
                  : n>=1e3 ? "$"+Math.round(n/1e3)+"k" : usd(n);
const agoText = t => { const a = ago(t); return a === "just now" ? a : a + " ago"; };
const mmss = s => Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
const ago = t => { const s=(Date.now()-t)/1000; if(s<60) return "just now"; if(s<3600) return Math.floor(s/60)+"m"; if(s<86400) return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; };
function ls(k, v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v);}catch(e){ return null; } }
function lsJson(k, v){
  if(v===undefined){ try{ return JSON.parse(ls(k)||"{}"); }catch(e){ return {}; } }
  ls(k, JSON.stringify(v)); return v;
}
let deviceId = ls("lj_device");
if(!deviceId){ deviceId = "d:"+Math.random().toString(36).slice(2,10); ls("lj_device",deviceId); }
else if(!deviceId.startsWith("d:")){ deviceId = "d:"+deviceId.replace(/^d/,""); ls("lj_device",deviceId); }

/* A confirmation or Google link can come back with an error in the URL instead
   of a session: expired, already used, or cancelled. Read it before the
   Supabase client has a chance to clear the hash, and say so rather than
   dropping the person on a silent signed-out screen. */
const urlAuthError = (() => {
  const inHash = (location.hash || "").slice(1).includes("error");
  const raw = inHash ? location.hash.slice(1) : (location.search || "").slice(1);
  if(!raw || !raw.includes("error")) return null;
  const q = new URLSearchParams(raw);
  const code = q.get("error_code") || q.get("error") || "";
  const desc = (q.get("error_description") || "").replace(/\+/g, " ");
  if(!code && !desc) return null;
  history.replaceState(null, "", location.pathname + (inHash ? location.search : ""));
  if(code.includes("otp_expired")) return "That email link has expired. Create the account again to get a fresh one.";
  if(code.includes("access_denied")) return "That link didn't work — it may already have been used.";
  return desc || "Signing in didn't complete. Try again.";
})();

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
  playSm:'<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  up:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
  down:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg>',
  lock:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  shield:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.3-2.9 8.1-7 9.5-4.1-1.4-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  flame:'<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M13.5 2c.5 3-1.2 4.4-2.6 5.7C9.2 9.2 7.5 10.7 7.5 14a5.5 5.5 0 0 0 11 0c0-2.4-1-3.7-1.9-4.8-.3 1-.9 1.7-1.7 2 .4-2.6-.6-6.6-1.4-9.2z"/><path d="M9.6 14.6c0-1.3.7-2 1.4-2.7.5 1.6 1.7 1.9 1.7 3.3a1.6 1.6 0 0 1-3.1-.6z" fill="#fff" opacity=".55"/></svg>',
  news:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h12v14H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M16 9h3a1 1 0 0 1 1 1v7.5a1.5 1.5 0 0 1-3 0V9zM7 8.5h6M7 12h6M7 15.5h4"/></svg>',
  spark:'<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/></svg>',
  google:'<svg viewBox="0 0 18 18" width="18" height="18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>',
  signout:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
};
const TREND_ICON = {backing:icons.flame, news:icons.news, talk:icons.spark};

/* Photographs sit on top of generated artwork everywhere they appear. If one
   will not load — a dead URL, a blocked host, no connection — it removes
   itself and the artwork underneath is already in place. Captured on the way
   down, because load and error do not bubble. */
document.addEventListener("error", e=>{
  const t = e.target;
  if(t.tagName === "IMG" && t.classList.contains("fb")) t.remove();
}, true);
document.addEventListener("load", e=>{
  const t = e.target;
  if(t.tagName === "IMG" && t.classList.contains("fb")) t.classList.add("on");
}, true);
/* generated artwork with the real photograph over it, wherever a case is
   shown as a picture */
const artOf = (c, seed) => heroArt(c, seed) +
  (c.hero ? `<img class="fb" alt="" loading="lazy" src="${esc(c.hero.src)}">` : "");

/* ============ accounts ============
   Accounts are optional. A signed-out visitor acts as their browser
   ("d:<random>"), a signed-in one acts as their account ("u:<uuid>"), and
   actorId() is the single key the rest of the app uses for "mine" and for
   one-like-per-person. */
const auth = { session:null, profile:null, ready:false };
const signedIn = () => !!auth.session;
const myUserId = () => auth.session ? auth.session.user.id : null;
const actorId  = () => signedIn() ? "u:"+myUserId() : deviceId;
const myActors = () => signedIn() ? [actorId(), deviceId] : [deviceId];
const myAvatar = () => (signedIn() && auth.profile) ? (auth.profile.avatar_url||null) : null;
const myEmail  = () => signedIn() ? (auth.session.user.email||"") : "";

/* ============ data layer ============
   Shared mode: Supabase, when SUPABASE_URL and SUPABASE_ANON_KEY are set in
   config.js. Local mode: saved in this browser only, and accounts are off. */
const store = { pledges:[], comments:[], live:false };
let sb = null;
function loadLocal(){ try{ const d = JSON.parse(ls("lj_local")||"{}"); store.pledges=d.pledges||[]; store.comments=d.comments||[]; }catch(e){} }
function saveLocal(){ ls("lj_local", JSON.stringify({pledges:store.pledges, comments:store.comments})); }
loadLocal();

const CFG = window.LJ_CONFIG || {};
async function fetchAll(){
  const [p, c, l] = await Promise.all([
    sb.from("pledges").select("id, case_id, display_name, amount, actor_id, user_id, created_at").order("created_at",{ascending:true}).limit(5000),
    sb.from("comments").select("id, case_id, name, avatar_url, body, is_backer, actor_id, user_id, created_at").order("created_at",{ascending:false}).limit(2000),
    sb.from("comment_likes").select("comment_id, actor_id").limit(10000)
  ]);
  if(p.error || c.error || l.error) throw (p.error||c.error||l.error);
  const likes = {};
  l.data.forEach(r=>{ (likes[r.comment_id] ||= {})[r.actor_id] = true; });
  store.pledges = p.data.map(r=>({id:r.id, caseId:r.case_id, name:r.display_name, displayName:r.display_name, amount:+r.amount, createdAt:Date.parse(r.created_at), actorId:r.actor_id, userId:r.user_id}));
  store.comments = c.data.map(r=>({id:r.id, caseId:r.case_id, name:r.name, avatar:r.avatar_url, text:r.body, backer:r.is_backer, createdAt:Date.parse(r.created_at), actorId:r.actor_id, userId:r.user_id, likes:likes[r.id]||{}}));
  store.live = true;
  refresh();
}
let refetchT;
const scheduleFetch = () => { clearTimeout(refetchT); refetchT = setTimeout(()=>fetchAll().catch(console.error), 250); };

async function loadProfile(){
  auth.profile = null;
  if(!sb || !auth.session) return;
  try{
    const {data} = await sb.from("profiles").select("id, display_name, avatar_url").eq("id", myUserId()).maybeSingle();
    auth.profile = data || null;
  }catch(e){ console.error("Couldn't load profile", e); }
}

async function initDb(){
  if(!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)) { refresh(); renderAccount(); return; }
  try{
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const {data:{session}} = await sb.auth.getSession();
    auth.session = session || null;
    await loadProfile();
    sb.auth.onAuthStateChange(async (event, s)=>{
      const before = myUserId();
      auth.session = s || null;
      await loadProfile();
      renderAccount(); refresh();
      if(myUserId() !== before){
        scheduleFetch();
        if(auth.ready && event === "SIGNED_IN") toast("Signed in as "+getName());
        if(auth.ready && event === "SIGNED_OUT") toast("Signed out");
      }
    });
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
  auth.ready = true;
  renderAccount();
  if(urlAuthError && !signedIn()) openAuth("in", urlAuthError);
}

const stamp = () => ({actor_id: actorId(), user_id: myUserId()});

async function addPledge(p){
  if(sb){
    const {error} = await sb.from("pledges").insert({case_id:p.caseId, name:p.name, display_name:p.displayName, amount:p.amount, note:p.note||null, ...stamp()});
    if(error) throw error; scheduleFetch();
  } else { store.pledges.push({id:"l"+Date.now(), ...p, actorId:actorId(), userId:null}); saveLocal(); refresh(); }
}
async function addComment(c){
  if(sb){
    const {error} = await sb.from("comments").insert({case_id:c.caseId, name:c.name, avatar_url:myAvatar(), body:c.text, is_backer:!!c.backer, ...stamp()});
    if(error) throw error;
    scheduleFetch();
  } else {
    store.comments.push({id:"l"+Date.now(), ...c, actorId:actorId(), userId:null, avatar:myAvatar()});
    saveLocal(); refresh();
  }
}
async function toggleLike(cm){
  const me = actorId();
  if(cm.seed){ /* a seeded comment has no database row: like it in this browser */
    const m = lsJson("lj_seedlike"); m[cm.id] = !m[cm.id]; lsJson("lj_seedlike", m); refresh(); return;
  }
  const on = !(cm.likes && cm.likes[me]);
  if(sb){
    const q = on
      ? sb.from("comment_likes").upsert({comment_id:cm.id, ...stamp()})
      : sb.from("comment_likes").delete().eq("comment_id",cm.id).eq("actor_id",me);
    const {error} = await q; if(error) throw error; scheduleFetch();
  } else { cm.likes = {...(cm.likes||{}), [me]:on}; saveLocal(); refresh(); }
}

const pledgesFor = id => store.pledges.filter(p=>p.caseId===id);
const raised  = c => c.baseRaised + pledgesFor(c.id).reduce((s,p)=>s+(+p.amount||0),0);
const backers = c => c.baseBackers + pledgesFor(c.id).length;
const pct     = c => Math.min(100, Math.round(raised(c)/c.goal*100));
const backedByMe = id => { const mine = myActors(); return pledgesFor(id).some(p=>mine.includes(p.actorId)); };

/* ============ discussion ============
   Every case ships with a seeded thread so the page is never empty and so
   the shape of a healthy discussion is visible: people backing it, people
   asking, people pushing back, and the legal team answering in public.
   Seeded comments and real ones live in the same list and are rendered by
   the same code. */
const NOW0 = Date.now();
const seeded = {};
CASES.forEach(c=>{
  seeded[c.id] = (SEED_COMMENTS[c.id]||[]).map((s,i)=>({
    id:"s:"+c.id+":"+i, caseId:c.id, seed:true,
    name:s.n, text:s.t, stance:s.s, backer:!!s.b, role:s.role||null, team:!!s.role,
    createdAt: NOW0 - Math.round(s.h*3600e3), seedLikes: s.l||0,
    replies:(s.r||[]).map((r,j)=>({
      id:"s:"+c.id+":"+i+":"+j, name:r.n, text:r.t, role:r.role||null, team:!!r.role,
      createdAt: NOW0 - Math.round(r.h*3600e3)
    }))
  }));
});

const mineComments = id => store.comments.filter(c=>c.caseId===id)
  .map(c=>({...c, stance:null, replies:[]}));
/* newest first, with the seeded thread underneath anything written today */
const commentsFor = id => [...mineComments(id), ...seeded[id]].sort((a,b)=>b.createdAt-a.createdAt);
const commentTotal = id => (DISCUSSION[id]?.total || 0) + store.comments.filter(c=>c.caseId===id).length;
const likeCount = cm => (cm.seedLikes||0)
  + (cm.seed ? (lsJson("lj_seedlike")[cm.id] ? 1 : 0) : Object.values(cm.likes||{}).filter(Boolean).length);
const likedByMe = cm => cm.seed ? !!lsJson("lj_seedlike")[cm.id] : !!(cm.likes && cm.likes[actorId()]);

/* the community pulse: how the discussion is split, at platform scale */
function pulseFor(id){
  const base = {...(DISCUSSION[id]?.pulse || {support:0,question:0,skeptical:0})};
  const total = base.support+base.question+base.skeptical || 1;
  return {...base, total, supportPct: Math.round(base.support/total*100), questionPct: Math.round(base.question/total*100),
          skepticalPct: Math.round(base.skeptical/total*100)};
}

/* the community score: a five point rating, Rotten Tomatoes style, with the
   visitor's own rating folded in */
const myRatings = () => lsJson("lj_rating");
function communityScore(id){
  const counts = [...byId[id].rating.counts];
  const mine = myRatings()[id];
  if(mine && mine.stars) counts[mine.stars-1]++;
  const n = counts.reduce((a,b)=>a+b,0);
  const avg = counts.reduce((s,c,i)=>s+c*(i+1),0)/(n||1);
  return {counts, n, avg: Math.round(avg*10)/10, mine: mine||null,
          positive: Math.round((counts[3]+counts[4])/(n||1)*100)};
}

/* trending first, everywhere a list of cases is drawn */
const trendRank = c => (c.trending ? 0 : 1);
const ordered = () => [...CASES].sort((a,b)=> trendRank(a)-trendRank(b) || backers(b)-backers(a));

/* live stat bindings — update in place so the feed never re-renders */
function refresh(){
  $$("[data-raised]").forEach(el=>el.textContent=usd(raised(byId[el.dataset.raised])));
  $$("[data-raised-s]").forEach(el=>el.textContent=usdShort(raised(byId[el.dataset.raisedS])));
  $$("[data-backers]").forEach(el=>{ const n=backers(byId[el.dataset.backers]); el.textContent = num(n)+(n===1?" backer":" backers"); });
  $$("[data-backers-n]").forEach(el=>el.textContent=num(backers(byId[el.dataset.backersN])));
  $$("[data-pct]").forEach(el=>el.style.width=pct(byId[el.dataset.pct])+"%");
  $$("[data-pctlabel]").forEach(el=>el.textContent=pct(byId[el.dataset.pctlabel])+"% funded");
  $$("[data-ccount]").forEach(el=>el.textContent=num(commentTotal(el.dataset.ccount)));
  $$("[data-comments]").forEach(el=>renderComments(el, el.dataset.comments));
  $$(".live").forEach(el=>{ el.classList.toggle("on",store.live); el.lastChild.textContent = store.live?"Shared with all backers":"Saved on this device only"; });
  if(current==="mine") renderMine();
}

/* ============ clip ============
   Everything drawn on top of a clip lives inside `.frame`: the whole screen
   on a phone, a centred 9:16 card on a laptop.
   A clip with no `video` plays as an animated caption card built from its
   beats. Give it video:"<url>" (and optionally poster:"<url>") and the real
   file plays in the same frame, with the progress bar and captions following
   the video's own clock instead of the beat timer. Nothing else changes,
   which is how the real clips will drop in. */
function clipHTML(src, inner=""){
  const beats = src.beats || [];
  /* A clip can also be somebody else's player. News footage and anything else
     under licence is not ours to host, and the publisher's embed is the route
     that is actually allowed: their player, their terms, their count. It gets
     the frame to itself — no captions, no progress bar, no tap-to-pause —
     because the controls belong to whoever owns the video. */
  if(src.embed) return `<div class="frame">
    <div class="stage embedded" style="--cat:${CATS[src.cat].color}">
      <iframe class="vid" src="${esc(src.embed)}" title="${esc(src.title || "Case clip")}"
        loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
    </div>${inner}</div>`;
  /* A real file plays as a video. Without one the clip is still built like
     footage rather than like a caption card: the case photograph sits behind
     the type on a slow push-in, under grain and a vignette, so the section
     reads as a clip reel while the real files are being shot. */
  const media = src.video
    ? `<video class="vid" src="${esc(src.video)}"${src.poster?` poster="${esc(src.poster)}"`:""} playsinline muted loop preload="metadata"></video>`
    : src.photo
      ? `<img class="stage-photo fb" alt="" src="${esc(src.photo)}">`
      : "";
  return `<div class="frame">
    <div class="stage${src.video?"":" lens"}" style="--cat:${CATS[src.cat].color};--kb:${src.kb||0}">${media}<span class="grain"></span></div>
    <div class="segs">${beats.map(()=>'<div class="seg"><i></i></div>').join("")}</div>
    ${beats.length && !src.video ?`<div class="caption" aria-live="off"><p class="enter"><span>${esc(beats[0])}</span></p></div>`:""}
    <button class="tap" aria-label="Pause or play clip"></button>
    <div class="pause-ico"><div>${icons.play}</div></div>
    ${inner}</div>`;
}
class Clip{
  constructor(root, src){ this.root=root; this.src=src; this.beats=src.beats||[]; this.span=BEAT_MS*Math.max(1,this.beats.length);
    this.t=0; this.beat=-1; this.playing=false; this.userPaused=false; this.last=performance.now();
    this.p=root.querySelector(".caption p"); this.segs=[...root.querySelectorAll(".seg i")];
    this.stage=root.querySelector(".stage"); this.video=root.querySelector("video");
    this.embed=!!root.querySelector("iframe");
    const tap=root.querySelector(".tap");
    if(tap) tap.addEventListener("click",()=>{ this.userPaused=!this.userPaused; this.userPaused?this.pause():this.play(); });
    /* A video that will not load must not leave a black rectangle on the
       screen. It is dropped and the clip falls back to the treatment it would
       have had with no file at all, captions included. */
    if(this.video) this.video.addEventListener("error", ()=>this.degrade(), {once:true});
    this.show(0); }
  degrade(){
    if(!this.video) return;
    this.video.remove(); this.video = null;
    this.stage.classList.add("lens");
    if(this.src.photo && !this.stage.querySelector(".stage-photo")){
      const img = document.createElement("img");
      img.className = "stage-photo fb"; img.alt = ""; img.src = this.src.photo;
      this.stage.prepend(img);
    }
    if(this.beats.length && !this.p){
      const cap = document.createElement("div");
      cap.className = "caption"; cap.setAttribute("aria-live","off");
      cap.innerHTML = '<p class="enter"><span></span></p>';
      this.root.querySelector(".frame").insertBefore(cap, this.root.querySelector(".tap"));
      this.p = cap.querySelector("p");
      this.beat = -1; this.show(Math.min(this.beats.length-1, Math.floor(this.t/BEAT_MS)));
    }
    this.t = 0; this.last = performance.now();
  }
  show(i){ if(!this.p || i===this.beat) return; this.beat=i; this.p.classList.remove("lit","enter"); this.p.firstChild.textContent=this.beats[i];
    void this.p.offsetWidth; this.p.classList.add("enter"); requestAnimationFrame(()=>requestAnimationFrame(()=>this.p.classList.add("lit"))); }
  play(){ if(this.embed || this.userPaused) return; this.playing=true; this.stage.classList.remove("paused"); this.last=performance.now();
    if(this.video) this.video.play().catch(()=>{}); }
  pause(){ if(this.embed) return; this.playing=false; this.stage.classList.add("paused"); if(this.video) this.video.pause(); }
  tick(now){ if(!this.playing) return;
    if(this.video && this.video.duration) this.t=this.video.currentTime/this.video.duration*this.span;
    else this.t=(this.t+(now-this.last))%this.span;
    this.last=now;
    if(!this.beats.length) return;
    const i=Math.min(this.beats.length-1, Math.floor(this.t/BEAT_MS)); this.show(i);
    this.segs.forEach((s,k)=>s.style.width=(k<i?100:k>i?0:((this.t-i*BEAT_MS)/BEAT_MS*100))+"%"); }
}
const clips = new Set();
(function loop(now){ clips.forEach(c=>c.tick(now)); requestAnimationFrame(loop); })(performance.now());

/* a case's own hero clip, and the short clips in its clip section, are the
   same kind of thing to the player */
const caseClip = c => ({beats:c.beats, video:c.video, embed:c.embed, poster:c.poster, cat:c.cat,
                        title:c.head, photo: c.hero && c.hero.src, kb:0});
/* each short clip frames the photograph differently, so a rail of five does
   not look like the same still five times */
const shortClip = (c, k) => ({...c.clips[k], video:c.clips[k].src, cat:c.cat,
                              photo: c.clips[k].poster || (c.hero && c.hero.src), kb:(k%4)+1});

/* ============ badges ============ */
function trendBadge(c, cls=""){
  if(!c.trending) return "";
  return `<span class="trend ${cls}">${TREND_ICON[c.trending.kind]||icons.flame}<span>${esc(c.trending.reason)}</span>${
    c.trending.spark?spark(c.trending.spark):""}</span>`;
}
const vettedBadge = (c, cls="") =>
  `<button class="vetted ${cls}" data-vetted="${c.id}">${icons.shield}Vetted by LaunchJustice</button>`;

/* ============ watch feed ============ */
const feed = $("#v-watch");
const feedClips = {};
let feedOrder = [];
function renderFeed(){
  feedOrder = ordered();
  feed.innerHTML = feedOrder.map(c=>`
  <article class="reel" data-id="${c.id}" aria-label="${esc(c.head)}">
    ${clipHTML(caseClip(c), `
      <div class="topbar"><div class="wordmark">Launch<span>Justice</span></div></div>
      <div class="meta" style="--cat:${CATS[c.cat].color}">
        ${trendBadge(c,"on-dark")}
        <div class="org"><span class="dot"></span>${esc(c.ngo)}</div>
        <h2>${esc(c.head)}</h2>
        <div class="vs">${esc(c.caseName)}</div>
        <div class="meta-row">${scoreTiny(c)}
          <div class="meta-fund">
            <div class="bar"><i data-pct="${c.id}"></i></div>
            <div class="nums"><span><b data-raised-s="${c.id}"></b> of ${usdShort(c.goal)}</span><span data-backers="${c.id}"></span></div>
          </div></div>
        <button class="more-btn" data-act="details">See the full case</button>
      </div>`)}
    <div class="rail">
      <button data-act="pledge"><span class="ic pledge">${icons.pledge}</span>Pledge</button>
      <button data-act="discuss"><span class="ic">${icons.chat}</span><span data-ccount="${c.id}">0</span></button>
      <button data-act="details"><span class="ic">${icons.info}</span>Details</button>
      <button data-act="share"><span class="ic">${icons.share}</span>Share</button>
    </div>
  </article>`).join("") + `
  <div class="feednav">
    <button data-step="-1" aria-label="Previous case">${icons.up}</button>
    <button data-step="1" aria-label="Next case">${icons.down}</button>
  </div>`;
  feed.querySelectorAll(".reel").forEach(el=>{
    const c = byId[el.dataset.id]; const clip = new Clip(el, caseClip(c)); feedClips[c.id]=clip; clips.add(clip);
    el.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>{
      const a=b.dataset.act;
      if(a==="pledge") openPledge(c.id);
      if(a==="discuss") openCase(c.id, "s-talk");
      if(a==="details") openCase(c.id);
      if(a==="share") shareCase(c);
    }));
  });
  feed.querySelectorAll("[data-step]").forEach(b=>b.addEventListener("click",()=>stepFeed(+b.dataset.step)));
  const io = new IntersectionObserver(es=>es.forEach(e=>{
    const clip=feedClips[e.target.dataset.id];
    if(e.isIntersecting && e.intersectionRatio>.6 && current==="watch" && !sheetOpen) { activeFeed=e.target.dataset.id; clip.play(); } else clip.pause();
  }),{root:feed, threshold:[0,.6,1]});
  feed.querySelectorAll(".reel").forEach(el=>io.observe(el));
}
function stepFeed(dir){ feed.scrollBy({top: dir*feed.clientHeight, behavior:"smooth"}); }
let activeFeed = CASES[0].id;
function feedPlay(on){ Object.entries(feedClips).forEach(([id,cl])=> (on && id===activeFeed) ? cl.play() : cl.pause()); }
async function shareCase(c){
  const text = `${c.head} — back this case on LaunchJustice`;
  try{ await navigator.clipboard.writeText(text); toast("Case copied to share"); }
  catch(e){ toast("Sharing links arrive in a later version"); }
}

/* ============ cases list ============ */
let filter = "all", query = "";
function renderCases(){
  const v = $("#v-cases");
  v.innerHTML = `<div class="head">
      <h1>Cases</h1>
      <div class="platform" id="platform">
        <span><b data-count="${PLATFORM.committed}" data-fmt="usd">$0</b><small>committed</small></span>
        <span><b data-count="${PLATFORM.members}" data-fmt="short">0</b><small>members</small></span>
        <span><b data-count="${PLATFORM.casesFunded}">0</b><small>cases funded</small></span>
        <span><b data-count="${PLATFORM.paidBack}" data-fmt="usd">$0</b><small>returned to backers</small></span>
      </div>
      <div class="ticker-live" id="liveTick"><i></i><span></span></div>
      <input class="search" type="search" placeholder="Search by issue, NGO or defendant" aria-label="Search cases" value="${esc(query)}">
      <div class="chips" role="group" aria-label="Filter by issue">
        <button class="chip" data-f="all" aria-pressed="${filter==="all"}">All</button>
        ${Object.entries(CATS).map(([k,val])=>`<button class="chip" data-f="${k}" aria-pressed="${filter===k}">${val.label}</button>`).join("")}
      </div></div>
    <div class="trendrow" id="trendRow"></div>
    <div class="list" id="caseList"></div>`;
  const s = v.querySelector(".search");
  s.addEventListener("input",()=>{ query=s.value; renderCaseList(); });
  v.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{ filter=b.dataset.f; v.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b)); renderCaseList(); }));
  renderTrendRow();
  renderCaseList();
  /* the platform totals count themselves up the first time they are seen */
  const pf = v.querySelector("#platform");
  const pio = new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;
    pf.querySelectorAll("[data-count]").forEach((el,i)=>setTimeout(()=>
      countUp(el, +el.dataset.count, 1100,
        el.dataset.fmt==="usd" ? usdShort : el.dataset.fmt==="short" ? numShort : num), i*90));
    pio.disconnect();
  }),{root:v, threshold:.4});
  pio.observe(pf);
  startLiveTicker();
}

/* "Trending now": the cases moving this week, ahead of the search and the
   filters, because that is the question people arrive with. */
function renderTrendRow(){
  const el = $("#trendRow"); if(!el) return;
  const t = CASES.filter(c=>c.trending);
  if(!t.length){ el.innerHTML=""; return; }
  el.innerHTML = `<div class="trendrow-head"><h2>${icons.flame}Trending now</h2><span>Moving fastest this week</span></div>
    <div class="trendrow-rail">${t.map(c=>`
      <button class="tcard" data-id="${c.id}" style="--cat:${CATS[c.cat].color}">
        <span class="tcard-art">${artOf(c,1)}<span class="tcard-cat">${CATS[c.cat].label}</span></span>
        <span class="tcard-head">${esc(c.head)}</span>
        <span class="tcard-why">${TREND_ICON[c.trending.kind]||icons.flame}${esc(c.trending.reason)}</span>
        <span class="tcard-foot">${scoreTiny(c,30)}<span class="tcard-fund"><b data-raised-s="${c.id}"></b> of ${usdShort(c.goal)}</span></span>
      </button>`).join("")}</div>`;
  el.querySelectorAll(".tcard").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.id)));
}

function renderCaseList(){
  const q = query.trim().toLowerCase();
  const list = ordered().filter(c=>(filter==="all"||c.cat===filter) &&
    (!q || [c.head,c.title,c.ngo,c.defendant,c.caseName,CATS[c.cat].label].join(" ").toLowerCase().includes(q)));
  const el = $("#caseList");
  el.innerHTML = list.length ? list.map(c=>{
    const cs = communityScore(c.id);
    return `<button class="case" data-id="${c.id}" style="--cat:${CATS[c.cat].color}">
      <span class="case-art">${artOf(c,2)}
        <span class="case-badges">${c.trending?trendBadge(c,"on-dark sm"):""}</span>
        <span class="case-cat"><span class="dot"></span>${CATS[c.cat].label}</span></span>
      <span class="case-body">
        <span class="case-head">${esc(c.head)}</span>
        <span class="who">${esc(c.ngo)} · ${esc(STAGES[c.stageIdx])}</span>
        ${scorePair(c, 44, "on-card")}
        <span class="lbar"><i data-pct="${c.id}"></i></span>
        <span class="lnums"><span><b data-raised-s="${c.id}"></b> of ${usdShort(c.goal)}</span><span data-backers="${c.id}"></span></span>
        <span class="case-foot">
          <span class="cs-mini">${ratingDots(cs.avg)}<b>${cs.avg}</b><small>${num(cs.n)} ratings</small></span>
          <span class="lock-mini">${icons.lock}${lockYears(c)}y</span>
        </span>
      </span>
    </button>`;}).join("") : `<div class="empty">No cases match that search. Try another issue or clear the filter.</div>`;
  el.querySelectorAll(".case").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.id)));
  refresh();
}

/* A platform with two million members is never still. The ticker is one
   line of that, rotating, so the page reads as a live product rather than
   a set of screenshots. */
let liveT = null;
function startLiveTicker(){
  clearInterval(liveT);
  const el = $("#liveTick"); if(!el) return;
  const span = el.querySelector("span");
  const beat = () => {
    const c = CASES[Math.floor(Math.random()*CASES.length)];
    const n = TICKER_NAMES[Math.floor(Math.random()*TICKER_NAMES.length)];
    const city = TICKER_CITIES[Math.floor(Math.random()*TICKER_CITIES.length)];
    const what = Math.random()<.62
      ? `${n} in ${city} backed <b>${esc(c.title)}</b> with $${[25,50,75,100,150,250,500][Math.floor(Math.random()*7)]}`
      : Math.random()<.5
        ? `${n} in ${city} joined the discussion on <b>${esc(c.title)}</b>`
        : `${num(Math.floor(Math.random()*400)+120)} people are watching <b>${esc(c.title)}</b> right now`;
    span.classList.remove("in"); void span.offsetWidth;
    span.innerHTML = what; span.classList.add("in");
  };
  beat();
  if(!REDUCED) liveT = setInterval(beat, 4200);
}

/* =====================================================================
   case page
   ---------------------------------------------------------------------
   One scrolling page, ordered the way a person decides: what is this, what
   do others think, can it win, when do I get my money back, who is running
   it, and only then the filings. The discussion sits third rather than
   behind a tab, and a rolling highlight puts a real voice on the screen
   within a second of arriving.
   ===================================================================== */
const SECTIONS = [["s-why","Why"],["s-talk","Discussion"],["s-time","Timeline"],["s-return","Returns"],["s-clips","Clips"],["s-team","Team"],["s-detail","Detail"]];

function scoreHeadline(c){
  const m = meritScore(c), i = impactScore(c);
  return `<div class="shead">
    <div class="shead-dial">${gauge(96,m,i)}</div>
    <div class="shead-rows">
      <button class="shead-row m" data-score="merit">
        <b>${m}</b><span class="shead-lab">Chance to win</span></button>
      <button class="shead-row i" data-score="impact">
        <b>${i}</b><span class="shead-lab">Social impact</span>
        <small>How much it matters beyond the plaintiffs.</small></button>
    </div>
    <button class="shead-more" data-score="merit">See how both are built ${icons.back}</button>
  </div>`;
}

function heroHTML(c){
  return `<header class="chero" style="--cat:${CATS[c.cat].color}">
    <div class="chero-bg" id="cheroBg">${heroArt(c)}${c.hero?`<img class="chero-img fb" alt="" src="${esc(c.hero.src)}">`:""}</div>
    <button class="back" id="backBtn">${icons.back}Back</button>
    ${vettedBadge(c,"on-hero")}
    <div class="chero-in">
      <div class="chero-tags"><span class="cpill"><span class="dot"></span>${CATS[c.cat].label}</span>${trendBadge(c,"on-dark")}</div>
      <h1>${esc(c.head)}</h1>
      <p class="chero-case">${esc(c.caseName)} · ${esc(c.court)}</p>
      <div class="chero-strip">
        <span class="chs"><b data-raised-s="${c.id}"></b><small>of ${usdShort(c.goal)}</small></span>
        <span class="chs"><b data-backers-n="${c.id}"></b><small>backers</small></span>
        <span class="chs"><b>${num(c.watching)}</b><small>watching now</small></span>
        <span class="chs chs-score">${scoreTiny(c,32)}<small>win / impact</small></span>
      </div>
      <div class="chero-bar"><i data-pct="${c.id}"></i></div>
      <button class="chero-play" data-clip="hero">${icons.playSm}Watch the 60-second clip</button>
    </div>
  </header>`;
}

/* The rolling highlight. One voice at a time, a few seconds each, tap for
   the rest. It is the cheapest way to show that a case has a crowd behind
   it before anyone has scrolled. */
function tickerHTML(c){
  const feat = commentsFor(c.id).slice().sort((a,b)=>likeCount(b)-likeCount(a)).slice(0,5);
  if(!feat.length) return "";
  return `<button class="tick" id="tickBox" data-jump="s-talk" aria-label="Featured comment. Opens the discussion.">
    <span class="tick-head">From the discussion<b data-ccount="${c.id}">0</b>comments</span>
    <span class="tick-view">${feat.map((cm,k)=>`
      <span class="tick-it ${k?"":"on"}" data-k="${k}">
        <span class="tick-who">${esc(cm.name)}${cm.team?'<i class="tag team">Legal team</i>':cm.backer?'<i class="tag">Backer</i>':""}${
          cm.stance?`<i class="tag st-${cm.stance}">${cm.stance==="skeptical"?"Sceptical":cm.stance==="question"?"Question":"Support"}</i>`:""}</span>
        <span class="tick-txt">${esc(cm.text)}</span></span>`).join("")}</span>
    <span class="tick-dots">${feat.map((_,k)=>`<i class="${k?"":"on"}"></i>`).join("")}</span>
  </button>`;
}

function whyHTML(c){
  const viz = w => w.kind==="dots" ? dotMatrix(w.value, w.of)
    : w.kind==="delta" ? `<span class="why-big">${esc(w.value)}</span>`
    : `<span class="why-big">${esc(w.value)}</span>`;
  return `<section class="sec" id="s-why">
    <h2 class="sec-h">Why you should care</h2>
    <div class="why">${c.why.map((w,i)=>`
      <div class="why-i reveal ${w.kind==="dots"?"is-dots":""}" style="--i:${i}">
        <div class="why-viz">${viz(w)}${w.kind==="dots"?`<span class="why-count">${w.value} of ${w.of}</span>`:""}</div>
        <div class="why-lab">${esc(w.label)}</div>
        <div class="why-note">${esc(w.note)}</div>
      </div>`).join("")}</div>
  </section>`;
}

function talkHTML(c){
  const p = pulseFor(c.id), cs = communityScore(c.id);
  return `<section class="sec" id="s-talk">
    <div class="sec-head"><h2 class="sec-h">Discussion</h2>
      <span class="sec-meta"><b data-ccount="${c.id}">0</b> comments</span></div>

    <div class="talkstats">
      <div class="pulsebox reveal">
        <div class="ph">Community pulse</div>
        <p class="psub">How <b data-ccount="${c.id}">0</b> comments break down.</p>
        ${pulseUnits(p)}
        <div class="pkey">
          <span class="pk st-support"><i></i><b>${p.supportPct}%</b> support<small>${num(p.support)}</small></span>
          <span class="pk st-question"><i></i><b>${p.questionPct}%</b> asking<small>${num(p.question)}</small></span>
          <span class="pk st-skeptical"><i></i><b>${p.skepticalPct}%</b> sceptical<small>${num(p.skeptical)}</small></span>
        </div>
      </div>
      <div class="csbox reveal">
        <div class="ph">Community Score</div>
        <p class="psub">What backers and readers rate it, out of five.</p>
        <div class="cs-main">
          <div class="cs-n"><b>${cs.avg}</b><span>/5</span></div>
          <div class="cs-side">${ratingDots(cs.avg)}
            <small>${num(cs.n)} ratings · ${cs.positive}% rated 4 or 5</small></div>
          <div class="cs-comb">${ratingComb(cs.counts)}<span class="cs-axis"><i>1</i><i>5</i></span></div>
        </div>
        <button class="btn ghost sm" id="rateBtn">${cs.mine?`You rated it ${cs.mine.stars}. Change`:"Rate this case"}</button>
      </div>
    </div>

    ${composerHTML(c.id)}
    <div data-comments="${c.id}"></div>
  </section>`;
}

function timeHTML(c){
  const done = STAGES[c.stageIdx];
  return `<section class="sec" id="s-time">
    <h2 class="sec-h">Where the case is, and how long it runs</h2>
    <div class="lockline reveal">${icons.lock}
      <div><span><b>Locked about ${lockYears(c)} years</b>, expected to end ${endYear(c)}</span>
      <small>No early withdrawals. A pledge stays in until the case resolves or is dropped.</small></div></div>
    <div class="rwbox reveal">${runway(c)}
      <p class="rw-cap" id="rwCap"><b>${esc(done)}</b> — tap any part of the rail to see what happens in it.</p></div>
    <ol class="tl">${c.timeline.map(([t,d,dn],i)=>{
      const clip = c.clips.findIndex(cl=>cl.milestone===i);
      return `<li class="${dn?"done":""}">${esc(t)}<small>${esc(d)}</small>${
        clip>=0?`<button class="tl-clip" data-clip="${clip}">${icons.playSm}${esc(c.clips[clip].title)}</button>`:""}</li>`;}).join("")}</ol>
  </section>`;
}

function returnHTML(c, amount=100){
  const o = outcomeFor(c, amount), net = Math.round(amount*(1-SPLIT.processingFee));
  return `<section class="sec" id="s-return">
    <div class="sec-head"><h2 class="sec-h">What a pledge could return</h2>
      <span class="sec-meta">Not a guarantee</span></div>
    <p class="sec-sub">Three ways this case can end. The thickness of each path is how likely it is; where it lands is what it pays. These are estimates, and they move as the case does.</p>
    <div class="amt-pick" role="group" aria-label="Pledge amount to model">${[25,100,250,1000].map(a=>
      `<button data-fa="${a}" aria-pressed="${a===amount}">$${num(a)}</button>`).join("")}</div>
    <div class="fanbox reveal" id="fanBox">${outcomeFan(c, amount)}</div>
    <p class="note">${esc(o.note)}</p>
    <h3 class="sub-h">Where an award goes</h3>
    <div class="splitbox reveal">${splitRibbon()}</div>
    <div class="worked">
      <span><b>$${num(amount)}</b> pledged</span>${icons.back}
      <span><b>$${num(net)}</b> works the case<small>${Math.round(SPLIT.processingFee*100)}% payment processing</small></span>${icons.back}
      <span><b>$${num(o.win)}</b> back if it wins<small>${o.win>amount?"+":""}${Math.round((o.win-amount)/amount*100)}% over ${lockYears(c)} years</small></span>
    </div>
    <p class="note small">Backers share 41% of any award in proportion to what they put in. Nobody is paid before the plaintiff. If the case loses, a pledge returns nothing.</p>
  </section>`;
}

function clipsHTML(c){
  const mm = i => (c.timeline[i] && c.timeline[i][0]) || "Case file";
  return `<section class="sec" id="s-clips">
    <div class="sec-head"><h2 class="sec-h">Clips</h2><span class="sec-meta">${c.clips.length} · 60 seconds or less</span></div>
    <div class="cliprail">${c.clips.map((cl,k)=>`
      <button class="clipcard" data-clip="${k}" style="--i:${k};--kb:${(k%4)+1}">
        <span class="cc-art">${artOf(c,k+3)}
          <span class="cc-play">${icons.playSm}</span>
          <span class="cc-time">${mmss(cl.secs)}</span></span>
        <span class="cc-t">${esc(cl.title)}</span>
        <span class="cc-m">${esc(mm(cl.milestone))}</span>
      </button>`).join("")}</div>
  </section>`;
}

function teamHTML(c){
  const p = c.people;
  const face = n => `<span class="av lg">${esc(n.trim().charAt(0).toUpperCase())}</span>`;
  return `<section class="sec" id="s-team">
    <h2 class="sec-h">Who is bringing this</h2>
    <div class="bios">
      <div class="bio reveal">${face(p.plaintiff.name)}
        <div><b>${esc(p.plaintiff.name)}</b><span class="bio-role">${esc(p.plaintiff.role)}</span>
        <p>${esc(p.plaintiff.bio)}</p></div></div>
      <div class="bio reveal">${face(p.attorney.name)}
        <div><b>${esc(p.attorney.name)}</b><span class="bio-role">${esc(p.attorney.role)}</span>
        <p>${esc(p.attorney.bio)}</p><span class="bio-stat">${esc(p.attorney.stat)}</span></div></div>
    </div>
    <div class="firm reveal" style="--cat:${CATS[c.cat].color}">
      <div class="firm-top"><span class="firm-mark">${esc(p.firm.name.trim().charAt(0))}</span>
        <div><b>${esc(p.firm.name)}</b><small>${esc(p.firm.kind)}</small></div>
        ${vettedBadge(c,"sm")}</div>
      <p>${esc(p.firm.bio)}</p>
      <div class="firm-stats">${p.firm.stats.map(([k,v])=>`<span><b>${esc(v)}</b><small>${esc(k)}</small></span>`).join("")}</div>
    </div>
  </section>`;
}

function detailHTML(c){
  const tot = c.budget.reduce((s,[,n])=>s+n,0);
  return `<section class="sec" id="s-detail">
    <h2 class="sec-h">The case in full</h2>
    <div class="prose">${c.summary.map(p=>`<p>${esc(p)}</p>`).join("")}</div>
    <dl class="facts">
      <div><dt>Defendant</dt><dd>${esc(c.defendant)}</dd></div>
      <div><dt>Court</dt><dd>${esc(c.court)}</dd></div>
      <div><dt>Judge</dt><dd>${esc(c.judge)}</dd></div>
      <div><dt>Filed as</dt><dd>${esc(c.caseName)}</dd></div>
    </dl>
    <h3 class="sub-h">What the money pays for</h3>
    <div class="budget reveal">
      <div class="bg-ribbon">${c.budget.map(([k,n],i)=>
        `<span class="bg-seg" style="--w:${(n/tot*100).toFixed(2)}%;--i:${i}" title="${esc(k)}"></span>`).join("")}</div>
      <div class="bg-rows">${c.budget.map(([k,n],i)=>
        `<div><span class="bg-dot" style="--i:${i}"></span><span>${esc(k)}</span><b>${usdShort(n)}</b></div>`).join("")}</div>
    </div>
    <h3 class="sub-h">Updates from the legal team</h3>
    ${c.updates.length ? c.updates.map(([d,t])=>`<div class="update"><b>${esc(d)}</b><p>${esc(t)}</p></div>`).join("")
      : `<p class="none">No updates yet. Backers see new filings and rulings here first.</p>`}
  </section>`;
}

let detailClip=null, tickT=null, secObs=null, heroScroll=null, fanAmount=100;
function openCase(id, jumpTo){
  const c = byId[id], v = $("#v-case");
  teardownCase();
  fanAmount = 100;

  v.innerHTML = heroHTML(c) + `
  <div class="cbody" style="--cat:${CATS[c.cat].color}">
    ${tickerHTML(c)}
    <aside class="crail">
      <div class="crail-fund">
        <div><span class="big" data-raised="${c.id}"></span> <span class="of">of ${usd(c.goal)}</span></div>
        <div class="lbar"><i data-pct="${c.id}"></i></div>
        <div class="lnums"><span data-pctlabel="${c.id}"></span><span data-backers="${c.id}"></span></div>
      </div>
      ${scoreHeadline(c)}
      <div class="crail-lock">${icons.lock}<span><b>Locked ~${lockYears(c)} years</b>, to ${endYear(c)}</span></div>
      <button class="btn primary fund-cta">Pledge to this case</button>
      <p class="crail-note">A pledge, not a payment. No money moves today.</p>
    </aside>
    <nav class="secnav" aria-label="Sections of this case">
      ${SECTIONS.map((s,i)=>`<button data-jump="${s[0]}" class="${i?"":"on"}">${s[1]}</button>`).join("")}
    </nav>
    <main class="csections">
      ${whyHTML(c)}${talkHTML(c)}${timeHTML(c)}${returnHTML(c, fanAmount)}${clipsHTML(c)}${teamHTML(c)}${detailHTML(c)}
    </main>
  </div>`;

  /* --- hero: real photograph on top of generated artwork. If the photo
     will not load, the artwork is already there and nothing breaks. --- */
  const bg = v.querySelector("#cheroBg");
  heroScroll = ()=>{ const y = v.scrollTop;
    if(y < 520) bg.style.transform = `translate3d(0,${(y*0.32).toFixed(1)}px,0) scale(${(1+y*0.0006).toFixed(3)})`; };
  if(!REDUCED) v.addEventListener("scroll", heroScroll, {passive:true});

  v.querySelector("#backBtn").addEventListener("click",()=>go(prevView||"cases"));
  v.querySelectorAll(".fund-cta").forEach(b=>b.addEventListener("click",()=>openPledge(c.id)));
  v.querySelectorAll("[data-score]").forEach(b=>b.addEventListener("click",()=>openScore(c.id, b.dataset.score)));
  v.querySelectorAll("[data-vetted]").forEach(b=>b.addEventListener("click",()=>openVetting(c)));
  v.querySelectorAll("[data-clip]").forEach(b=>b.addEventListener("click",()=>
    b.dataset.clip==="hero" ? openClipViewer(c, -1) : openClipViewer(c, +b.dataset.clip)));
  v.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>jump(b.dataset.jump)));
  const rate = v.querySelector("#rateBtn"); rate && rate.addEventListener("click",()=>openRate(c.id));

  /* --- the runway explains itself when you touch it --- */
  const cap = v.querySelector("#rwCap");
  v.querySelectorAll(".rw-seg").forEach(g=>{
    const say = ()=>{ const k = +g.dataset.k, m = c.stageMonths[k];
      const before = c.stageMonths.slice(0,k).reduce((a,b)=>a+b,0);
      v.querySelectorAll(".rw-seg").forEach(x=>x.classList.toggle("sel", x===g));
      cap.innerHTML = `<b>${esc(STAGES[k])}</b> — about ${m} months, around year ${Math.round(before/12)}–${Math.round((before+m)/12)}. ${
        k < c.stageIdx ? "Done." : k === c.stageIdx ? "Happening now." : "Still ahead."}`;
    };
    g.addEventListener("click", say); g.addEventListener("focus", say);
  });

  /* --- the returns fan follows the amount chips --- */
  v.querySelectorAll("[data-fa]").forEach(b=>b.addEventListener("click",()=>{
    fanAmount = +b.dataset.fa;
    v.querySelectorAll("[data-fa]").forEach(x=>x.setAttribute("aria-pressed", x===b));
    const sec = v.querySelector("#s-return");
    sec.outerHTML = returnHTML(c, fanAmount);
    rewireReturns(c, v);
  }));

  wireComposer(v, c.id);
  detailClip = null;
  armStickyCta(v);
  startTicker(v);
  wireSecNav(v);
  armReveals(v);
  $("#ctaBtn").onclick = ()=>openPledge(c.id);
  v.scrollTop = 0;
  go("case");
  refresh();
  if(jumpTo) requestAnimationFrame(()=>requestAnimationFrame(()=>jump(jumpTo)));
}

/* the returns section redraws itself when the amount changes, so its
   handlers have to be put back */
function rewireReturns(c, v){
  const sec = v.querySelector("#s-return");
  sec.querySelectorAll("[data-fa]").forEach(b=>b.addEventListener("click",()=>{
    fanAmount = +b.dataset.fa;
    sec.outerHTML = returnHTML(c, fanAmount);
    rewireReturns(c, v);
  }));
  sec.querySelectorAll(".reveal").forEach(el=>el.classList.add("in"));
  sec.scrollIntoView({block:"nearest"});
}

/* Two pledge buttons on one screen is one too many. The floating bar stays
   out of the way while the funding panel itself is in view, and takes over
   once it has scrolled away. */
let ctaObs = null;
function armStickyCta(v){
  if(ctaObs) ctaObs.disconnect();
  const anchor = v.querySelector(".crail");
  const cta = $("#cta");
  if(!anchor){ cta.classList.add("show"); return; }
  cta.classList.remove("show");
  ctaObs = new IntersectionObserver(es=>es.forEach(e=>
    cta.classList.toggle("show", !e.isIntersecting)), {root:v, threshold:0});
  ctaObs.observe(anchor);
}

function teardownCase(){
  if(ctaObs){ ctaObs.disconnect(); ctaObs=null; }
  $("#cta").classList.remove("show");
  if(detailClip){ clips.delete(detailClip); detailClip=null; }
  clearInterval(tickT); tickT=null;
  if(secObs){ secObs.disconnect(); secObs=null; }
  if(heroScroll){ $("#v-case").removeEventListener("scroll", heroScroll); heroScroll=null; }
}

function jump(sid){
  const el = $("#"+sid); if(!el) return;
  el.scrollIntoView({block:"start", behavior: REDUCED ? "auto" : "smooth"});
}

/* highlight the section chip you are actually looking at */
function wireSecNav(v){
  const chips = [...v.querySelectorAll(".secnav button")];
  secObs = new IntersectionObserver(es=>{
    es.forEach(e=>{
      if(!e.isIntersecting) return;
      chips.forEach(ch=>ch.classList.toggle("on", ch.dataset.jump===e.target.id));
      /* scroll the chip rail itself, never scrollIntoView: that would start a
         second smooth scroll on the page and cancel the one already running */
      const nav = v.querySelector(".secnav"), on = nav && nav.querySelector("button.on");
      if(on) nav.scrollTo({left: on.offsetLeft - nav.clientWidth/2 + on.offsetWidth/2,
                           behavior: REDUCED ? "auto" : "smooth"});
    });
  },{root:v, rootMargin:"-56px 0px -62% 0px", threshold:0});
  SECTIONS.forEach(([sid])=>{ const el = v.querySelector("#"+sid); el && secObs.observe(el); });
}

/* one featured comment at a time, a few seconds each */
function startTicker(v){
  const box = v.querySelector("#tickBox"); if(!box) return;
  const items = [...box.querySelectorAll(".tick-it")], dots = [...box.querySelectorAll(".tick-dots i")];
  if(items.length < 2 || REDUCED) return;
  let k = 0, paused = false;
  const step = ()=>{
    if(paused) return;
    items[k].classList.remove("on"); dots[k].classList.remove("on");
    items[k].classList.add("out");
    const prev = items[k];
    setTimeout(()=>prev.classList.remove("out"), 520);
    k = (k+1) % items.length;
    items[k].classList.add("on"); dots[k].classList.add("on");
  };
  tickT = setInterval(step, 5200);
  box.addEventListener("pointerenter", ()=>paused = true);
  box.addEventListener("pointerleave", ()=>paused = false);
  box.addEventListener("focus", ()=>paused = true);
  box.addEventListener("blur", ()=>paused = false);
}

/* =====================================================================
   score breakdown
   ---------------------------------------------------------------------
   Kept off the case page on purpose. The case page answers "how likely,
   how much does it matter"; this screen answers "says who", and the two
   questions do not want to share a screen.
   ===================================================================== */
let scoreCase = null;
function openScore(id, tab="merit"){
  const c = byId[id]; scoreCase = id;
  const v = $("#v-score"), m = meritScore(c), i = impactScore(c);
  v.innerHTML = `<div class="spage" style="--cat:${CATS[c.cat].color}">
    <div class="sp-top">
      <button class="back" id="spBack">${icons.back}Case</button>
      <span class="sp-eyebrow">How this case is scored</span>
      <h1>${esc(c.head)}</h1>
    </div>
    <div class="sp-tabs" role="tablist">
      <button role="tab" data-t="merit" aria-selected="${tab==="merit"}"><i class="sp-sw m"></i>Chance to win<b>${m}</b></button>
      <button role="tab" data-t="impact" aria-selected="${tab==="impact"}"><i class="sp-sw i"></i>Social impact<b>${i}</b></button>
    </div>

    <section class="sp-panel" id="sp-merit" ${tab==="merit"?"":"hidden"}>
      <p class="sp-lead">Start with how often cases like this one win. Then move the number for everything that makes this case different. Green adds, red takes away.</p>
      <div class="wfbox reveal">${waterfall(c)}</div>
      <div class="sp-note" id="wfNote"><b>Cases like this</b><span>${esc(c.merit.baseNote)}</span></div>
      <p class="sp-fine">Assumes the case is fully funded, and says nothing about how much the case matters — that is the impact score, which is computed separately and never mixed in.</p>
    </section>

    <section class="sp-panel" id="sp-impact" ${tab==="impact"?"":"hidden"}>
      <p class="sp-lead">The circle is the most a case could matter. Each petal is one factor: <b>how wide</b> it is, is how much that factor counts; <b>how far it reaches</b>, is how this case scored on it. The share of the circle that fills in is the score.</p>
      <div class="bloomwrap">
        <div class="bloombox reveal">${bloom(c)}<div class="bl-score"><b>${i}</b><small>of 100</small></div></div>
        ${bloomLegend(c)}
      </div>
      <div class="sp-note" id="blNote"><b>Tap a petal</b><span>Each one explains what it measured and why it scored the way it did.</span></div>
    </section>
  </div>`;

  v.querySelector("#spBack").addEventListener("click",()=>go("case"));
  v.querySelectorAll("[role=tab]").forEach(t=>t.addEventListener("click",()=>{
    v.querySelectorAll("[role=tab]").forEach(x=>x.setAttribute("aria-selected", x===t));
    $("#sp-merit").hidden = t.dataset.t!=="merit";
    $("#sp-impact").hidden = t.dataset.t!=="impact";
    armReveals(v);
  }));

  const wfNote = v.querySelector("#wfNote");
  v.querySelectorAll(".wf-row").forEach(g=>{
    const say = ()=>{
      v.querySelectorAll(".wf-row").forEach(x=>x.classList.toggle("sel", x===g));
      const lab = g.querySelector(".wf-lab").textContent;
      wfNote.innerHTML = `<b>${esc(lab)}</b><span>${esc(g.dataset.note)}</span>`;
    };
    g.addEventListener("click", say); g.addEventListener("focus", say);
  });

  const blNote = v.querySelector("#blNote");
  const pick = i2 => {
    v.querySelectorAll(".bl-petal").forEach((x,k)=>x.classList.toggle("sel", k===i2));
    v.querySelectorAll(".bl-li").forEach((x,k)=>x.classList.toggle("sel", k===i2));
    const f = c.impact.factors[i2];
    blNote.innerHTML = `<b>${esc(f.label)}</b><span>${esc(f.note)}</span>
      <em>Weight ${Math.round(f.weight*100)}% · scored ${f.score} of 100 · contributes ${(f.weight*f.score).toFixed(1)} points</em>`;
  };
  v.querySelectorAll(".bl-petal").forEach((p,k)=>{ p.addEventListener("click",()=>pick(k)); p.addEventListener("focus",()=>pick(k)); });
  v.querySelectorAll(".bl-li").forEach((p,k)=>{ p.addEventListener("click",()=>pick(k)); p.addEventListener("focus",()=>pick(k)); });

  armReveals(v);
  v.scrollTop = 0;
  go("score");
}

/* ============ discussion ============
   Nobody is asked to tag their own comment. The seeded threads carry a stance
   because they are written content, and the community pulse reads those; a
   comment written here is left untagged until the stance is derived from the
   text itself. */
function composerHTML(id){
  return `<div class="composer">
    <textarea rows="2" maxlength="600" placeholder="What do you make of this case?" aria-label="Write a comment"></textarea>
    <div class="composer-foot">
      <button class="btn ghost" data-post="${id}">Post</button>
    </div>
    <div class="err" data-cerr></div>
  </div>`;
}
function wireComposer(root, id){
  const ta = root.querySelector(".composer textarea"), btn = root.querySelector("[data-post]"), err = root.querySelector("[data-cerr]");
  if(!ta) return;
  btn.addEventListener("click", async ()=>{
    const text = ta.value.trim();
    if(!text){ err.textContent="Write something before posting."; return; }
    const name = getName();
    if(!name){ openNameThen(()=>btn.click()); return; }
    btn.disabled=true; err.textContent="";
    try{
      await addComment({caseId:id, name, text, createdAt:Date.now(), backer: backedByMe(id), likes:{}});
      ta.value=""; toast("Comment posted");
    }catch(e){ err.textContent = "Couldn't post. Check your connection and try again."; }
    btn.disabled=false;
  });
}

const SHOWN = {};   /* how many comments are expanded, per case */
function renderComments(el, id){
  const list = commentsFor(id);
  const n = SHOWN[id] || 6;
  const face = (name, avatar) => avatar
    ? `<img class="av av-img" src="${esc(avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy">`
    : `<div class="av">${esc((name||"?").trim().charAt(0).toUpperCase())}</div>`;
  const stanceTag = s => s ? `<i class="tag st-${s}">${s==="skeptical"?"Sceptical":s==="question"?"Question":"Support"}</i>` : "";

  el.innerHTML = list.slice(0,n).map(cm=>{
    const mine = likedByMe(cm);
    return `<article class="cmt">${face(cm.name, cm.avatar)}<div class="cmt-b">
      <div class="top"><b>${esc(cm.name)}</b>${cm.team?'<i class="tag team">Legal team</i>':cm.backer?'<i class="tag">Backer</i>':""}${stanceTag(cm.stance)}<span>${ago(cm.createdAt)}</span></div>
      ${cm.role?`<div class="cmt-role">${esc(cm.role)}</div>`:""}
      <p>${esc(cm.text)}</p>
      <button class="like" data-like="${esc(cm.id)}" aria-pressed="${!!mine}">${mine?icons.heartFill:icons.heart}Stand with this <span>${num(likeCount(cm))||""}</span></button>
      ${(cm.replies||[]).map(r=>`<div class="reply">${face(r.name)}<div class="cmt-b">
        <div class="top"><b>${esc(r.name)}</b>${r.team?'<i class="tag team">Legal team</i>':""}<span>${ago(r.createdAt)}</span></div>
        ${r.role?`<div class="cmt-role">${esc(r.role)}</div>`:""}
        <p>${esc(r.text)}</p></div></div>`).join("")}
    </div></article>`;
  }).join("") || `<div class="empty" style="padding:24px 0">Start the conversation. Share why this case matters to you.</div>`;

  if(list.length > n) el.insertAdjacentHTML("beforeend",
    `<button class="showmore" data-more="${id}">Show more of the discussion <small>${num(commentTotal(id)-n)} more</small></button>`);

  el.querySelectorAll("[data-like]").forEach(b=>b.addEventListener("click",()=>{
    const cm = list.find(x=>x.id===b.dataset.like) || store.comments.find(x=>x.id===b.dataset.like);
    if(cm) toggleLike(cm).catch(()=>toast("Couldn't save that. Try again."));
  }));
  const more = el.querySelector("[data-more]");
  more && more.addEventListener("click",()=>{ SHOWN[id] = n + 6; renderComments(el, id); });
}

/* ============ sheets ============ */
const sheet=$("#sheet"), scrim=$("#scrim"); let sheetOpen=false, lastFocus=null, sheetClip=null;
function openSheet(html, cls=""){
  lastFocus=document.activeElement; sheet.className="sheet "+cls;
  sheet.innerHTML='<div class="grip"></div>'+html;
  sheet.classList.add("on"); scrim.classList.add("on"); sheetOpen=true; feedPlay(false);
  setTimeout(()=>{ const f=sheet.querySelector("input,textarea,button"); f&&f.focus(); },250);
}
function closeSheet(){
  sheet.classList.remove("on"); scrim.classList.remove("on"); sheetOpen=false;
  if(sheetClip){ clips.delete(sheetClip); sheetClip=null; }
  if(current==="watch") feedPlay(true);
  lastFocus && lastFocus.focus && lastFocus.focus();
}
scrim.addEventListener("click",closeSheet);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && sheetOpen){ closeSheet(); return; }
  if(sheetOpen || current!=="watch") return;
  const tag = (e.target.tagName||"").toLowerCase();
  if(tag==="input" || tag==="textarea") return;
  if(e.key==="ArrowDown" || e.key==="ArrowUp"){ e.preventDefault(); stepFeed(e.key==="ArrowDown"?1:-1); }
});

const getName = ()=> signedIn()
  ? ((auth.profile && auth.profile.display_name) || myEmail().split("@")[0] || "")
  : (ls("lj_name")||"").trim();
const rememberName = n => { if(!signedIn()) ls("lj_name", n); };

function openNameThen(cb){
  openSheet(`<h2 id="sheetTitle">What should we call you?</h2><p class="sub">No account needed. Your name shows next to your comments.</p>
    <input class="inp" id="nm" maxlength="40" autocomplete="name" placeholder="Your name">
    ${sb?`<p class="hint">Or <button class="link" data-auth="in">sign in</button> instead.</p>`:""}
    <div class="err" id="nmErr"></div><button class="btn primary" id="nmGo" style="margin-top:8px">Continue</button>`);
  $("#nmGo").onclick=()=>{ const n=$("#nm").value.trim(); if(!n){ $("#nmErr").textContent="Enter a name to continue."; return; } rememberName(n); closeSheet(); cb(); };
}

/* the clip viewer: the same player as the feed, in a 9:16 window */
function openClipViewer(c, k){
  const src = k<0 ? caseClip(c) : shortClip(c, k);
  const title = k<0 ? "The case in 60 seconds" : c.clips[k].title;
  const milestone = k<0 ? "" : (c.timeline[c.clips[k].milestone]||[])[0] || "";
  openSheet(`<div class="cv">
    <div class="cv-head"><b>${esc(title)}</b>${milestone?`<small>${esc(milestone)}</small>`:""}</div>
    <div class="cv-frame reel">${clipHTML(src)}</div>
    <div class="cv-foot">
      <button class="btn ghost sm" id="cvPledge">Pledge</button>
      <div class="cv-strip">${c.clips.map((cl,i)=>`<button class="${i===k?"on":""}" data-cv="${i}" aria-label="${esc(cl.title)}"></button>`).join("")}</div>
    </div></div>`, "wide");
  const frame = sheet.querySelector(".cv-frame");
  sheetClip = new Clip(frame, src); clips.add(sheetClip); sheetClip.play();
  sheet.querySelectorAll("[data-cv]").forEach(b=>b.addEventListener("click",()=>openClipViewer(c, +b.dataset.cv)));
  $("#cvPledge").addEventListener("click",()=>{ closeSheet(); openPledge(c.id); });
}

/* what the vetted badge opens */
function openVetting(c){
  openSheet(`<h2 id="sheetTitle">${icons.shield} Vetted by LaunchJustice</h2>
    <p class="sub">Checked on ${esc(c.vetted)} before this case was listed. Every case on the platform passes the same five.</p>
    <ol class="vet">${VETTING.map(([t,d])=>`<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("")}</ol>
    <div class="notice">Vetting is a check on the people and the paperwork. It is not an opinion on whether the case will win — that is what the chance-to-win score is for.</div>
    <button class="btn primary" id="vetClose">Got it</button>`);
  $("#vetClose").onclick = closeSheet;
}

/* the community score, from the visitor's side */
function openRate(id){
  const c = byId[id], cs = communityScore(id);
  let stars = cs.mine ? cs.mine.stars : 0;
  openSheet(`<h2 id="sheetTitle">Rate this case</h2>
    <p class="sub">${esc(c.head)}</p>
    <div class="ratebox">${ratingDots(stars, true)}<span class="rate-word" id="rw">${["","Not for me","Has problems","Worth watching","Strong case","Back it now"][stars]||"Tap to rate"}</span></div>
    <label class="f" for="rvw">Add a short review <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
    <textarea class="inp" id="rvw" rows="3" maxlength="400" placeholder="What made it a ${stars||4} for you?">${esc(cs.mine?cs.mine.text||"":"")}</textarea>
    <div class="notice">Ratings combine into the Community Score, the same way a review site works.</div>
    <div class="err" id="rErr"></div>
    <button class="btn primary" id="rGo">Submit rating</button>`);
  const words = ["","Not for me","Has problems","Worth watching","Strong case","Back it now"];
  sheet.querySelectorAll("[data-r]").forEach(b=>b.addEventListener("click",()=>{
    stars = +b.dataset.r;
    sheet.querySelectorAll("[data-r]").forEach(x=>{ const on = +x.dataset.r <= stars;
      x.setAttribute("aria-checked", +x.dataset.r===stars); x.querySelector("i").className = on?"on":""; });
    $("#rw").textContent = words[stars];
  }));
  $("#rGo").addEventListener("click", async ()=>{
    if(!stars){ $("#rErr").textContent = "Pick a rating from one to five."; return; }
    const text = $("#rvw").value.trim();
    const m = myRatings(); m[id] = {stars, text}; lsJson("lj_rating", m);
    if(text){
      const name = getName() || "Backer";
      try{ await addComment({caseId:id, name, text:`Rated ${stars}/5. ${text}`,
                             createdAt:Date.now(), backer: backedByMe(id), likes:{}}); }catch(e){}
    }
    closeSheet(); toast("Rating saved");
    if(current==="case") openCase(id, "s-talk"); else refresh();
  });
}

/* how the money splits, opened from the pledge sheet */
function openSplit(c){
  const o = outcomeFor(c, 100);
  openSheet(`<h2 id="sheetTitle">Where the money goes</h2>
    <p class="sub">The same split on every case.</p>
    <div class="splitbox in">${splitRibbon()}</div>
    <ul class="splitlist">
      <li><b>53%</b> to the plaintiff. They carry the case and the risk.</li>
      <li><b>6%</b> to LaunchJustice — a 5% platform fee and a 1% contingent return, paid only when a case wins.</li>
      <li><b>41%</b> to backers, split in proportion to what each person put in.</li>
    </ul>
    <div class="notice">About 3% of every pledge goes to payment processing before it reaches the case. On this case a $100 pledge would return roughly $${num(o.win)} on a win, nothing on a loss, and about $${num(o.settle)} on a typical settlement.</div>
    <button class="btn primary" id="spClose">Close</button>`);
  $("#spClose").onclick = closeSheet;
}

/* ============ pledge ============
   The lock-in and the three outcomes are in the flow, not in a footnote,
   and they update as the amount does. Nobody should reach the confirm
   button without having seen how long the money is in for and what happens
   if the case loses. */
function outcomeStrip(c, amt){
  const o = outcomeFor(c, amt);
  const rows = [["win","Case won",o.win,o.p.win],["settle","Settled",o.settle,o.p.settle],["lose","Case lost",o.lose,o.p.lose]];
  return `<div class="ostrip">${rows.map(([k,l,v,p])=>`
    <div class="os os-${k}"><span class="os-bar" style="--p:${Math.round(p*100)}%"></span>
      <span class="os-l">${l}</span><span class="os-p">${Math.round(p*100)}%</span>
      <b class="os-v">${v?"$"+num(v):"$0"}</b></div>`).join("")}</div>`;
}
function openPledge(id){
  const c = byId[id]; let amt = 100;
  openSheet(`<h2 id="sheetTitle">Pledge to this case</h2>
  <p class="sub">${esc(c.head)}</p>
  <div class="lockstrip">${icons.lock}<span><b>Locked about ${lockYears(c)} years</b>, expected to end ${endYear(c)}. No early withdrawals.</span></div>
  <label class="f" for="pName">Your name</label>
  <input class="inp" id="pName" maxlength="40" autocomplete="name" value="${esc(getName())}" placeholder="First and last name">
  ${signedIn()?"":`<p class="hint">Pledging as a guest. <button class="link" data-auth="in">Sign in</button> and your pledges follow you to any device.</p>`}
  <label class="f" id="amtLbl">Amount</label>
  <div class="amts" role="group" aria-labelledby="amtLbl">${[25,50,100,250].map(a=>`<button data-a="${a}" aria-pressed="${a===amt}">$${a}</button>`).join("")}</div>
  <div class="money" style="margin-top:8px"><span>$</span><input class="inp" id="pAmt" inputmode="numeric" placeholder="Other amount" aria-label="Other amount"></div>
  <div class="f" style="margin-bottom:8px">If the case ends&hellip; <button class="link sm" id="pSplit">how the split works</button></div>
  <div id="pOut">${outcomeStrip(c, amt)}</div>
  <p class="hint">Returns are never guaranteed, and a loss returns nothing.</p>
  <label class="f" for="pNote">Message to the legal team <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
  <textarea class="inp" id="pNote" rows="2" maxlength="280" placeholder="Why you're backing this case"></textarea>
  <label class="check"><input type="checkbox" id="pPublic" checked> Show my name to other backers</label>
  <div class="notice">This is a pledge, not a payment. No money moves today. We'll contact you when payments open.</div>
  <div class="err" id="pErr"></div>
  <button class="btn primary" id="pGo">Pledge $100</button>`);
  const goBtn=$("#pGo"), other=$("#pAmt"), outBox=$("#pOut");
  const setAmt = a => {
    amt = a;
    goBtn.textContent = a>0 ? `Pledge ${usd(a)}` : "Pledge";
    outBox.innerHTML = outcomeStrip(c, Math.max(1, a));
  };
  $("#pSplit").addEventListener("click",()=>openSplit(c));
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
    rememberName(name); goBtn.disabled=true; err.textContent="";
    const pub = $("#pPublic").checked;
    try{
      await addPledge({caseId:id, name, displayName: pub?name:"Anonymous backer", amount:amt, note:$("#pNote").value.trim(), createdAt:Date.now()});
      pledgeDone(c, amt);
    }catch(e){
      goBtn.disabled=false;
      err.textContent = "Couldn't record the pledge. Check your connection and try again.";
    }
  });
}
function pledgeDone(c, amt){
  const o = outcomeFor(c, amt);
  sheet.innerHTML = `<div class="grip"></div><div class="center">
    <div class="done-mark">${icons.check}</div>
    <h2 id="sheetTitle">Pledge recorded</h2>
    <p class="sub" style="margin-top:6px">You pledged ${usd(amt)} to ${esc(c.ngo)}. No money has moved. We'll reach out when payments open.</p>
    <div class="done-facts">
      <span><b>${lockYears(c)}y</b><small>locked, to ${endYear(c)}</small></span>
      <span><b>$${num(o.win)}</b><small>if the case wins</small></span>
      <span><b>${Math.round(o.p.lose*100)}%</b><small>chance it returns nothing</small></span>
    </div>
    <button class="btn primary" id="dDisc">Join the discussion</button>
    <button class="btn ghost" id="dClose" style="width:100%;margin-top:8px">Keep watching</button></div>`;
  $("#dDisc").onclick=()=>{ closeSheet(); openCase(c.id, "s-talk"); };
  $("#dClose").onclick=()=>{ closeSheet(); };
  $("#dDisc").focus();
}

/* ============ account UI ============
   Two entry points, one renderer: a block at the foot of the laptop sidebar,
   and a card in My pledges for the sizes that have no sidebar. */
function accountHTML(){
  if(!sb) return `<div class="acct"><p class="acct-note">${
    (!auth.ready && CFG.SUPABASE_URL) ? "Connecting&hellip;" : "Accounts need Supabase. See the README."
  }</p></div>`;
  if(signedIn()){
    const n = getName(), a = myAvatar();
    return `<div class="acct in">
      <div class="who">
        ${a?`<img class="av av-img" src="${esc(a)}" alt="" referrerpolicy="no-referrer">`
           :`<div class="av">${esc((n||"?").trim().charAt(0).toUpperCase())}</div>`}
        <div class="nm"><b>${esc(n)}</b><small>${esc(myEmail())}</small></div>
      </div>
      <button class="btn ghost sm" data-auth="out">${icons.signout}Sign out</button>
    </div>`;
  }
  return `<div class="acct">
    <p class="acct-note">Sign in and your pledges follow you to any device.</p>
    <div class="acct-btns">
      <button class="btn primary sm" data-auth="up">Create account</button>
      <button class="btn ghost sm" data-auth="in">Sign in</button>
    </div>
  </div>`;
}
function renderAccount(){
  document.querySelectorAll("[data-account]").forEach(el=>{ el.innerHTML = accountHTML(); });
}
/* one delegated handler covers every [data-auth] button, wherever it is drawn */
document.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest("[data-auth]");
  if(!b) return;
  const m = b.dataset.auth;
  if(m === "out") signOut(); else openAuth(m);
});

async function signOut(){
  try{ await sb.auth.signOut(); }
  catch(err){ toast("Couldn't sign out. Try again."); }
}

/* Supabase speaks in API errors; people need sentences. */
function authMessage(err, mode){
  const m = (err && err.message || "").toLowerCase();
  if(m.includes("invalid login credentials")) return "That email and password don't match an account.";
  if(m.includes("already registered") || m.includes("already been registered")) return "That email already has an account. Sign in instead.";
  if(m.includes("email not confirmed")) return "Confirm your email address first, then sign in.";
  if(m.includes("password should be")) return "Pick a longer password.";
  if(m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if(m.includes("provider is not enabled")) return "Google sign-in isn't switched on for this project yet.";
  if(m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the server. Check your connection.";
  return (mode === "up" ? "Couldn't create the account. " : "Couldn't sign in. ") + (err && err.message ? err.message : "Try again.");
}

function openAuth(mode, initialError){
  if(!sb){ toast("Add your Supabase keys to config.js to enable accounts"); return; }
  const up = mode === "up";
  /* The button is drawn only when the provider is actually enabled on the
     Supabase project: see GOOGLE_SIGN_IN in config.js. */
  const googleOn = !!CFG.GOOGLE_SIGN_IN;
  openSheet(`
    <h2 id="sheetTitle">${up?"Create your account":"Sign in"}</h2>
    <p class="sub">${up?"So your pledges and comments follow you to any device."
                      :"Welcome back."}</p>
    ${googleOn?`<button class="btn google" id="gGo">${icons.google}Continue with Google</button>
    <div class="or"><span>or</span></div>`:""}
    <form id="authForm" novalidate>
      ${up?`<label class="f" for="aName">Your name</label>
      <input class="inp" id="aName" maxlength="40" autocomplete="name" placeholder="First and last name">`:""}
      <label class="f" for="aEmail">Email</label>
      <input class="inp" id="aEmail" type="email" autocomplete="email" placeholder="you@example.com">
      <label class="f" for="aPass">Password</label>
      <input class="inp" id="aPass" type="password" autocomplete="${up?"new-password":"current-password"}" placeholder="${up?"At least 8 characters":"Your password"}">
      <div class="err" id="aErr"></div>
      <button class="btn primary" id="aGo" type="submit">${up?"Create account":"Sign in"}</button>
    </form>
    <p class="swap">${up?`Already have an account? <button class="link" id="aSwap">Sign in</button>`
                       :`New here? <button class="link" id="aSwap">Create an account</button>`}</p>`);

  const err = $("#aErr"), go = $("#aGo");
  if(initialError) err.textContent = initialError;
  $("#aSwap").addEventListener("click", ()=>openAuth(up?"in":"up"));

  if(googleOn) $("#gGo").addEventListener("click", async ()=>{
    err.textContent = "";
    try{
      const {error} = await sb.auth.signInWithOAuth({
        provider:"google",
        options:{ redirectTo: location.origin + location.pathname }
      });
      if(error) throw error;   /* on success the browser leaves for Google */
    }catch(e){ err.textContent = authMessage(e, mode); }
  });

  $("#authForm").addEventListener("submit", async ev=>{
    ev.preventDefault();
    const email = $("#aEmail").value.trim();
    const pass  = $("#aPass").value;
    const name  = up ? $("#aName").value.trim() : "";
    if(up && !name){ err.textContent = "Enter your name so backers know who you are."; return; }
    if(!email || !email.includes("@")){ err.textContent = "Enter a valid email address."; return; }
    if(!pass || (up && pass.length < 8)){ err.textContent = up ? "Use a password of at least 8 characters." : "Enter your password."; return; }

    go.disabled = true; err.textContent = "";
    try{
      if(up){
        const {data, error} = await sb.auth.signUp({
          email, password:pass,
          options:{ data:{ display_name:name }, emailRedirectTo: location.origin + location.pathname }
        });
        if(error) throw error;
        /* Signing up with an address that already has an account does not
           error: Supabase answers 200 and sends nothing, so it cannot be used
           to discover who has registered. It gives itself away by returning a
           user with no identities. Saying so beats a "check your email" screen
           for an email that will never arrive. */
        if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
          err.textContent = "That email already has an account. Sign in instead.";
          go.disabled = false;
          return;
        }
        /* With "Confirm email" on, Supabase returns a user but no session. */
        if(data.session) closeSheet(); else checkEmail(email);
      } else {
        const {error} = await sb.auth.signInWithPassword({email, password:pass});
        if(error) throw error;
        closeSheet();
      }
    }catch(e){
      err.textContent = authMessage(e, mode);
      go.disabled = false;
    }
  });
}

function checkEmail(email){
  sheet.innerHTML = `<div class="grip"></div><div class="center">
    <div class="done-mark">${icons.check}</div>
    <h2 id="sheetTitle">Confirm your email</h2>
    <p class="sub" style="margin-top:6px">We sent a link to <b>${esc(email)}</b>. Open it and you'll be signed in.
    The link works once and expires, so use the newest one.</p>
    <div class="err" id="ceErr"></div>
    <button class="btn primary" id="ceAgain">Send it again</button>
    <button class="btn ghost" id="ceClose" style="width:100%;margin-top:8px">Close</button></div>`;
  const again = $("#ceAgain"), ceErr = $("#ceErr");
  again.onclick = async ()=>{
    again.disabled = true; ceErr.textContent = "";
    try{
      const {error} = await sb.auth.resend({
        type:"signup", email,
        options:{ emailRedirectTo: location.origin + location.pathname }
      });
      if(error) throw error;
      toast("Sent another link to "+email);
    }catch(e){
      ceErr.textContent = authMessage(e, "up");
    }
    /* always usable again: if the second mail does not arrive either, asking
       once more is the only move the person has */
    again.disabled = false;
  };
  $("#ceClose").onclick = closeSheet;
  $("#ceClose").focus();
}

/* ============ my pledges ============ */
function renderMine(){
  const v=$("#v-mine"); const actors = myActors();
  const mine = store.pledges.filter(p=>actors.includes(p.actorId)).sort((a,b)=>b.createdAt-a.createdAt);
  const total = mine.reduce((s,p)=>s+(+p.amount||0),0);
  const cases = [...new Set(mine.map(p=>p.caseId))].filter(id=>byId[id]);
  /* what the whole portfolio would return if every case went each way */
  const proj = mine.reduce((acc,p)=>{ const c=byId[p.caseId]; if(!c) return acc;
    const o = outcomeFor(c, +p.amount||0);
    acc.win += o.win; acc.settle += o.settle;
    acc.exp += o.win*o.p.win + o.settle*o.p.settle;
    return acc; }, {win:0, settle:0, exp:0});
  const longest = cases.length ? Math.max(...cases.map(id=>endYear(byId[id]))) : null;

  v.innerHTML = `<div class="head"><h1>My pledges</h1><p>${getName()?`Pledging as ${esc(getName())}`:"Pledges you make appear here."}</p></div>
  <div class="list">
    <div class="acct-card" data-account></div>
    ${mine.length?`
    <div class="port">
      <div class="port-row"><span><small>Total pledged</small><b>${usd(total)}</b></span>
        <span><small>Cases backed</small><b>${cases.length}</b></span>
        <span><small>Locked until</small><b>${longest||"—"}</b></span></div>
      <div class="port-proj">
        <div class="pp pp-win"><small>If all won</small><b>${usd(proj.win)}</b></div>
        <div class="pp pp-set"><small>If all settled</small><b>${usd(proj.settle)}</b></div>
        <div class="pp pp-lose"><small>If all lost</small><b>$0</b></div>
      </div>
      <p class="port-note">Outcomes are estimates, never a promise, and no money has moved.</p>
    </div>`:""}
    <div class="live" style="margin:4px 0 10px"><i></i><span></span></div>
    ${mine.length? mine.map(p=>{ const c=byId[p.caseId]; if(!c) return ""; const o=outcomeFor(c,+p.amount||0);
      return `<button class="prow" data-id="${c.id}">
        <div><div class="t">${esc(c.head)}</div><small>${esc(c.ngo)} · ${agoText(p.createdAt)} · locked to ${endYear(c)}</small></div>
        <div class="prow-r"><b>${usd(p.amount)}</b><small>$${num(o.win)} if won</small></div></button>`; }).join("")
    : `<div class="empty">You haven't pledged yet. Watch a few clips and back a case you believe in.<br><br><button class="btn primary" style="width:auto" id="goWatch">Watch cases</button></div>`}
  </div>`;
  v.querySelectorAll(".prow").forEach(b=>b.addEventListener("click",()=>openCase(b.dataset.id)));
  const gw=v.querySelector("#goWatch"); gw && gw.addEventListener("click",()=>go("watch"));
  v.querySelectorAll(".live").forEach(el=>{ el.classList.toggle("on",store.live); el.lastChild.textContent = store.live?"Shared with all backers":"Saved on this device only"; });
  renderAccount();
}

/* ============ navigation ============ */
let current="watch", prevView=null;
function go(view){
  /* the score breakdown always belongs to the case behind it */
  if(view!=="case" && view!=="score" && current!=="case" && current!=="score") prevView=null;
  if(view==="case" && current!=="case" && current!=="score") prevView=current;
  if(view==="case" && current==="score" && scoreCase) { /* coming back from the breakdown */ }
  current=view;
  $$(".view").forEach(v=>v.classList.toggle("on", v.id==="v-"+view));
  const nav=$("#nav"); nav.classList.toggle("dark", view==="watch");
  nav.querySelectorAll("button").forEach(b=>{
    const on = b.dataset.go===view || ((view==="case"||view==="score") && b.dataset.go===prevView);
    on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"); });
  $("#cta").classList.toggle("on", view==="case");
  feedPlay(view==="watch" && !sheetOpen);
  if(view!=="cases") clearInterval(liveT);
  if(view==="cases"){ if(!$("#caseList")) renderCases(); else startLiveTicker(); }
  if(view==="mine") renderMine();
  if(view!=="case" && view!=="score") teardownCase();
}
$("#nav").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

renderFeed(); renderCases(); go("watch"); refresh(); renderAccount();
initDb();
