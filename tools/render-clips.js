/* =====================================================================
   tools/render-clips.js
   ---------------------------------------------------------------------
   Renders tools/clipstudio.html to real .mp4 files in clips/.

   Frames are grabbed one at a time by calling window.frame(t) with an exact
   timestamp, never by recording a wall clock, so a render is reproducible and
   never drops or doubles a frame under load. ffmpeg encodes them to H.264.

     node tools/render-clips.js <case-id> [clip index ...]

   With no clip index it renders the hero clip and every short clip for that
   case. Serve the repo first (npx serve . -l 8099, or python3 -m http.server
   8099) and set PORT if you use another port.
   ===================================================================== */
const {chromium} = require("playwright");
const {spawn} = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT   = process.env.PORT || 8099;
const FPS    = 24;
const W = 720, H = 1280;
const FFMPEG = process.env.FFMPEG || require("ffmpeg-static");
const CHROME = process.env.CHROME_PATH || undefined;
const OUT    = path.join(__dirname, "..", "clips");
/* the render needs the real typeface; Google Fonts is fetched once and reused */
const FONT   = process.env.FONT_TTF || path.join(__dirname, ".cache", "bricolage.ttf");

const caseId = process.argv[2] || "maple-evictions";
const only   = process.argv.slice(3);

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const haveFont = fs.existsSync(FONT);
  if(!haveFont) console.warn("! no font at "+FONT+" — rendering with a fallback typeface");

  const browser = await chromium.launch({executablePath: CHROME, args:["--no-sandbox","--force-device-scale-factor=1"]});
  const ctx = await browser.newContext({viewport:{width:W, height:H}, deviceScaleFactor:1});

  if(haveFont){
    await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({status:200, contentType:"text/css", body:
      `@font-face{font-family:'Bricolage Grotesque';font-weight:100 900;font-display:block;src:url('/__studio-font.ttf') format('truetype')}`}));
    await ctx.route("**/__studio-font.ttf", r => r.fulfill({status:200, contentType:"font/ttf", body:fs.readFileSync(FONT)}));
    await ctx.route(/fonts\.gstatic\.com/, r => r.abort());
  }

  const page = await ctx.newPage();
  const targets = only.length ? only : ["hero", "0", "1", "2", "3", "4"];

  for(const t of targets){
    const url = `http://127.0.0.1:${PORT}/tools/clipstudio.html?case=${caseId}&clip=${t}`;
    await page.goto(url, {waitUntil:"networkidle"});
    const info = await page.evaluate(() => ({
      dur: window.DUR,
      name: (new URLSearchParams(location.search)).get("clip"),
      slug: (window.clip && window.clip.id) || null
    })).catch(()=>null);
    if(!info || !info.dur){ console.log(`  skip ${t} (no such clip)`); continue; }
    await page.evaluate(()=>document.fonts.ready);

    const file = path.join(OUT, `${caseId}-${t}.mp4`);
    const frames = Math.round(info.dur * FPS);
    const ff = spawn(FFMPEG, [
      "-y", "-f","image2pipe", "-framerate", String(FPS), "-i","-",
      "-c:v","libx264", "-preset","slow", "-crf","32", "-g", String(FPS*2),
      "-pix_fmt","yuv420p", "-movflags","+faststart",
      "-vf","format=yuv420p", file
    ], {stdio:["pipe","ignore","ignore"]});

    process.stdout.write(`  ${caseId}-${t}.mp4  ${info.dur.toFixed(1)}s  ${frames} frames `);
    for(let i = 0; i < frames; i++){
      await page.evaluate(tt => window.frame(tt), i / FPS);
      const png = await page.screenshot({type:"png"});
      if(!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
      if(i % 120 === 0) process.stdout.write(".");
    }
    ff.stdin.end();
    await new Promise(r => ff.on("close", r));
    const kb = Math.round(fs.statSync(file).size/1024);
    console.log(` ${kb}kB`);
  }

  await browser.close();
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
