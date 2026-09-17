# Clips

Short vertical video for the case pages. Everything here is 9:16 — the frame is
720×1280 and anything else gets cropped to fill.

## What is in here now

Nothing filmed yet. Every case plays its clip card: the case photograph on a
slow push-in, under grain and a vignette, with the beats set over it.

`tools/render-clips.js` turns a case's beats into real MP4 files, so the
`<video>` path can be exercised with actual files. What it makes is a
placeholder for filmed footage, not a substitute for it. Clips with a file and
clips without sit in the same rail, which is what the product looks like while
content is being made.

## Adding a real clip

Drop the file in here and point the case at it. That is the whole change.

The hero clip is `video` on the case; the short clips are `src` on each entry
in `clips[]`:

```js
{id:"asylum-backlog", cat:"immigration",
 video:"clips/asylum-hero.mp4", poster:"clips/asylum-hero.jpg",
 clips:[
   {id:"a1", title:"Meet Maria", milestone:0, secs:58,
    src:"clips/asylum-maria.mp4", poster:"clips/asylum-maria.jpg", beats:[...]},
 ], ...}
```

- `secs` is only the duration badge on the card. Keep it honest.
- `milestone` is the index into the case's `timeline[]`, which is what decides
  where on the timeline the clip is offered.
- `poster` is the still shown before playback and as the card thumbnail. Worth
  setting; without it the card falls back to the case's hero photograph.
- `beats` stays either way. A clip with a video does not draw the beat captions
  over it, because a real clip carries its own words, but the beats remain as
  the written version of the clip.

## Encoding

H.264 in MP4, AAC audio if there is any, `+faststart` so playback begins before
the file has finished downloading.

```
ffmpeg -i source.mov -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart out.mp4
```

Keep each file under about 3 MB. These load on phones, often on mobile data, and
the feed preloads metadata for several at once.

## Re-rendering the generated clips

```
python3 -m http.server 8099          # serve the repo
node tools/render-clips.js maple-evictions
```

Renders the hero clip and every short clip for that case. Pass clip indices to
do a subset (`node tools/render-clips.js maple-evictions hero 2`). It needs
`playwright` and `ffmpeg-static` available, and the Bricolage Grotesque TTF at
`tools/.cache/bricolage.ttf` — without the font it renders in a fallback face.
The font is SIL Open Font License, from
https://github.com/ateliertriay/bricolage, and is not committed here.
