/* =====================================================================
   LaunchJustice analytics
   ---------------------------------------------------------------------
   Five kinds of row, written straight into the `events` table so the
   admin can see what people actually open, watch and back:

     case_view    a case page was opened           via, clip
     case_time    seconds spent on that visit      seconds
     clip_watch   one viewing of one reel          clip, via, seconds, pct
     invest_open  the invest sheet was opened      via, clip
     share        a case was shared                via, clip

   app.js decides when each one happens; this file only queues and sends.
   Nothing here can break the page: every call is wrapped, a send that fails
   is dropped, and with no Supabase in config.js the whole thing is a silent
   no-op, the same way local mode treats everything else.

   It loads before cms.js, which starts app.js late, so it cannot know who is
   acting. app.js hands over actorId() with setActor() as soon as it exists,
   and a row queued before then takes whoever it is when it is sent.
   ===================================================================== */

window.LJ_TRACK = (() => {
  const KINDS = ["case_view","case_time","clip_watch","invest_open","share"];
  const EVERY = 4000, BATCH = 50;
  let queue = [], actor = null, timer = 0;

  const cfg = () => window.LJ_CONFIG || {};
  const live = () => !!(cfg().SUPABASE_URL && cfg().SUPABASE_ANON_KEY);

  /* The table's own limits, applied here, so a bad value costs one field
     rather than the whole batch it travels in. */
  const text = (v, max) => v == null || v === "" ? null : String(v).slice(0, max);
  const real = (v, lo, hi, per) => {
    const x = v == null ? NaN : +v;
    return Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))*per)/per : null;
  };
  const who = () => {
    try{ const a = actor && actor(); return typeof a === "string" && /^[du]:/.test(a) ? a.slice(0, 64) : null; }
    catch(e){ return null; }
  };

  /* Every row carries every column, null where there is nothing to say:
     PostgREST refuses a bulk insert whose objects have different keys. */
  function event(kind, f){
    try{
      f = f || {};
      const case_id = text(f.case_id, 64);
      if(!live() || !KINDS.includes(kind) || !case_id) return;
      queue.push({kind, case_id, clip: text(f.clip, 64), via: text(f.via, 20),
                  seconds: real(f.seconds, 0, 7200, 10), pct: real(f.pct, 0, 1, 1000),
                  actor_id: who()});
      if(queue.length >= BATCH) flush();
      else if(!timer) timer = setTimeout(flush, EVERY);
    }catch(e){}
  }

  function flush(){
    clearTimeout(timer); timer = 0;
    try{
      if(!queue.length || !live()) return;
      /* rows from before anyone was known wait for the next flush */
      const a = who(), out = [], wait = [];
      queue.forEach(r => (r.actor_id || (r.actor_id = a)) ? out.push(r) : wait.push(r));
      queue = wait;
      for(let i = 0; i < out.length; i += BATCH) send(out.slice(i, i + BATCH));
    }catch(e){}
  }

  /* keepalive lets the request outlive the page that sent it, which is the
     whole point of the flush on pagehide. Only the publishable key goes with
     it: the insert policy asks for nothing more, and who is acting is already
     in actor_id, so there is no session to fetch on the way out. */
  function send(rows){
    const c = cfg();
    try{
      fetch(c.SUPABASE_URL + "/rest/v1/events", {
        method: "POST", keepalive: true,
        headers: {apikey: c.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal"},
        body: JSON.stringify(rows)
      }).catch(() => {});
    }catch(e){}
  }

  /* A phone gives no warning before it discards a background tab, so going
     hidden is the last moment that can be relied on; pagehide is the last
     one a closing tab gets. app.js writes its open visit and viewing on
     pagehide too, after this, and flushes them itself. */
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") flush(); });
  addEventListener("pagehide", flush);

  return {event, flush, setActor: fn => { actor = typeof fn === "function" ? fn : null; }};
})();
