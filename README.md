# LaunchJustice MVP

A no-build, static web app for discovering and pledging to public-interest legal cases.

- **Watch**: vertical feed of 60-second case clips
- **Cases**: search and filter by issue
- **Case page**: story, court, stage, budget, timeline, updates, discussion
- **Pledge**: name + amount, no signup, no payment taken
- **My pledges**: totals for this device

The cases in `app.js` (`CASES`) are fictional demo data. Replace them with real NGO cases.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styling (phone, tablet and laptop; light and dark mode) |
| `app.js` | Case data, UI, and data layer |
| `config.js` | Supabase settings (optional) |
| `supabase/schema.sql` | Database tables for shared mode |

## Run locally

Open `index.html` in a browser, or run `npx serve .` and visit the printed URL.

## Phone and laptop

One codebase, three layouts, chosen by window width. Drag the Chrome window
narrower and wider, or use the device toolbar, to cross each line.

| Width | Layout |
| --- | --- |
| under 700px | Phone. Full-bleed clips, bottom tab bar, pledge opens as a bottom sheet. |
| 700–1023px | Tablet. Clips become a centred 9:16 card with the action rail beside them; cases in two columns; bottom tab bar stays. |
| 1024px and up | Laptop. Tab bar becomes a left sidebar, the feed gains up/down arrows (arrow keys work too), the case page splits into story plus a sticky funding panel, and pledging opens as a centred dialog. Three case columns from 1400px. |

The clip feed stays vertical at every size — on a laptop it is a centred 9:16
card, the way TikTok looks in a desktop browser, not a stretched widescreen
video.

Dark mode follows the operating system setting at every size.

## Deploy on Vercel

1. Push this folder to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework preset as **Other**. No build command is needed.
3. Deploy. Every push to `main` redeploys automatically.

## Data modes

**Local (default):** with `config.js` empty, pledges and comments are saved in each visitor's browser. Good for look-and-feel testing, but people won't see each other's pledges.

**Shared (Supabase):** create a Supabase project, run `supabase/schema.sql` in its SQL editor, then put the project URL and anon key in `config.js`. Pledges, comments and reactions then update live for everyone.

## Adding real video

Each case's clip is rendered from its `beats` captions until you give the case
a video. Add a `video` (and optionally a `poster`) to any case in `CASES`:

```js
{id:"asylum-backlog", cat:"immigration", video:"clips/asylum.mp4", poster:"clips/asylum.jpg", ...}
```

The file then plays muted, looping and inline in the same frame, and the
progress bar and captions follow the video's clock instead of the beat timer.
Shoot vertical: the frame is 9:16 and anything else gets cropped to fill.
Cases with and without video can sit in the same feed.

## Not in this version

No accounts, payments, KYC, or moderation. Pledges are non-binding.
