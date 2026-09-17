# Clips

Short vertical video for the case pages. Everything here is 9:16 — the frame is
720×1280 and anything else gets cropped to fill.

## What is in here now

One file: `maple-evictions-hero.mp4`, the housing case's 60-second clip,
rendered from its own beats by `tools/render-clips.js`. It is a placeholder for
a filmed hero clip rather than a substitute for one.

That case's five short clips are **embeds** — real tenant-rights and eviction
explainers on YouTube, credited on the card and tied back to the case in the
viewer. They are somebody else's videos, which is why they are embedded rather
than sitting in this folder. See *Footage you do not own* below.

Every other case plays its clip card instead: the case photograph on a slow
push-in, under grain and a vignette, with the beats set over it. Hosted files,
embeds and clip cards all sit in the same rail, which is what the product
looks like while content is being made.

An embed needs the network and needs the publisher to allow embedding. If you
want a version of this case that plays with no connection at all — a room with
bad wifi, say — `node tools/render-clips.js maple-evictions` puts rendered MP4s
back in this folder, and swapping `embed` for `src` on each clip is a one-line
change per clip.

A rendered clip carries no wordmark, no progress bar and no credit, because
the app draws all three over whatever it plays. Frame real footage the same
way: the app's furniture sits along the bottom of the feed and down the right,
so keep the bottom third and the right edge clear.

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

## Footage you do not own

News packages, documentary excerpts and anything else under licence are not
ours to host. Putting a broadcaster's file in this folder is copyright
infringement however the demo is framed, and the fact that it is a pitch does
not change that.

The route that is allowed is the publisher's own embed, so a clip can carry an
`embed` instead of a `src`:

```js
{id:"a1", title:"ABC7 on the eviction notices", milestone:1, secs:96,
 embed:"https://www.youtube.com/embed/VIDEO_ID", beats:[...]},
```

An embedded clip gets the frame to itself. No captions, no progress bar, no
tap-to-pause, because the controls belong to whoever owns the video. Anything
YouTube or Vimeo will serve in an iframe works; so does a broadcaster's own
player where they publish embed codes.

Two practical notes. Vertical uploads and YouTube Shorts fill a 9:16 frame;
ordinary 16:9 footage gets pillarboxed by the player, which is correct but
looks less native, so prefer vertical cuts where the publisher offers them.
And if you want it to start on its own, that is the platform's parameter to
add, e.g. `?autoplay=1&mute=1&playsinline=1` on a YouTube embed.

Getting permission and a file direct from a newsroom is worth asking for: many
will licence a short excerpt for a non-profit, and a hosted file behaves far
better in this feed than an embed does.

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
