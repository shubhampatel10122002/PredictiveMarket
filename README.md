# LaunchJustice MVP

A no-build, static web app for discovering and pledging to public-interest legal cases.

- **Watch**: vertical feed of 60-second case clips (placeholder animated captions for now)
- **Cases**: search and filter by issue
- **Case page**: story, court, stage, budget, timeline, updates, discussion
- **Pledge**: name + amount, no signup, no payment taken
- **My pledges**: totals for this device

The cases in `app.js` (`CASES`) are fictional demo data. Replace them with real NGO cases.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styling (light and dark mode) |
| `app.js` | Case data, UI, and data layer |
| `config.js` | Supabase settings (optional) |
| `supabase/schema.sql` | Database tables for shared mode |

## Run locally

Open `index.html` in a browser, or run `npx serve .` and visit the printed URL.

## Deploy on Vercel

1. Push this folder to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework preset as **Other**. No build command is needed.
3. Deploy. Every push to `main` redeploys automatically.

## Data modes

**Local (default):** with `config.js` empty, pledges and comments are saved in each visitor's browser. Good for look-and-feel testing, but people won't see each other's pledges.

**Shared (Supabase):** create a Supabase project, run `supabase/schema.sql` in the SQL editor, then put the project URL and anon key in `config.js`. Pledges, comments and reactions then update live for everyone.

## Adding real video

Each case's clip is currently rendered from its `beats` captions. To use real clips, add a `video` URL to a case and render a `<video playsinline muted loop>` element inside `.stage` in `clipHTML()`.

## Not in this version

No accounts, payments, KYC, or moderation. Pledges are non-binding.
