# LaunchJustice

A no-build, static web app for discovering and pledging to public-interest legal
cases, written to show the product running at full scale.

- **Cases**: the home page. A live activity ticker, a "Trending now" rail, search and
  filters, and the platform FAQ at the foot
- **Watch**: vertical feed of every clip on the platform, dealt so two reels
  from the same case are never adjacent, trending cases first
- **Case page**: an interactive banner, a rolling comment highlight, why-it-matters
  stats, both headline scores, the discussion, the lock-in and stage runway, the
  outcome fan, the clip rail, the people, the case's own FAQ, and the filings underneath
- **Score breakdown**: a waterfall for chance-to-win and a bloom for social impact
- **Invest**: lock-in and the three outcomes shown in the flow, no payment taken
- **Accounts**: email sign-up or Continue with Google, entirely optional
- **My investments**: a small portfolio with what it returns if every case wins, settles or loses

Everything in `data.js` is fictional: the cases, the people, the discussion, the
scores and the numbers. It is written the way a platform with a couple of million
members would look, so the product can be shown rather than described.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | All styling (phone, tablet and laptop; light and dark mode) |
| `data.js` | The demo content and the score model |
| `viz.js` | Every chart, drawn as inline SVG |
| `app.js` | State, screens and interaction |
| `config.js` | Supabase project URL and publishable key |
| `cms.js` | Folds cases published from the admin into `CASES`, then starts `app.js` |
| `admin/` | The internal admin at `/admin`: cases, clips and video, media, pledges, comments, team |
| `sim/` | LaunchJustice Live at `/sim`: the ten-minute investor simulation. See *The simulation* below |
| `supabase/schema.sql` | Tables, row level security policies and grants |
| `clips/` | Vertical clip files, and how to add real ones |
| `tools/` | The clip renderer. Not shipped, not loaded by the app |

## The two scores

Every case carries two numbers, shown together everywhere as one dial: the outer
arc is the **chance to win**, the inner arc is **social impact**. They are
deliberately separate. A case can be very likely to win and matter to forty
people; another can be a long shot that would change the law for a state.

Neither is typed into the data. Chance to win is the base rate for cases of that
kind plus a delta for every factor (claim type, jurisdiction, judge, attorney
record, defendant, evidence, supporting cases, merits). Social impact is the
weighted mean of its factors (people affected, severity, lasting change, public
attention, community support). Change a factor in `data.js` and every screen that
shows a score changes with it.

The breakdown screen explains each one as a picture, not as a table of bars:

- **Chance to win** is a horizontal **waterfall**. It starts at how often similar
  cases win, then steps up in green and down in red for each factor, and lands on
  this case's number. Tap any row for why that factor moved it.
- **Social impact** is a **bloom**. The circle is the most a case could matter.
  Each petal is one factor: its *width* is the weight, its *reach* is the score.
  Petal radius is set to the square root of the score, so petal area is weight
  times score, and the share of the circle that fills in is the composite number
  exactly. The whole model is one shape.

Both are labelled **Demo model** wherever they appear. They are placeholders for
the scoring model in the business plan, not predictions.

## Returns and the lock-in

Returns are a separate component from the scores, and they never claim a number
is guaranteed. The interface says **invest**, which is the word the product
uses; the honest notices stay — no money moves today, and nothing is
collected until investing opens. Table names, function names and element ids
still say `pledge`, because the Supabase schema does.

- The **runway** is one rail that answers two questions at once: each of the six
  stages (Pre-filing, Pleadings, Discovery, Trial, Decision, Appeal) is drawn as
  wide as it is long, so where the case is *and* how long is left are the same
  picture. The lock sits on the end date.
- The **outcome fan** shows one pledge splitting three ways. Branch thickness is
  how likely each ending is, and where it lands is what it pays.
- The **split ribbon** shows the payout from the plan: about 53% to the plaintiff,
  6% to LaunchJustice (a 5% platform fee plus a 1% contingent return), 41% to
  backers in proportion to what each put in, with roughly 3% of every pledge going
  to payment processing before it reaches the case.

`outcomeFor()` in `data.js` is the single place this is computed. Each case sets
what every invested dollar comes back as: `winMult` on a win, between 2x and 4x
(the longer the odds, the higher), and `settleMult` on a settlement, never below
1.25x, so a settlement always returns more than went in. A loss returns nothing.
The award a win implies is `goal × winMult ÷ 41%`, which keeps the multiples
consistent with the split ribbon. The fan, the invest sheet and the portfolio
show each gain as a percentage on top of what was put in.

## Discussion

The discussion sits third on the case page, not behind a tab, and a rolling
highlight above it puts one real voice on screen within a second of arriving.

- Every case ships with a seeded thread in `SEED_COMMENTS`: people backing it,
  people asking, people pushing back, and the legal team answering in public.
- Commenters tag a comment **Support**, **Question** or **Sceptical**, and the
  **community pulse** shows the split as a crowd of ticks rather than a bar.
- The **Community Score** is a five-point rating with an optional review, combined
  into one number the way a review site works.

Stance tags and ratings are kept in the browser for the demo, because the shipped
`supabase/schema.sql` has no column for either. Add `stance` to `comments` and a
`ratings` table before this is real; `addComment()` marks the spot.

## FAQ

Two lists of questions. Each question is a row that opens to its answer, built
on `<details>`, so a tap, a click or the keyboard all work with no script.

- **The platform's**, at the foot of Cases, with an **FAQ** button beside the
  page title that scrolls down to it. Seven questions on how investing works on
  every case: donation or investment, whether money moves today, the lock-in,
  where an award goes, how cases are chosen, what the two scores mean, and who
  runs the case. A case page opens the same list as a sheet, so nobody loses
  their place.
- **Each case's**, between Team and Detail, with its own chip in the section
  rail. It starts with the case's biggest risk (the factor that takes most off
  its chance to win, and its chance of losing, linked to the breakdown) and ends
  with when the money comes back (end year, stage, no early withdrawals). In
  between are the questions written for that case: `faq` in `data.js`, as
  `[question, answer]` pairs, edited in the admin under Details.

No figure is typed into an answer. The split comes from `SPLIT`, the return and
lock-in ranges from the live cases, and a case's risk and dates from its own
factors and stages, so an answer can never disagree with the screen it sits on.
Write a case's own questions the same way: what people ask about that case,
answered in a sentence or two, leaving out the chances, returns and dates the
page works out. An edited copy of a demo case saved before `faq` existed has no
questions of its own until some are added in the admin.

## The clip feed

There is one clip feed and it is used twice: as the Watch tab, holding every
clip on the platform, and as the full-screen player that opens from a case,
holding that case's clips. Same markup, same activation rules, so a clip
behaves the same wherever it is met — one per screen, scroll-snapped, and
only the one on screen is playing.

Watch opens on the filmed clips, in order, because people speaking is what
someone arriving should meet first. Behind them the rest is dealt round by
round — every case's hero clip, then every case's first clip, and so on — so
two reels from the same case are never adjacent. Tapping a clip card or a timeline clip opens the player on that clip
with the rest of the case's clips above and below it, which is the point —
nothing has to be closed to watch the next one. Escape closes it, arrow keys
step through it, and on a laptop it is the centred 9:16 column with the action
rail beside it.

A clip is one of three things and the feed does not care which: a file this
repo serves, somebody else's player, or no file yet, which plays as the case
photograph under its beats.

Three things make an embedded player behave like a native clip rather than a
box dropped into the page:

- **One at a time.** An embed mounts when its reel becomes active and is torn
  down when it leaves, so a feed of thirty-odd clips never holds thirty
  iframes. Activation also clears any other live player, because a scroll that
  outruns the observer must not leave one going off screen.
- **The swipe stays ours.** The iframe is pointer-transparent. A publisher's
  controls would swallow a vertical drag, and the drag is how you reach the
  next clip.
- **Sound is on, and turning it on never stops the video.** A clip is only
  ever *mounted* muted: asking a browser to autoplay with sound is asking to
  be refused, and the player comes back paused behind an iframe we
  deliberately made pointer-transparent, which is to say dead. Sound is turned
  on afterwards, on a player that is already running, through YouTube's
  IFrame API — no reload. Audio needs a gesture before any browser lets it
  through, so "on by default" means on from the first time the person touches
  the page, and on for every clip after that. Tapping a clip pauses and
  resumes it, so there is always a way back to playing.

  If the IFrame API never loads, the clips still play, muted, and the sound
  button says so rather than killing the video to prove a point.

## Clips and photographs

Each case has several short vertical clips in `clips[]`, tied to timeline
milestones, plus the 60-second hero clip.

- Give a clip a `src` (a video file or URL) and optionally a `poster`, and it
  plays in the same frame with the progress bar and captions following the
  video's clock instead of the beat timer. Nothing else has to change.
- Until then each clip plays as an animated caption card built from its `beats`,
  so the section is fully laid out and ready for the files.
- `hero.src` on each case points at a stock photograph. Every photograph on the
  site sits on top of generated artwork in the case's colour, and removes itself
  if it fails to load, so a dead URL or a flight with no wifi shows intentional
  artwork rather than a broken image. Replace these with licensed photography
  before this goes in front of the public.
- A clip without a file is not a blank card. It plays the case photograph on a
  slow push-in, under grain and a vignette, with the beats set over it, so the
  rail reads as a clip reel while the real ones are being shot. The five clips
  on a case are each framed differently so the rail does not look like one
  still repeated.

**maple-evictions plays real video in every slot.** Its hero clip is a
rendered MP4 in `clips/`, made from the case's own beats by
`tools/render-clips.js`; its five short clips are embedded YouTube explainers
on tenant rights, good-cause eviction and what happens at a hearing, credited
on the card and tied back to the case in the viewer.

That split is the point. A clip carries either a `src`, which is a file this
repo serves, or an `embed`, which is the publisher's own player. Footage under
licence is not ours to host whatever a demo is for, so it is embedded; our own
clips are hosted. `clips/README.md` covers both, plus encoding and how to frame
footage so the app's furniture does not sit on it.

Two things to know when testing video locally: Playwright's bundled Chromium
has no H.264 decoder, so an MP4 silently fails there and the clip falls back
to its card, and Python's `http.server` does not serve byte ranges, which
media playback needs. Every shipping browser plays these files, and Vercel
serves ranges.

A clip that has a video does not draw the beat captions over it: real footage
carries its own words. The beats stay in the data as the written version.

## The admin

`/admin` is the internal side: the same domain, linked from nowhere, behind a
sign-in. It is where cases, clips and video go in.

- **Overview**: live cases, clips still waiting for video, the latest pledges and comments
- **Analytics**: what draws investment, what moved it and what to try next, for the platform and for each case. See *The analytics page* below
- **Cases**: every case, demo and new. The editor covers everything the case page
  shows, with the site's own score dial, waterfall, bloom and runway redrawn as
  you type, and a Raw data tab for anything the form does not cover
- **Clips & video**: every clip on the platform. Upload vertical video straight
  from the browser, or paste a YouTube, Shorts or Vimeo link. The length and a
  poster frame are read from the file, and the case saves the moment the upload
  lands. Uploaded footage leads the Watch feed
- **Media library**, **Pledges** (with real names and notes, and a CSV export),
  **Comments** (delete from the site), **Team** (who can sign in)

How it fits together:

- Cases written in the admin live in the `cases` table, each row holding a case
  in exactly the shape of a `CASES` entry. `published` puts it on the site,
  replacing a demo case with the same id; `hidden` takes it off; `draft` is
  admin only. Editing a demo case saves a copy that replaces it, and "Revert to
  demo data" deletes the copy.
- The site loads `cms.js` in place of `app.js`. It asks for the live rows, folds
  them into `CASES`, then starts the app. If Supabase is slow or down the site
  starts on the demo data after 2.5 seconds.
- Video and photos go to the public `media` storage bucket. Supabase's free plan
  caps a single file at 50 MB, which is plenty for a minute of 720p vertical video.
- Access is the `admins` table, checked by the database on every write through
  `is_admin()`, so the hidden URL is not the lock. A leaked link opens a sign-in
  screen, and a signed-in stranger still cannot change anything.
- Logins involve no email at all. On Team, adding an email with a password
  creates a login that works at once, and any admin can set a new password for
  any other admin, which is how a forgotten password is fixed. An email that
  already has its own site account just gets access and keeps its password, so
  a backer's account can't be taken over from there. `admin_set_login()` and
  `admin_team()` in the database do this. Supabase's own reset emails aren't used:
  its built-in mailer only reaches the Supabase project's own team members.
- `/#case=<id>` on the site opens a case directly, which is what "View on site" uses.

## The simulation

`/sim` is LaunchJustice Live: a ten-minute, timed simulation of investing in
litigation, for walking investors through the product by using it. It gets
1,000 credits and three fictional cases (a hazardous-waste plant next to a
school, race-based lung testing, and Medicaid claims data sold to target drug
ads) and plays four years of interviews, depositions, rulings and a verdict
on a clock. The investor funds rounds, adds more by buying out leaving
backers, sells to the waitlist, and finishes ranked against 2,000 simulated
investors.

It shares the site's `styles.css`, `data.js` and `viz.js` and adds its own
files in `sim/`. It writes nothing to Supabase and tracks nothing, so it can
never touch real pledges or the analytics. `sim/README.md` covers presenting,
editing the story, and putting real clips on each moment.

## Analytics tracking

The site records what people open, watch and back in the `events` table, so
the admin can show which cases and clips are actually holding attention.
`track.js` queues rows and sends them in batches: every four seconds while
there is something to send, and again when the tab is hidden or the page
closes, using `keepalive` so the last batch outlives the page. `app.js`
decides when each row is written. With no Supabase in `config.js`, nothing is
recorded and nothing breaks.

| Kind | Written when | Fields |
| --- | --- | --- |
| `case_view` | a case page is opened by a person. Redrawing the case already open, after a rating or back from the score breakdown, is not a view | `via`: `cases`, `trending`, `watch`, `player`, `mine`, `link` or `other`; `clip` when opened from a reel |
| `case_time` | the person leaves that case: another case, another tab, or the page closing. Counts only while the case or its score breakdown is on screen and the browser tab is visible, never under the clip player. Under a second is dropped; capped at an hour | `seconds` |
| `clip_watch` | a reel stops being the one on screen: scrolled past, the feed paused for another tab or a sheet, the player closed, or the page closing. Counts only while the clip is playing, so not after a tap to pause and not in a hidden tab. An embedded player has no clock to read, so it counts while it is mounted. Under a second is dropped | `clip`, `via` (`watch` or `player`), `seconds`, and `pct`: seconds over the clip's length, capped at 1 even when it loops |
| `invest_open` | the invest sheet is opened. Coming back to it from "how the split works" is not a new one | `via`: `case`, `watch`, `player` or `other`; `clip` from a reel |
| `share` | the share button on a reel is used | `via`, `clip` |

`clip` is `hero` for a case's own 60-second clip, otherwise the clip's `id`.
Every row carries the same `actor_id` as pledges and comments, `d:<random>`
for a browser and `u:<uuid>` for an account, and nothing else about the
person. The browser can only insert into `events`: no reads, edits or
deletes, and only the publishable key is sent.

## The analytics page

`/admin/#/analytics`, and `/admin/#/analytics/<case>` for one case. It is built
to say why money moves, not only how much: what goes with people investing,
what moved money and attention and when, and what to try next. One row of
filters scopes everything: 7, 30 or 90 days or all time, compared with the
period before.

- **The money, taken apart**: invested = visitors × invest rate × average
  investment, which is exact, so the row says which of the three moved the
  money ("▲37%, mostly more visitors"). Buzz and time spent sit beside it.
- **AI analyst (preview)**: the findings in words, each with its numbers and
  something to try. Investment follows chance to win and counsel's record, not
  time spent or social impact; news brings crowds that rarely invest; a case
  people watch but don't back, and why; which cases are gaining on their own
  news and which have gone quiet; what doubters ask about.
- **What draws investment**: every factor against three outcomes across the
  live cases: does it bring visitors, does it turn them into investors, does it
  make investments bigger. The factors are the meeting's three families plus
  attention: chance to win, how similar cases did and counsel's record
  (historical performance), expected return and lock-in (financial), social
  impact, buzz and a supportive discussion (public sentiment), and time spent.
  Pick a cell to plot that pair case by case.
- **What moved, and why**: buzz, visitors and money over the same days, stacked
  by issue, with every spike marked and named with its cause: the case's own
  news (a ruling, talks, a hearing), press about the case, news about the issue,
  or, when nothing is on record, the source that brought the extra visitors and
  the clip behind them. Each spike says whether its visitors invested at the
  usual rate.
- **Attention against money, by issue**: each issue's share of the time spent
  against its share of the money, and **where case visits come from**
- **Cases**: the leaderboard, with chance to win and social impact beside the
  money, and what is moving each case under its 14-day trend
- **Backers**: which issues the same people back, strongest pairings first,
  and **what the discussion is about**: themes in comments by backers against
  everyone else, and the questions still waiting for an answer from counsel
- **Clips**, **where viewers stop**, **from clip to investment**, and a **live
  feed** of real events

One case on its own adds its scores, its own analyst reading, how it compares
with every other case on each measure and factor, money raised against its goal
with the recent pace projected, what moved it, and its discussion. Every chart
has a Table button with the same numbers.

How the readings are worked out, all in `admin/analytics-data.js`:

- `drivers()` ranks cases by each factor and by each outcome and correlates the
  ranks (Spearman), over cases with 50 or more visitors in the period. With six
  cases that is a direction to test, not proof, and the page says so.
- `spikes()` marks a day hot at 1.8 times the median of its 28 days before (or
  twice the usual money), joins hot days into spikes of up to two weeks, and
  looks for the cause: an event of the case's from three days before to the
  end, a jump in buzz, or the visit source that grew most.
- `backing()` reads who backs what from `admin_pledges()`, by `actor_id`.
- `discussion()` tags comments with themes by keyword. It is the part a language
  model should do once one is connected.
- `analyst()` writes the findings by rule from all of the above. **The AI is a
  preview**: no model is called and no key is needed. Connecting one means
  sending the same inputs (plain data) and rendering a reply in the same shape,
  `{headline, findings: [{tone, caseId, title, why, act}]}`.

**Demo history.** The platform has few real users yet, so `admin/analytics-data.js`
builds a believable daily history for every case from listing day to today, out
of the case's own numbers: it adds up exactly to `baseRaised` and `baseBackers`,
the last week matches the trending badge ("+4,106 backers this week"), and each
demo case has a story (maple-evictions went viral, farmworker-wages is the slow
burner, school-facial-rec is watched but not funded). Each story is a dated list
of events, the case's own (the FOIA production, the filing, the court's pause,
mediation) and the news (coverage of the case, or of its issue, such as the
heat wave that put farmworkers in the headlines), which is what the page names
as causes. News brings visitors who invest at a falling rate; a case's own news
brings backers. Buzz is demo-only too: it is what a news and social listening
service would report, and with demo history off the page says it isn't
connected. Backer overlap in the demo is modelled from how alike cases are to
back, and the discussion uses the seeded threads.

Real tracked activity, real pledges and real comments are added on top, the
same way the site adds real pledges to `baseRaised`. Untick **Include demo
history** to see real activity only, which is how to check tracking works. The
history is seeded per case, so it is the same on every load.

Real activity reaches the page through `admin_analytics()`, which returns daily
aggregates per case and per clip to admins only; `admin_pledges()` and the
public comments table supply who backs what and what the discussion says.

## Run locally

Open `index.html` in a browser, or run `npx serve .` and visit the printed URL.

## Phone and laptop

One codebase, three layouts, chosen by window width. Drag the Chrome window
narrower and wider, or use the device toolbar, to cross each line.

| Width | Layout |
| --- | --- |
| under 700px | Phone. Full-bleed clips, bottom tab bar, pledge opens as a bottom sheet. |
| 700–1023px | Tablet. Clips become a centred 9:16 card with the action rail beside them; cases in two columns; bottom tab bar stays. |
| 1024px and up | Laptop. Tab bar becomes a left sidebar, the feed and the full-screen player gain up/down arrows (arrow keys work too), the case page splits into story plus a sticky funding panel, and pledging opens as a centred dialog. Three case columns from 1400px. |

The clip feed stays vertical at every size — on a laptop it is a centred 9:16
card, the way TikTok looks in a desktop browser, not a stretched widescreen
video. The full-screen player follows the same rule: full-bleed on a phone, a
centred column on a laptop.

Dark mode follows the operating system setting at every size.

## Deploy on Vercel

The app is live at **https://predictive-market-eta.vercel.app**, served by the
Vercel project `predictive-market`, which is linked to this GitHub repository.

Because there is nothing on the default branch yet, Vercel's **Production
Branch** is set to the feature branch the work happens on rather than to `main`.
Every push to that branch redeploys production; a push to any other branch gets
a preview URL instead and leaves the live site alone. Check which branch is
current under Project Settings → Git before assuming a push went live.

Setting it up from scratch: push the folder to GitHub, choose **Add New →
Project** in Vercel, import the repo, keep the framework preset as **Other**,
and leave the build command empty. There is nothing to build.

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

- **Site URL** — the address the app really lives at, which is now
  `https://predictive-market-eta.vercel.app`. This is the fallback used whenever
  a link asks to return somewhere that is not on the allow-list, so it has to be
  somewhere that is always up. A new project ships with `http://localhost:3000`
  here, which is exactly what produces the refused connection.
- **Redirect URLs** — add every origin the app is opened from, each with a
  wildcard path:

      https://predictive-market-eta.vercel.app/**
      https://*-shubhampatel12012002-8127s-projects.vercel.app/**
      http://localhost:8000/**

  The second line covers Vercel's preview deployments, which get a fresh
  hostname per push and would otherwise fall back to the Site URL. The third is
  for local work, and the port has to match the one you serve from;
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

**A new provider account is usually restricted until it is approved.** Postmark,
for one, will only deliver to addresses on your own domain while approval is
pending, so a test to a gmail address fails even though everything is configured
correctly. That failure is visible: the SMTP rejection makes `/signup` fail
rather than fail silently, so the app shows an error instead of the "Confirm
your email" screen, and the auth logs carry the provider's reason. Until
approval comes through, test with an address at the sending domain.

Whether custom SMTP is really in use is easy to check in the auth logs without
sending anything. Saving SMTP settings restarts the auth service and writes a
line raising the email rate limit away from the built-in sender's tiny default:

    select timestamp, log_attributes['msg'] as msg from logs
    where source = 'auth_logs' and log_attributes['msg'] like '%RATE_LIMIT_EMAIL%'
    order by timestamp desc;

A `mail.send` line with a timestamp *earlier* than that restart came from
Supabase's built-in sender, not from yours.

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

The provider is off, so the **Continue with Google** button is not drawn at all.
A browser cannot find out whether a provider is enabled without asking for a
redirect, and asking while it is off answers 400 `provider is not enabled`,
which reaches the person as a button that does nothing useful. So the button is
behind `GOOGLE_SIGN_IN` in `config.js`, currently `false`. The sign-in code
itself is written and unchanged; the flag only decides whether it is offered.

To switch it on:

1. In Google Cloud Console, create a project and configure the OAuth consent
   screen (External, with an app name, a support email and a developer contact).
2. Create credentials of type **OAuth client ID**, application type **Web
   application**.
3. Under **Authorised redirect URIs** add exactly:

       https://aghqvulngojxdkwsrcax.supabase.co/auth/v1/callback

   This is Supabase's callback, not the app's. Google returns to Supabase, and
   Supabase then returns to whichever app address it was asked for, which is why
   the redirect URLs in step 1 have to be right as well.
4. Copy the Client ID and Client Secret into Supabase under Authentication →
   Sign In / Providers → Google, and enable the provider. Keep the secret out
   of this repository: it belongs in Supabase only.
5. Set `GOOGLE_SIGN_IN: true` in `config.js` and push.

Email sign-up works regardless of any of this.

Password reset is not built yet: someone who forgets a password needs a new
account, or a reset from the dashboard.

## Adding real video

Every clip renders from its `beats` captions until you give it a file. The hero
clip takes `video` and `poster` on the case itself; the short clips take the
same two keys on each entry in `clips[]`:

```js
{id:"asylum-backlog", cat:"immigration",
 video:"clips/asylum-hero.mp4", poster:"clips/asylum-hero.jpg",
 clips:[
   {id:"a1", title:"Meet Maria", milestone:0, secs:58,
    src:"clips/asylum-maria.mp4", poster:"clips/asylum-maria.jpg", beats:[...]},
 ], ...}
```

The file then plays muted, looping and inline in the same frame, and the
progress bar and captions follow the video's clock instead of the beat timer.
Shoot vertical: the frame is 9:16 and anything else gets cropped to fill. Clips
with and without a file can sit in the same rail, and `milestone` is the index
into `timeline[]` that decides which case milestone a clip is offered from.

## Notes on the demo

- Charts draw themselves when they first scroll into view, and draw finished
  with no animation when the operating system asks for reduced motion.
- Nothing is loaded from a chart library or an animation framework. The charts
  are inline SVG built in `viz.js`, animated with CSS and the Web Animations
  API, so the site works with no network beyond the page itself.
- Ratings and likes on seeded comments are per-browser. Real comments, pledges
  and likes go to Supabase exactly as before.
- Nothing degrades to a broken box. A photograph that will not load removes
  itself and leaves the generated artwork underneath; a video that will not
  load drops out and the clip falls back to the photograph with its captions,
  the same treatment it would have had with no file at all.

## Not in this version

No payments, KYC, or moderation. Pledges are non-binding, and the scores are a
demo model, not a prediction.
