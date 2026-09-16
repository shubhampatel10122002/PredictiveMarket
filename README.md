# LaunchJustice MVP

A no-build, static web app for discovering and pledging to public-interest legal cases.

- **Watch**: vertical feed of 60-second case clips
- **Cases**: search and filter by issue
- **Case page**: story, court, stage, budget, timeline, updates, discussion
- **Pledge**: name + amount, no payment taken
- **Accounts**: email sign-up or Continue with Google, entirely optional
- **My pledges**: totals for this account, or for this browser when signed out

The cases in `app.js` (`CASES`) are fictional demo data. Replace them with real NGO cases.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styling (phone, tablet and laptop; light and dark mode) |
| `app.js` | Case data, UI, and data layer |
| `config.js` | Supabase project URL and publishable key |
| `supabase/schema.sql` | Tables, row level security policies and grants |

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

**Shared (default):** `config.js` points at the project's Supabase database, and
`supabase/schema.sql` is already applied to it. Pledges, comments and reactions
update live for everyone, and accounts work.

**Local:** empty both values in `config.js` and everything is saved in each
visitor's browser instead. Accounts are unavailable in this mode, and people
won't see each other's pledges.

The key in `config.js` is the *publishable* key. It is meant to ship in the
browser and grants nothing by itself, because every table is behind row level
security. Never put the `service_role` key in this file.

## Accounts

Signing in is optional everywhere. A signed-out visitor can still watch, pledge
and comment, exactly as before; signing in means the name fills itself in, a
Google avatar shows next to comments, and pledges follow the person to any
device instead of living in one browser.

Under the hood every pledge, comment and like carries an `actor_id`: `d:<random>`
for a browser, `u:<uuid>` for an account. The database enforces that pairing —
a signed-out request can only write signed-out rows, and a signed-in one can
only write rows stamped with its own account id, so nobody can pledge or
comment as someone else. Pledges cannot be edited or deleted from the browser
at all, and pledgers' real names and their private notes to the legal team are
readable in the Supabase dashboard but are not granted to the browser.

Pledges made before signing in stay visible on that browser afterwards, so
nothing is lost by pledging first and signing up later.

### Dashboard settings you still have to make

The schema is applied, but four things live in Supabase's settings rather than
in SQL, so they have to be switched on by hand in the dashboard:

1. **Google sign-in.** Authentication → Sign In / Providers → Google. Enable it
   and paste a Client ID and Secret from a Google Cloud OAuth client. Supabase
   shows you a callback URL — add that to **Authorised redirect URIs** on the
   Google side. Until this is done the Google button reports that it isn't
   switched on; email sign-up works regardless.
2. **Redirect URLs.** Authentication → URL Configuration. Set the Site URL to
   the deployed address and add every origin the app runs on, including
   `http://localhost:3000` (or whichever port you serve it from), otherwise
   Google sends people back to the wrong place.
3. **Email confirmation.** Authentication → Sign In / Providers → Email. With
   "Confirm email" on (the default) a new account has to click a link before it
   can sign in, and the app shows a "Confirm your email" screen. For an internal
   demo it is usually less friction to turn it off, which signs people straight
   in.
4. **SMTP, if you leave confirmation on.** Supabase's built-in email sender is
   rate limited to a handful of messages an hour and is not meant for real use.
   Wire up your own SMTP (Resend, Postmark, SES) before inviting the board,
   or turn confirmation off for the demo.

Password reset is not built yet: someone who forgets a password needs a new
account, or a reset from the dashboard.

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
