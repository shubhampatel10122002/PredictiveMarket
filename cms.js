/* =====================================================================
   LaunchJustice content
   ---------------------------------------------------------------------
   Cases can live in two places: data.js, which is the demo shipped with the
   code, and the `cases` table, which is what /admin writes. This file is the
   seam between them, and it is loaded by both the site and the admin.

   A row in `cases` holds a case in exactly the shape of a CASES entry, so
   the app never has to know where a case came from. Its status decides
   what happens on the site:

     published  shown on the site; replaces the demo case with the same id
     hidden     taken off the site, including a demo case with that id
     draft      admin only

   On the site this file is loaded as <script src="cms.js" data-boot="app.js">.
   It asks Supabase for the live rows, folds them into CASES, and only then
   loads app.js, because app.js reads CASES once, as it starts. If Supabase
   is slow or down the site starts on the demo data after a short wait
   rather than not at all.
   ===================================================================== */

const LJ_CMS = (() => {
  const STD_MERIT  = ["Claim type","Jurisdiction","Judge","Attorney record","Defendant","Evidence strength","Supporting cases","Merits"];
  const STD_IMPACT = [["People affected",.28],["Severity of harm",.24],["Lasting change",.22],["Public attention",.14],["Community support",.12]];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* Everything a case needs for every screen to draw. A new case starts as
     this, and a row from the database is filled out to this shape, so a
     half-written case is sparse rather than broken. */
  function blankCase(id){
    const now = new Date(), y = now.getFullYear();
    return {
      id: id || "", cat: Object.keys(CATS)[0],
      head: "", title: "", caseName: "",
      ngo: "", defendant: "", court: "", judge: "Not yet assigned",
      goal: 500000, baseRaised: 0, baseBackers: 0, watching: 0,
      vetted: now.getDate()+" "+MONTHS[now.getMonth()]+" "+y,
      hero: {src: "", credit: ""},
      video: "", embed: "", poster: "", heroLead: false,
      trending: null,
      beats: [],
      merit: {base: 40, baseNote: "", factors: STD_MERIT.map(label => ({label, delta: 0, note: ""}))},
      impact: {factors: STD_IMPACT.map(([label, weight]) => ({label, weight, score: 50, note: ""}))},
      start: MONTHS[now.getMonth()]+" "+y, startYear: y, stageIdx: 0, stageMonths: [6,8,12,6,6,12],
      outcomes: {win: .3, settle: .4, lose: .3, awardMult: 2.5, settleShare: .5, note: ""},
      why: [],
      clips: [],
      people: {
        plaintiff: {name: "", role: "Named plaintiff", bio: ""},
        attorney: {name: "", role: "Lead counsel", bio: "", stat: ""},
        firm: {name: "", kind: "", bio: "", stats: []}
      },
      rating: {counts: [0,0,0,0,0]},
      summary: [], budget: [], timeline: [], updates: []
    };
  }

  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const n = (v, d=0) => { const x = +v; return Number.isFinite(x) ? x : d; };
  const s = v => v == null ? "" : String(v);
  const arr = v => Array.isArray(v) ? v : [];

  /* fill anything missing from the template, recursively, without touching
     what is there */
  function fill(t, d){
    for(const k of Object.keys(d)){
      if(t[k] === undefined) t[k] = structuredClone(d[k]);
      else if(isObj(d[k]) && isObj(t[k])) fill(t[k], d[k]);
      else if(Array.isArray(d[k]) && !Array.isArray(t[k])) t[k] = structuredClone(d[k]);
    }
    return t;
  }

  /* A case exactly as the app expects it. Used on every row read from the
     database, and on every save from the admin. */
  function normalize(raw){
    const c = fill(structuredClone(isObj(raw) ? raw : {}), blankCase(raw && raw.id));
    if(!CATS[c.cat]) c.cat = Object.keys(CATS)[0];
    ["goal","baseRaised","baseBackers","watching","startYear"].forEach(k => c[k] = n(c[k]));
    if(c.goal <= 0) c.goal = 1;
    c.hero = isObj(c.hero) && s(c.hero.src) ? {src: s(c.hero.src), credit: s(c.hero.credit)} : null;
    ["video","embed","poster"].forEach(k => { if(!s(c[k])) delete c[k]; });
    if(!isObj(c.trending) || !s(c.trending.reason)) c.trending = null;
    c.beats = arr(c.beats).map(s).filter(Boolean);
    c.merit.base = n(c.merit.base, 40);
    c.merit.factors = arr(c.merit.factors).map(f => ({label: s(f.label), delta: n(f.delta), note: s(f.note)}));
    c.impact.factors = arr(c.impact.factors).map(f => ({label: s(f.label), weight: n(f.weight), score: n(f.score), note: s(f.note)}));
    c.stageMonths = STAGES.map((_, i) => Math.max(1, n(arr(c.stageMonths)[i], 6)));
    c.stageIdx = Math.max(0, Math.min(STAGES.length-1, Math.round(n(c.stageIdx))));
    ["win","settle","lose","awardMult","settleShare"].forEach(k => c.outcomes[k] = n(c.outcomes[k]));
    c.why = arr(c.why).filter(isObj);
    c.clips = arr(c.clips).filter(isObj).map((cl, k) => {
      const out = {...cl, id: s(cl.id) || "c"+(k+1), title: s(cl.title), milestone: Math.round(n(cl.milestone)),
                   secs: Math.max(1, Math.round(n(cl.secs, 60))), beats: arr(cl.beats).map(s).filter(Boolean),
                   src: s(cl.src) || null};
      ["embed","poster","credit"].forEach(k2 => { if(!s(out[k2])) delete out[k2]; });
      return out;
    });
    c.people.firm.stats = arr(c.people.firm.stats).filter(Array.isArray);
    c.rating.counts = [0,1,2,3,4].map(i => Math.max(0, Math.round(n(arr(c.rating.counts)[i]))));
    c.summary = arr(c.summary).map(s).filter(Boolean);
    c.budget = arr(c.budget).filter(Array.isArray).map(([k, v]) => [s(k), n(v)]);
    c.timeline = arr(c.timeline).filter(Array.isArray).map(([t, d, dn]) => [s(t), s(d), dn ? 1 : 0]);
    c.updates = arr(c.updates).filter(Array.isArray).map(([d, t]) => [s(d), s(t)]);
    return c;
  }

  /* fold database rows into CASES, in place, keeping demo order and putting
     new cases after it */
  function merge(rows){
    for(const r of arr(rows)){
      try{
        const at = CASES.findIndex(c => c.id === r.id);
        if(r.status === "hidden"){ if(at >= 0) CASES.splice(at, 1); continue; }
        if(r.status !== "published") continue;
        const c = normalize({...r.data, id: r.id});
        if(at >= 0) CASES[at] = c; else CASES.push(c);
      }catch(e){ console.warn("Skipped case "+r.id, e); }
    }
  }

  async function fetchLive(timeoutMs){
    const cfg = window.LJ_CONFIG || {};
    if(!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)) return [];
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    try{
      const r = await fetch(cfg.SUPABASE_URL+"/rest/v1/cases?select=id,status,data&status=neq.draft&order=created_at",
        {headers: {apikey: cfg.SUPABASE_ANON_KEY}, signal: ctl.signal});
      return r.ok ? await r.json() : [];
    }finally{ clearTimeout(t); }
  }

  const boot = document.currentScript && document.currentScript.dataset.boot;
  if(boot){
    fetchLive(2500).then(merge, e => console.warn("Case content unavailable, showing the demo", e))
      .finally(() => { const el = document.createElement("script"); el.src = boot; document.body.appendChild(el); });
  }

  return {blankCase, normalize, merge, STD_MERIT, STD_IMPACT};
})();
