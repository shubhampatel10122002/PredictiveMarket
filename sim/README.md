# LaunchJustice Live

A ten-minute simulation of investing in litigation, for putting in front of
investors. It runs at `/sim` on the same deployment as the site, the way the
admin runs at `/admin`, and shares the site's code: `styles.css` for the
buttons, the sheets and the clip player, `viz.js` for the clip artwork and
number formatting, `data.js` for the case categories.

The investor gets 1,000 credits and three cases. Four years of litigation
play out in ten minutes: interviews, filings, depositions, rulings, a jury.
Every moment moves the odds and the price of a stake, and the investor
decides what to do about it.

Everything in it is fictional and scripted: the cases, the people, the
companies and every number. Nothing is written to the database and nothing
is tracked. One investor, no account: the run lives in that browser, so a
refresh carries on where it was, paused.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell. Loads the site's `styles.css`, `data.js` and `viz.js`, then these three |
| `scenario.js` | The script: the three cases, what happens to them and when, the six simulated investors |
| `engine.js` | The arithmetic: funding, prices, trades, payouts, the leaderboard and the crowd. No DOM, so it also runs in Node |
| `sim.js` | The clock, the screens and the person playing |
| `sim.css` | The investor-facing look: the header, the clock bar, the cases table, the news, the breaking card, charts, results |

## The look

It is built for an investor who has ten minutes, so it looks like what they
already use rather than like the site. It is light whatever the laptop is
set to (`index.html` pins `data-theme="light"`). A header carries three tabs,
Cases, Portfolio and Results, with the account value and cash at the right.
The cases are a table, the way a brokerage lists stocks: price, its move
since funding, win chance, your position, Buy and Sell. A case's page reads
like a quote page: the price and its chart, key stats, the outcomes and what
each pays, and a position panel beside them. Navy is for actions; green and
red only for money going up and down.

Words are kept short on purpose: an event is a headline and a sentence or
two, and a case's long background is folded under "Background".

## How a run goes

1. **Funding.** Every case must raise its whole litigation budget before it
   starts. The investor can put credits in at 1× while a round is open, even
   before the clock starts. The drug-data round fills in under a minute; the
   waste plant's in a minute and a half; the lung-test round stalls 300
   credits short so the investor can close it themselves. If nobody does, an
   anchor backer takes the rest at 2:20.
2. **The case runs.** Once a round is full, stakes trade. A big moment
   slides in as a breaking card with its clip, what it did to the chance to
   win, and what it did to the price. Minor ones go to the news list.
3. **Buying later, getting out.** A funded case takes no new money, so Buy
   on it buys out a backer who wants to leave, at the market price. Selling
   goes to someone on the waitlist at the market price less a 10% early-exit
   discount. Both are labelled as a preview of the planned exchange.
4. **Endings.** Each case ends differently on purpose. The drug-data case had
   the most hype and the lowest odds, and loses: stakes pay nothing, though
   the Attorney General picks up its record. The lung case settles at 1.7×.
   The waste plant rejects a settlement, goes to trial and wins 3.2×.
5. **Results.** Final credits, a rank among 2,000 simulated investors, the
   leaderboard, the investor's best and worst calls, and what their credits
   changed in the world.

## What a stake is worth

A stake is priced at what it is expected to pay, moved by the crowd:

    price = (chance of a win × what a win pays + chance of a settlement × what it pays)
            × (1 + mood) × (1 + noise)

The odds come from the script, event by event, and ease into the price over
a few seconds. Mood is how the crowd took the latest news: it jumps with the
event and fades with a 45-second half-life, which is how a stake can run hot
after a headline and drift back. A case's page says so when it does
("26% above fair value"; fair value is what the odds alone say). Noise is a
small fixed wobble, the same
on every run. When a case ends, the price is simply its payout.

The six simulated investors on the leaderboard, and the 2,000 the result is
ranked against, run through exactly the same functions as the person
playing. None of them know how a case ends.

## Presenting

The clock only moves while it is playing. The bar across the top has play,
the date in the story, the time left, a timeline of everything so far (click
a mark to replay that moment), the speed, skip-ahead and settings.

| Key | Does |
| --- | --- |
| Space | Play or pause |
| N or → | Skip to the next event |
| 1, 2, 4 | Run at 1×, 2× or 4×. 0 is half speed |
| C, P | Cases, portfolio |
| Esc | Close whatever is open |

Settings (the gear) choose the run length (20, 10, 5 or 2½ minutes), whether
the clock stops for each big moment until Continue is pressed (off by
default), and whether it holds while a clip is watched full screen (on by
default, so watching never costs anyone a ruling).

Nothing moves under the pointer while the clock runs. Each row of the cases
table keeps its size whatever it shows, so Buy and Sell stay put, and every
page ends with enough room to scroll its last buttons above the breaking
card. On a case page the breaking card comes in on the left, clear of the
position panel. After a trade nothing keeps focus, so the next Space plays
the clock rather than reopening the order ticket.

URL flags:

| Flag | Does |
| --- | --- |
| `?reset` | Start over from nothing |
| `?speed=2` | Start at a speed |
| `?jump=300` | Start paused at that second, everything before it already played |
| `?autoplay` | Start the clock as the page opens |
| `?noclips` | Show clip stills but never load a player |
| `#case=lakeshore` | Open on a case |

## Editing the story

Everything is in `scenario.js`, and nothing else holds any story. Each event
has a time, a case, a tag (Client interview, Deposition, Ruling...), a title
and body, and optionally new odds, a crowd mood, a stage, an impact line, or
`end: "win" | "settle" | "lose"`. `major: true` makes it a breaking card.
Times are seconds in a ten-minute run; the calendar turns them into dates.

To check a change, run the engine headless:

```js
// node -e '...' after loading data.js, sim/scenario.js and sim/engine.js
const m = SimEngine.compile(SCENARIO);
SimEngine.priceAt(m, "eastbrook", 300, m.cases.eastbrook.crowdFundedAt);
SimEngine.runPlan(m, [[1, "eastbrook", "in", 1000]]).value;   // 3200
```

## Clips

Every moment plays a clip. Until each one has its own, they borrow the five
YouTube Shorts already on the site (the housing case's), in turn, so no two
big moments in a row share one. To give a moment its real clip, add its link
to the event in `scenario.js`:

```js
{t:320, c:"eastbrook", tag:"Deposition", major:true,
 embed:"https://www.youtube.com/shorts/VIDEO_ID", ...}
```

`/shorts/`, `/embed/` and `watch?v=` links all work. A clip starts muted in
the breaking card, because browsers refuse sound until the page has been
touched; "Tap for sound" turns it on without reloading it, and opening it
full screen plays it with sound.

## Not in this

No accounts, no payments, no real cases, nothing saved anywhere but the
browser. The exchange (buying from leaving backers, selling to the waitlist)
is not a feature of the site today; the simulation shows how it could work.
