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

The schema is applied, but sign-in depends on things that live in Supabase's
settings rather than in SQL.

#### 1. Redirect URLs — fix this first

A confirmation link that lands on `localhost refused to connect` almost always
means the same thing: Supabase will only send people back to an address on its
allow-list, and when the address it was asked for isn't on that list it falls
back to the **Site URL**, which on a new project is `http://localhost:3000`.
Nothing is running there, so Chrome shows `ERR_CONNECTION_REFUSED`.

Authentication → URL Configuration:

- **Site URL** — the address the app really lives at. Once it is deployed, use
  the deployed address. This is the fallback, so make it somewhere that is
  always up.
- **Redirect URLs** — add every origin the app is opened from, each with a
  wildcard path, for example `https://launchjustice.vercel.app/**` and
  `http://localhost:8000/**`. The port has to match the one you serve from;
  `python3 -m http.server 8000` is port 8000, not 3000.

Three things worth knowing while testing:

- Opening `index.html` as a `file://` path can never work for sign-in. Serve it
  over http, even locally.
- A confirmation link is single use and expires (an hour by default), so a link
  from an earlier attempt will fail even after the settings are right. The
  "Confirm your email" screen has a **Send it again** button, and the app names
  the reason a link failed instead of showing a blank signed-out screen.
- **A confirmation that ends on a broken redirect still worked.** The link goes
  to Supabase, which marks the address confirmed and only then sends the browser
  on to the app, so `ERR_CONNECTION_REFUSED` is the last step failing after the
  confirmation succeeded. Check before assuming otherwise:

      select email, email_confirmed_at from auth.users order by created_at desc;

- **Signing up twice with the same address sends nothing.** Supabase answers
  with a success and no email, so that sign-up cannot be used to find out who
  has an account. The app spots this and says the account already exists rather
  than promising a mail that will never arrive — but it does mean each end-to-end
  test needs an address that has not been used yet.

#### 2. Email from no-reply@peoplemachine.com

Supabase's built-in sender is for development only: it sends from a Supabase
address and is rate limited to a couple of messages an hour, shared across the
whole project. It cannot be made to send as your domain. For your own address
you need your own SMTP provider.

Pick a transactional email provider — Resend is the least work, Postmark has
the best deliverability record, Amazon SES is the cheapest at volume. Then:

1. **Add `peoplemachine.com` as a sending domain** in the provider and add the
   DNS records it gives you. There are normally three: a DKIM signing key, an
   SPF record, and a `MX`/return-path record. Providers usually put the SPF and
   return-path on a subdomain such as `send.peoplemachine.com` precisely so they
   do not disturb whatever already delivers your normal company mail — but read
   what yours asks for rather than assuming. If `peoplemachine.com` already
   sends mail through Google Workspace or similar, do not replace the existing
   SPF record; a domain may only have one, and the entries have to be merged.
2. **Wait for the domain to verify.** DNS can take minutes to hours. The
   provider will not issue credentials until it does.
3. **Add a DMARC record** if the domain does not have one
   (`_dmarc.peoplemachine.com`, starting at `v=DMARC1; p=none;`). Gmail and
   Yahoo require it for bulk senders and it improves inbox placement either way.
4. **Put the credentials into Supabase.** Project Settings → Authentication →
   SMTP Settings → enable Custom SMTP. Fill in the provider's host and port
   (587 with STARTTLS is the usual choice), the username and password it issued,
   and set **Sender email** to `no-reply@peoplemachine.com` and **Sender name**
   to whatever should appear in the inbox.
5. **Raise the email rate limit.** Authentication → Rate Limits. The default is
   deliberately tiny for the built-in sender; with your own SMTP it can go up to
   whatever your provider allows. Leaving it at the default is the usual reason
   invitations mysteriously stop arriving partway through a round of testing.
6. **Send a test.** Sign up with a real address and confirm it arrives from
   `no-reply@peoplemachine.com`, not from Supabase.

While you are there, Authentication → Email Templates is worth a pass: the
default confirmation email says "Supabase" and is the first thing a backer sees.

#### 3. Email confirmation, on or off

Authentication → Sign In / Providers → Email. With **Confirm email** on (the
default) a new account has to click a link before it can sign in, and the app
shows a "Confirm your email" screen. Turning it off signs people straight in and
removes email from the critical path entirely — reasonable for an internal demo,
and the setting is independent of the SMTP work above, which is also used for
password resets and future invitations.

#### 4. Google sign-in

Authentication → Sign In / Providers → Google. Enable it and paste a Client ID
and Secret from a Google Cloud OAuth client. Supabase shows a callback URL of
the form `https://<project>.supabase.co/auth/v1/callback` — add exactly that to
**Authorised redirect URIs** on the Google side. The redirect URLs from step 1
have to be right as well, or Google will return people to the wrong place.
Until this is done the Google button says it isn't switched on; email sign-up
works regardless.

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
