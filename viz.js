/* =====================================================================
   viz.js — the drawing layer
   ---------------------------------------------------------------------
   Every visual on the platform is inline SVG built here as a string, with
   no chart library and no build step. Two rules run through all of it:

     1. A number is shown as a shape before it is shown as a digit. A score
        is an arc, a factor is a step in a waterfall, a weight is the width
        of a petal. Digits are the caption, not the chart.
     2. Nothing is a progress bar unless the thing being drawn really is a
        part of a whole. Funding is. A score is not.

   Colours come from CSS custom properties through classes rather than
   presentation attributes, so every chart follows light and dark mode with
   no redraw. Animation is opt-in: a chart draws itself when it first
   scrolls into view, and draws itself finished when the person has asked
   for reduced motion.
   ===================================================================== */

const NF = new Intl.NumberFormat("en-US");
const num = n => NF.format(Math.round(n));
const pcts = n => Math.round(n)+"%";
const xml = s => String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/* point on a circle, 0 degrees at twelve o'clock, going clockwise */
function pt(cx, cy, r, deg){
  const a = (deg-90) * Math.PI/180;
  return [cx + r*Math.cos(a), cy + r*Math.sin(a)];
}
function arcPath(cx, cy, r, d0, d1){
  const [x0,y0] = pt(cx,cy,r,d0), [x1,y1] = pt(cx,cy,r,d1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${Math.abs(d1-d0)>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/* a filled wedge from the centre, used by the impact bloom */
function wedge(cx, cy, r, d0, d1){
  const [x0,y0] = pt(cx,cy,r,d0), [x1,y1] = pt(cx,cy,r,d1);
  return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${Math.abs(d1-d0)>180?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
}
const rr = (x,y,w,h,r) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0,w).toFixed(2)}" height="${h}" rx="${r}"/>`;

/* =====================================================================
   1. Score glyph — the compact form of both headline scores
   ---------------------------------------------------------------------
   Two concentric arcs on a 270 degree gauge: the outer one is the chance
   of winning, the inner one is social impact. It is the same mark at 34px
   in the feed, 44px on a case card and 88px on the case page, so people
   learn to read it once. The arcs are drawn full length and revealed with
   a dash offset, which is what makes them sweep into place.
   ===================================================================== */
const SWEEP = 270, D0 = -135, D1 = 135;
function gauge(size, merit, impact, cls=""){
  const s = size, c = s/2;
  const rOut = s*0.415, rIn = s*0.268, w = Math.max(3, s*0.105);
  const lOut = 2*Math.PI*rOut*(SWEEP/360), lIn = 2*Math.PI*rIn*(SWEEP/360);
  const track = arcPath(c,c,rOut,D0,D1), trackIn = arcPath(c,c,rIn,D0,D1);
  return `<svg class="gauge ${cls}" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-hidden="true" focusable="false">
    <g fill="none" stroke-linecap="round" stroke-width="${w.toFixed(1)}">
      <path class="g-track" d="${track}"/>
      <path class="g-track" d="${trackIn}"/>
      <path class="g-merit"  d="${track}"   style="stroke-dasharray:${lOut.toFixed(1)};stroke-dashoffset:${(lOut*(1-merit/100)).toFixed(1)}"/>
      <path class="g-impact" d="${trackIn}" style="stroke-dasharray:${lIn.toFixed(1)};stroke-dashoffset:${(lIn*(1-impact/100)).toFixed(1)}"/>
    </g></svg>`;
}
/* the glyph plus its two readings, which is what appears on cards and headers */
function scorePair(c, size=44, cls=""){
  const m = meritScore(c), i = impactScore(c);
  return `<div class="spair ${cls}">${gauge(size,m,i)}
    <div class="spair-read">
      <span class="sp-row"><i class="sp-dot m"></i><b>${m}</b><small>Chance to win</small></span>
      <span class="sp-row"><i class="sp-dot i"></i><b>${i}</b><small>Social impact</small></span>
    </div></div>`;
}
/* the tightest form: glyph plus two digits, for the clip feed */
function scoreTiny(c, size=34){
  const m = meritScore(c), i = impactScore(c);
  return `<span class="stiny" title="Chance to win ${m}, social impact ${i}">${gauge(size,m,i)}<span><b class="m">${m}</b><b class="i">${i}</b></span></span>`;
}

/* =====================================================================
   2. Chance to win — a horizontal waterfall
   ---------------------------------------------------------------------
   Reading down: how often cases like this one win, then every factor that
   moves the number, then where this case lands. Green adds, red subtracts,
   and the dotted risers carry the running total from one row to the next.
   Horizontal rather than vertical because factor names are words, and
   words need a column, not a rotated axis label.
   ===================================================================== */
function waterfall(c){
  const f = c.merit.factors, base = c.merit.base, final = meritScore(c);
  const ROW = 30, PADT = 20, PADB = 26, LAB = 116, X0 = LAB+8, X1 = 322;
  const H = PADT + (f.length+2)*ROW + PADB;
  const sx = v => X0 + (X1-X0)*clamp(v,0,100)/100;
  let run = base, i = 0, rows = "", risers = "";
  const rowY = k => PADT + k*ROW;

  /* base rate */
  rows += `<g class="wf-row wf-base" data-note="${xml(c.merit.baseNote)}" tabindex="0" role="button" aria-label="Base rate ${base} percent. ${xml(c.merit.baseNote)}">
    <rect class="wf-hit" x="0" y="${rowY(0)-4}" width="340" height="${ROW}" rx="7"/>
    <text class="wf-lab" x="${LAB}" y="${rowY(0)+13}" text-anchor="end">Cases like this</text>
    <g class="wf-bar">${rr(sx(0), rowY(0)+3, sx(base)-sx(0), 16, 4)}</g>
    <text class="wf-val" x="${(sx(base)+7).toFixed(1)}" y="${rowY(0)+15}">${base}%</text></g>`;

  f.forEach(fac=>{
    i++; const y = rowY(i), up = fac.delta >= 0;
    const a = up ? run : run + fac.delta, b = up ? run + fac.delta : run;
    const xa = sx(a), xb = sx(b), wide = Math.max(2.5, xb-xa);
    risers += `<line class="wf-riser" x1="${sx(run).toFixed(1)}" y1="${y-11}" x2="${sx(run).toFixed(1)}" y2="${y+3}"/>`;
    rows += `<g class="wf-row ${up?"up":"down"}" data-note="${xml(fac.note)}" tabindex="0" role="button" aria-label="${xml(fac.label)}, ${up?"plus":"minus"} ${Math.abs(fac.delta)} points. ${xml(fac.note)}">
      <rect class="wf-hit" x="0" y="${y-4}" width="340" height="${ROW}" rx="7"/>
      <text class="wf-lab" x="${LAB}" y="${y+13}" text-anchor="end">${xml(fac.label)}</text>
      <g class="wf-bar">${rr(xa, y+3, wide, 16, 3)}</g>
      <text class="wf-delta" x="${(up ? xb+7 : xa-7).toFixed(1)}" y="${y+15}" text-anchor="${up?"start":"end"}">${up?"+":"−"}${Math.abs(fac.delta)}</text></g>`;
    run += fac.delta;
  });

  const yF = rowY(f.length+1);
  risers += `<line class="wf-riser" x1="${sx(run).toFixed(1)}" y1="${yF-11}" x2="${sx(run).toFixed(1)}" y2="${yF+3}"/>`;
  rows += `<g class="wf-row wf-final" tabindex="0" role="button" data-note="Where this case lands once every factor above is applied." aria-label="This case, ${final} percent">
    <rect class="wf-hit" x="0" y="${yF-4}" width="340" height="${ROW}" rx="7"/>
    <text class="wf-lab strong" x="${LAB}" y="${yF+14}" text-anchor="end">This case</text>
    <g class="wf-bar">${rr(sx(0), yF+2, sx(final)-sx(0), 18, 4)}</g>
    <text class="wf-val strong" x="${(sx(final)+7).toFixed(1)}" y="${yF+15}">${final}%</text></g>`;

  /* axis: four gridlines, drawn behind everything */
  let grid = "";
  [0,25,50,75,100].forEach(v=>{
    grid += `<line class="wf-grid" x1="${sx(v).toFixed(1)}" y1="${PADT-8}" x2="${sx(v).toFixed(1)}" y2="${H-PADB+4}"/>
             <text class="wf-axis" x="${sx(v).toFixed(1)}" y="${H-PADB+18}" text-anchor="middle">${v}</text>`;
  });
  return `<svg class="wf" viewBox="0 0 340 ${H}" role="img" aria-label="Waterfall chart: how each factor moves this case's chance of winning from a ${base} percent base rate to ${final} percent.">
    <g>${grid}</g><g>${risers}</g>${rows}</svg>`;
}

/* =====================================================================
   3. Social impact — a bloom
   ---------------------------------------------------------------------
   The circle is the most a case could matter. Each petal is one factor:
   how wide it is, is how much that factor counts; how far it reaches, is
   how the case scored on it. The share of the circle that ends up filled
   is the score, exactly — petal area is weight times score, and the areas
   sum to the weighted mean. That is the whole model in one shape, with no
   row of bars anywhere.
   ===================================================================== */
function bloom(c, size=260){
  const fs = c.impact.factors, S = size, cx = S/2, cy = S/2, R = S*0.40;
  const GAP = 1.4;
  let deg = -90, petals = "", spokes = "";
  fs.forEach((f,i)=>{
    const span = f.weight*360, r = R*Math.sqrt(clamp(f.score,0,100)/100);
    const a0 = deg+GAP, a1 = deg+span-GAP;
    petals += `<path class="bl-petal bl-${i}" style="--i:${i}" d="${wedge(cx,cy,r,a0,a1)}"
        tabindex="0" role="button" data-note="${xml(f.note)}" data-label="${xml(f.label)}"
        data-meta="Weight ${Math.round(f.weight*100)}% · scores ${f.score}"
        aria-label="${xml(f.label)}: weight ${Math.round(f.weight*100)} percent, scores ${f.score} out of 100. ${xml(f.note)}"/>`;
    spokes += `<line class="bl-spoke" x1="${cx}" y1="${cy}" x2="${pt(cx,cy,R,deg)[0].toFixed(1)}" y2="${pt(cx,cy,R,deg)[1].toFixed(1)}"/>`;
    deg += span;
  });
  return `<svg class="bloom" viewBox="0 0 ${S} ${S}" role="img" aria-label="Impact bloom. Each petal is one factor: its width is the weight, its reach is the score. The filled share of the circle is the social impact score, ${impactScore(c)} out of 100.">
    <circle class="bl-ring" cx="${cx}" cy="${cy}" r="${R}"/>
    <g>${spokes}</g><g class="bl-petals">${petals}</g>
    <circle class="bl-hub" cx="${cx}" cy="${cy}" r="2.5"/></svg>`;
}
function bloomLegend(c){
  return `<ul class="bl-legend">${c.impact.factors.map((f,i)=>`
    <li class="bl-li" data-i="${i}" tabindex="0" role="button" data-note="${xml(f.note)}">
      <i class="bl-sw bl-${i}"></i>
      <span class="bl-name">${xml(f.label)}</span>
      <span class="bl-meta"><b>${f.score}</b><small>weight ${Math.round(f.weight*100)}%</small></span>
    </li>`).join("")}</ul>`;
}

/* =====================================================================
   4. The runway — stage progress and lock-in in one rail
   ---------------------------------------------------------------------
   The six stages from the plan, laid out with each segment as wide as that
   stage is long. That makes one rail answer both questions people ask:
   where is this case now, and how long until my money comes back. The
   shaded tail is the part still to run; the lock sits on the end date.
   ===================================================================== */
function runway(c){
  const W = 340, X0 = 14, X1 = W-14, Y = 46, H = 12;
  const tot = totalMonths(c), span = X1-X0;
  let x = X0, segs = "", stops = "", i = 0;
  c.stageMonths.forEach((m,k)=>{
    const w = span*m/tot, state = k < c.stageIdx ? "done" : k === c.stageIdx ? "now" : "todo";
    segs += `<g class="rw-seg ${state}" data-k="${k}" tabindex="0" role="button"
        aria-label="${xml(STAGES[k])}, ${state==="done"?"complete":state==="now"?"in progress now":"ahead"}, about ${m} months">
      <rect class="rw-hit" x="${x.toFixed(1)}" y="${Y-14}" width="${w.toFixed(1)}" height="${H+28}"/>
      <rect class="rw-fill" x="${(x+1).toFixed(1)}" y="${Y}" width="${Math.max(2,w-2).toFixed(1)}" height="${H}" rx="${H/2}"/>
    </g>`;
    if(k) stops += `<circle class="rw-stop ${k<=c.stageIdx?"done":""}" cx="${x.toFixed(1)}" cy="${Y+H/2}" r="2.6"/>`;
    x += w; i++;
  });
  const mx = X0 + span*monthsDone(c)/tot;
  const yearW = span*12/tot;
  let ticks = "";
  for(let y=0; y<=Math.floor(tot/12); y++){
    const tx = X0 + yearW*y;
    if(tx > X1-58) break;   /* leave the end of the year line to the lock */
    ticks += `<line class="rw-tick" x1="${tx.toFixed(1)}" y1="${Y+H+4}" x2="${tx.toFixed(1)}" y2="${Y+H+9}"/>
      <text class="rw-year" x="${tx.toFixed(1)}" y="${Y+H+21}" text-anchor="${y===0?"start":"middle"}">${c.startYear+y}</text>`;
  }
  /* the end of the rail is the end of the lock-in, so it is labelled as one,
     on the year line where it cannot collide with the stage marker above */
  const eY = Y+H+21;                /* baseline of the year line */
  const LK = 0.66, LKH = 14.5;      /* glyph scale, and its height in glyph units */
  ticks += `<g class="rw-end">
    <path class="rw-lock" transform="translate(${(X1-45).toFixed(1)} ${(eY-LKH*LK).toFixed(2)}) scale(${LK})"
      d="M2 6.5h10v7H2zM4 6.5V4.2a3 3 0 0 1 6 0v2.3"/>
    <text class="rw-endy" x="${X1}" y="${eY}" text-anchor="end">${endYear(c)}</text></g>`;
  return `<svg class="runway" viewBox="0 0 ${W} 82" role="img" aria-label="Case runway. ${xml(STAGES[c.stageIdx])} now, about ${lockYears(c)} years in total, expected to end in ${endYear(c)}.">
    <g>${segs}</g><g>${stops}</g><g>${ticks}</g>
    <g class="rw-marker" style="--mx:${mx.toFixed(1)}px">
      <path class="rw-pin" d="M${mx.toFixed(1)} ${Y-3}l-5 -7h10z"/>
      <circle class="rw-pulse" cx="${mx.toFixed(1)}" cy="${Y+H/2}" r="7"/>
    </g>
    <text class="rw-now" x="${clamp(mx,26,W-26).toFixed(1)}" y="${Y-16}" text-anchor="middle">${xml(STAGES[c.stageIdx])}</text>
  </svg>`;
}

/* =====================================================================
   5. Returns — the outcome fan
   ---------------------------------------------------------------------
   One pledge today, three ways it can end. Branch thickness is how likely
   that ending is and height is what it pays, so the eye reads risk and
   reward in the same glance. Deliberately not a bar chart: bars imply a
   measured quantity, and these are possibilities.
   ===================================================================== */
function outcomeFan(c, amount){
  const o = outcomeFor(c, amount);
  const W = 340, H = 186, XS = 22, XE = 214, rows = [
    {k:"win",    y:34,  label:"Case won",  amt:o.win,    p:o.p.win},
    {k:"settle", y:96,  label:"Settled",   amt:o.settle, p:o.p.settle},
    {k:"lose",   y:156, label:"Case lost", amt:o.lose,   p:o.p.lose}
  ];
  const y0 = 96;
  let paths = "", ends = "";
  rows.forEach((r,i)=>{
    const w = 3 + r.p*30;
    paths += `<path class="fan-b fan-${r.k}" style="--i:${i};--w:${w.toFixed(1)}"
      d="M${XS} ${y0}C${XS+72} ${y0} ${XE-78} ${r.y} ${XE} ${r.y}"/>`;
    ends += `<g class="fan-end fan-${r.k}" style="--i:${i}">
      <circle class="fan-node" cx="${XE}" cy="${r.y}" r="4.5"/>
      <text class="fan-amt" x="${XE+12}" y="${r.y-1}">${r.amt ? "$"+num(r.amt) : "$0"}</text>
      <text class="fan-sub" x="${XE+12}" y="${r.y+14}">${xml(r.label)} · ${Math.round(r.p*100)}% likely</text></g>`;
  });
  return `<svg class="fan" viewBox="0 0 ${W} ${H}" role="img" aria-label="Outcome fan for a ${num(amount)} dollar pledge: won pays ${num(o.win)} dollars at ${Math.round(o.p.win*100)} percent, settled pays ${num(o.settle)} at ${Math.round(o.p.settle*100)} percent, lost pays nothing at ${Math.round(o.p.lose*100)} percent.">
    <line class="fan-axis" x1="${XS}" y1="16" x2="${XS}" y2="${H-16}"/>
    <g>${paths}</g>
    <g class="fan-start"><circle cx="${XS}" cy="${y0}" r="5.5"/>
      <text class="fan-you" x="${XS-14}" y="${y0-17}" text-anchor="start">Your $${num(amount)}</text></g>
    ${ends}</svg>`;
}

/* =====================================================================
   6. The payout split — one ribbon
   ---------------------------------------------------------------------
   This one IS a part of a whole, so a single divided ribbon is the honest
   form. Three segments, labelled where they fit, with the processing fee
   shown as what it is: a slice taken off the top before anything else.
   ===================================================================== */
function splitRibbon(){
  const W=340, X0=8, X1=W-8, span=X1-X0, Y=26, H=26;
  const parts = [
    {k:"plaintiff", v:SPLIT.plaintiff, label:"Plaintiff"},
    {k:"platform",  v:SPLIT.platform,  label:"LaunchJustice"},
    {k:"backers",   v:SPLIT.backers,   label:"Backers"}
  ];
  let x = X0, segs = "", labs = "";
  parts.forEach((p,i)=>{
    const w = span*p.v;
    const rad = i===0 ? `M${x+7} ${Y}h${(w-7).toFixed(1)}v${H}h${-(w-7).toFixed(1)}a7 7 0 0 1 -7 -7v${-(H-14)}a7 7 0 0 1 7 -7z`
      : i===parts.length-1 ? `M${x.toFixed(1)} ${Y}h${(w-7).toFixed(1)}a7 7 0 0 1 7 7v${H-14}a7 7 0 0 1 -7 7h${-(w-7).toFixed(1)}z`
      : `M${x.toFixed(1)} ${Y}h${w.toFixed(1)}v${H}h${-w.toFixed(1)}z`;
    segs += `<path class="sr-seg sr-${p.k}" style="--i:${i}" d="${rad}"/>`;
    if(p.v >= .12) segs += `<text class="sr-in" x="${(x+w/2).toFixed(1)}" y="${Y+17}" text-anchor="middle">${Math.round(p.v*100)}%</text>`;
    labs += `<li class="sr-key" style="--i:${i}"><i class="sr-sw sr-${p.k}"></i>${xml(p.label)}<b>${Math.round(p.v*100)}%</b></li>`;
    x += w;
  });
  return `<div class="splitwrap">
    <svg class="split" viewBox="0 0 ${W} 60" role="img" aria-label="Of an award: ${Math.round(SPLIT.plaintiff*100)} percent to the plaintiff, ${Math.round(SPLIT.platform*100)} percent to LaunchJustice, ${Math.round(SPLIT.backers*100)} percent to backers.">
      <text class="sr-top" x="${X0}" y="14">Every dollar of an award</text>
      <g>${segs}</g></svg>
    <ul class="sr-keys">${labs}</ul></div>`;
}

/* =====================================================================
   7. Small marks
   ===================================================================== */

/* a unit chart: one dot per unit, filled dots are the ones that count.
   An empty grid says "none of them" far louder than the digit 0 does. */
function dotMatrix(value, of){
  /* a grid people can count: ten across when the total is a round ten,
     otherwise a shape near enough to square to read at a glance */
  const cols = of <= 14 ? of : (of % 10 === 0 ? 10 : 13);
  const rows = Math.ceil(of/cols);
  const gap = 10.5, r = 3.4, W = cols*gap, H = rows*gap;
  let d = "";
  for(let k=0; k<of; k++){
    const cx = (k%cols)*gap + gap/2, cy = Math.floor(k/cols)*gap + gap/2;
    d += `<circle class="dm-d ${k<value?"on":""}" style="--i:${k}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"/>`;
  }
  return `<svg class="dotm" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${value} of ${of}">${d}</svg>`;
}

/* the community pulse: a crowd of ticks, grouped by stance.
   Reads as people rather than as a percentage bar. */
function pulseUnits(counts, units=44){
  const total = counts.support + counts.question + counts.skeptical || 1;
  const order = [["support",counts.support],["question",counts.question],["skeptical",counts.skeptical]];
  let n = order.map(([k,v])=>Math.round(v/total*units));
  /* rounding has to land exactly on `units` or the row ends ragged */
  let drift = units - n.reduce((a,b)=>a+b,0);
  for(let i=0; drift!==0; i=(i+1)%3){ n[i] += Math.sign(drift); drift -= Math.sign(drift); }
  const gap = 100/units;
  let t = "", k = 0;
  order.forEach(([key],gi)=>{
    for(let j=0;j<n[gi];j++,k++){
      t += `<rect class="pu-t pu-${key}" style="--i:${k}" x="${(k*gap+gap*0.14).toFixed(2)}" y="0" width="${(gap*0.56).toFixed(2)}" height="18" rx="${(gap*0.28).toFixed(2)}"/>`;
    }
  });
  return `<svg class="pulse" viewBox="0 0 100 18" preserveAspectRatio="none" role="img" aria-label="Community pulse: ${pcts(counts.support/total*100)} support, ${pcts(counts.question/total*100)} asking questions, ${pcts(counts.skeptical/total*100)} sceptical.">${t}</svg>`;
}

/* rating distribution: five combs, tallest is the mode */
function ratingComb(counts){
  const max = Math.max(...counts, 1), W = 78, H = 30, bw = 10, gap = 5;
  let b = "";
  counts.forEach((n,i)=>{
    const h = Math.max(2, H*n/max), x = i*(bw+gap);
    b += `<rect class="rc-b" style="--i:${i}" x="${x}" y="${(H-h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="2"/>`;
  });
  return `<svg class="comb" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating spread from one to five stars">${b}</svg>`;
}

/* seven-day sparkline for the trending badge */
function spark(series){
  const W=44,H=14,max=Math.max(...series),min=Math.min(...series),r=(max-min)||1;
  const p = series.map((v,i)=>`${(i/(series.length-1)*W).toFixed(1)},${(H-2-(v-min)/r*(H-4)).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${p}"/></svg>`;
}

/* five rating dots, filled to `v`, used for display and for input */
function ratingDots(v, interactive=false){
  return `<span class="rdots ${interactive?"live":""}" ${interactive?'role="radiogroup" aria-label="Rate this case out of 5"':''}>${
    [1,2,3,4,5].map(n=>interactive
      ? `<button class="rd" data-r="${n}" role="radio" aria-checked="${n===v}" aria-label="${n} out of 5"><i class="${n<=v?"on":""}"></i></button>`
      : `<i class="rd-s ${n<=Math.round(v)?"on":""}"></i>`).join("")}</span>`;
}

/* =====================================================================
   8. Generated banner artwork
   ---------------------------------------------------------------------
   The fallback when a hero photograph will not load, and the base layer
   underneath every hero so the banner has depth rather than a flat crop.
   Three drifting colour fields in the case's own hue, plus a grain wash.
   ===================================================================== */
function heroArt(c, seed=0){
  const col = CATS[c.cat].color, id = "ha"+c.id.replace(/[^a-z]/g,"")+seed;
  return `<svg class="heroart" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="${id}a" cx="28%" cy="26%" r="62%">
        <stop offset="0%" stop-color="${col}" stop-opacity=".95"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}b" cx="76%" cy="72%" r="58%">
        <stop offset="0%" stop-color="${col}" stop-opacity=".6"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}c" cx="62%" cy="18%" r="46%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".22"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="40%" stop-color="#070B11" stop-opacity="0"/><stop offset="100%" stop-color="#070B11" stop-opacity=".82"/></linearGradient>
    </defs>
    <rect width="400" height="300" fill="#0E141C"/>
    <g class="ha-drift"><rect width="400" height="300" fill="url(#${id}a)"/></g>
    <g class="ha-drift2"><rect width="400" height="300" fill="url(#${id}b)"/></g>
    <rect width="400" height="300" fill="url(#${id}c)"/>
    <g class="ha-lines" opacity=".14">${
      Array.from({length:14},(_,i)=>`<line x1="0" y1="${i*22}" x2="400" y2="${i*22-40}" stroke="#fff" stroke-width=".7"/>`).join("")}</g>
    <rect width="400" height="300" fill="url(#${id}v)"/></svg>`;
}

/* =====================================================================
   9. Draw-on-scroll
   ---------------------------------------------------------------------
   A chart that is already finished when you reach it has thrown away its
   best sentence. Anything marked .reveal stays undrawn until it scrolls
   into its container, then draws once. If the person has asked for
   reduced motion it is simply drawn, immediately, with no animation at
   all — the same information, none of the movement.
   ===================================================================== */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealers = new WeakMap();
function armReveals(scroller){
  const targets = scroller.querySelectorAll(".reveal:not(.in)");
  if(!targets.length) return;
  if(REDUCED){ targets.forEach(el=>el.classList.add("in")); return; }
  let io = revealers.get(scroller);
  if(!io){
    io = new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
    }), {root: scroller, rootMargin:"0px 0px -8% 0px", threshold:0.12});
    revealers.set(scroller, io);
  }
  targets.forEach(el=>io.observe(el));
}

/* A number that counts up to itself when it is first seen. Used for the
   platform totals, where the point is the size of the number. */
function countUp(el, to, ms=900, fmt=num){
  if(REDUCED){ el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function step(t){
    const k = Math.min(1, (t-t0)/ms), e = 1-Math.pow(1-k, 3);
    el.textContent = fmt(to*e);
    if(k<1) requestAnimationFrame(step);
  })(t0);
}
