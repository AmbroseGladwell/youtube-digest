# Tiers: what signed-out, free and paying readers can do

Decided on 6 Oct 2026 (OV-78). Four tiers, arranged to push readers towards paying:
signed out is a taste, a free account is the whole product in small amounts, and the two
paid plans sell volume. **Plus** sells overviews on our key. **BYO Plus** is cheaper, and
sells many more overviews on the reader's own key. This file records the shape of each
tier, and why. The numbers are provisional until OV-92 prices an overview and OV-19 decides
how much of one is personal. The shape is not provisional.

## The decision underneath: generation goes through our server

**A reader with no key of their own generates on ours, through our server, and the server
counts it.** This reverses two lines in `v1-architecture-decisions.md`: "Free tier is fully
local" and "Generation stays BYO-key at every tier, for now". Both said they could be
revisited, and the reason to revisit them is that a limit has to hold. A count kept on the
device is reset by clearing site data or opening a private window. Only a count the
server keeps survives that, and the server can only count what passes through it.

**Bringing your own key stays, at every tier, but an account's own-key overviews are
counted too.** An overview on the reader's own key costs us no generation, but it isn't free
to us once there is an account. It is synced and stored, its narration renders on our TTS
pool, its transcript may come through our proxy, and the MCP connection serves it. That
running cost is what BYO Plus pays for.

This is how Model F (`architecture-options.md`) arrives: as a tier feature beside Model D,
rather than replacing it.

## The tiers

| | Signed out | Free account | BYO Plus | Plus |
|---|---|---|---|---|
| Overviews on our key | 5, in total | 10 a month | 10 a month | About $2.50 of cost a month (OV-92 sets the number) |
| Overviews on your own key | Unlimited, on this device | 30 a month | 200 a month | 200 a month |
| Transcripts from our server | Part of an overview: fetched while an overview is left | Part of an overview | Part of an overview | Part of an overview |
| Daily safety cap on those fetches (not shown to readers) | 5 per address | 50 | 100 | 100 |
| Library | This device only | Synced to every device | Synced | Synced |
| Narration, every voice | — (needs an account) | Yes | Yes | Yes |
| Sharing an overview | — (needs an account) | Yes | Yes | Yes |
| MCP connection | — (needs an account) | Yes | Yes | Yes |
| Chapters, transcript tab, personalisation | Yes | Yes | Yes | Yes |
| Extension, playlists | Yes | Yes | Yes | Yes |

**The paid plans sell volume, never features.** A free account has every feature, so a
free reader sees the whole value of the product, including their library in Claude and
other assistants through the MCP connection. What they run out of is overviews. **BYO Plus
costs less than Plus** because we don't pay for its generation. Prices are OV-18's, with the
guidance below.

**No account says "unlimited".** Every overview on an account costs us something, so every
plan has a number, and the app shows it with its reset date. Only signed out, where nothing
reaches our server, is the own key uncounted.

## What an own-key overview costs us

Measured, not estimated, in the docs each line cites:

| Cost | Figure | Source |
|---|---|---|
| Rendering narration | about $0.002 to $0.003 a render, and each voice is its own render | `tts-pre-rendered-speech.md` |
| Storing the audio | about 0.7 MB an overview on R2, kept for as long as the overview | `tts-pre-rendered-speech.md` |
| A transcript through the proxy | about $0.0004 a fetch, and only when every earlier rung failed | `server-side-transcripts.md` |
| The overview record | a few KB in Postgres | |
| The YouTube Data API | not money: a shared daily allowance across every reader | `playlists.md` |

That is about half a cent an overview at worst, so 200 a month costs us at most about $1.
**Narration for an own-key overview renders only when it is first played,** never in
advance, so the cost follows what readers listen to rather than what they make. A cap on
narration renders per account per day stops one account rendering a whole library in every
voice. The transcript proxy's global cap and OV-95's playlist caps stay as they are.

**Plus's allowance on our key is set from what an overview costs.** It isn't fixed first and
then priced. OV-92 measures an overview on the model we choose, and Plus gets as many as
about $2.50 a month buys. On a cheap model that may be 100. On a frontier model it may be
50.

## Price guidance

The prices are OV-18's to set. This is the reasoning OV-78 hands it.

- **The going rate is about $10 a month.** Recall Plus is $10, NoteGPT Pro $9 to $9.99, and
  Eightify $9.99 or $59.99 a year (searched 6 Oct 2026). Each covers more than YouTube, or
  sells unlimited summaries, and each is better known.
- **Start at about half that.** Plus at about $5 a month or $48 a year. BYO Plus at about
  $2 to $3 a month or $24 a year, since a reader who brings a key already pays a provider
  monthly. Bring-your-own-key apps tend to charge for the app, not the compute: TypingMind is
  a one-off $39 to $99.
- **The margin at these numbers is thin,** and that is deliberate as a starting point,
  not settled: Plus at $5 against up to $3.50 of cost leaves little after payment fees.
  Pricing is still being worked on in OV-18.
- **No lifetime licence.** Storage, renders and sync cost us every month, for good.
- **A launch price, kept for the readers who take it.** Starting low doesn't mean staying
  low. Early readers keep their price when it rises.
- **Raise it on evidence.** If readers stay and use it weekly (PostHog), the narrower
  product with the blunt verdict, narration, playlists and MCP earns a higher price.

**Sync, narration with every voice, and the MCP connection belong to the free account.**
They are what makes signing up worth doing. Their cost to us follows the number of
overviews, and that number is limited on Free. One voice costs the same to render as
another, so there is nothing to sell in the voice picker. Plus copy said Plus syncs, while
the server has given sync to every account since it was built. The code was right and the
copy was wrong (`plusFeatures.ts`). The MCP connection is gated on Plus today
(`mcp-connector.md`). That gate goes.

**Signed out, your own key is unlimited,** as it is today: generation runs on the device,
the library stays on the device, and none of our running costs apply. Our server fetches
transcripts only for the trial's overviews, so an own-key overview signed out needs the
extension or the shared cache. Signing up does put a monthly count on own-key use, in
exchange for sync, narration and the MCP connection, which are what the count pays for.

**Chapters, the transcript tab and personalisation are parts of an overview,** not
features beside it. They come with every overview at every tier. Gating them would mean
making a worse overview for the same cost.

**Playlists stay open to everyone (OV-27).** A capture from a followed playlist counts
against the matching quota like any other overview: on our key or on the reader's own. On
an uncounted own key, OV-95's caps apply.

## Counting

- **The server counts, never a model** (`docs/prototype/constraints.md`), in Postgres. The
  count is never kept in memory, because a deploy resetting a budget would spend real money
  twice (`server-side-transcripts.md`, "Limits").
- **Two counters per account:** overviews on our key, and overviews on the reader's own
  key. They are separate quotas, so running out of one leaves the other.
- **An overview counts once, when it succeeds.** A failed generation is not counted.
  Regenerating counts again, because it costs the same again. A generation reserves a slot
  first and releases it on failure, like the proxied fetches.
- **An own-key overview on an account reserves its slot from the server too,** before the
  device generates. The device can skip asking. A sync push of a new overview with no
  reservation is refused, so a skipped reservation buys an overview that never leaves the
  device. That is the signed-out experience, which is free anyway.
- **Months are UTC calendar months.** The reset date shown to the reader is the first of
  the next month.
- **Accounts count against the account,** read beside `accounts.plan` the way the MCP
  connection and the transcript quota already do. `Plan` gains `byo-plus`.
- **The signed-out trial counts against a token the server issues** to the device on its
  first generation on our key. It has its own counter. It is never the no-account library's
  contents, because OV-47 empties that library into the account on sign-in, which would
  reset the trial every time. A private window mints a new token, so the trial can be
  reset. It is small enough that this is acceptable. A cap on new tokens per address per
  day (stored as a truncated hash, like the transcript quota) stops one machine minting
  tokens without limit.
- **Signing in doesn't carry a trial's count over.** The free account starts its own
  month. Its first 10 are the reason to sign up. A no-account library moved in on sign-in
  (OV-47) is not counted against the month: those overviews already exist.
- **A global daily cap on our key** sits behind every tier, the way
  `TRANSCRIPT_PROXY_DAILY_FETCHES` sits behind the proxy. When it is spent, generation on our
  key says so plainly and points to adding a key. It doesn't fail with a generic error.
- **Transcripts from our server are part of an overview, not a quota of their own**
  (decided 6 Oct 2026, OV-107). A fetch is allowed while the reader has an overview left: on
  either key this month for an account, or in the trial when signed out. Readers only ever
  see the overview count. Behind that sits a daily safety cap per caller, 5 per signed-out
  address, 50 per free account, 100 per Plus or BYO Plus account, which protects our
  address's standing with YouTube rather than our money and logs a warning when reached.
  Until OV-102 and OV-103 count overviews, the safety cap is the only gate
  (`server-side-transcripts.md`, "Limits").

## At the limit

Following "degrade visibly", the reader is told what ran out, when it comes back, and the
ways around it. Nothing they already have stops working.

- **Signed out, after 5 on our key:** *Sign up to keep going: a free account makes 10 a
  month, syncs them to your other devices, and reads them aloud.* Or add your own key. The
  on-device library stays readable, and moves into the account on sign-in (OV-47).
- **Free, after 10 on our key this month:** *You've made this month's 10. More on
  1 November.* Plus makes more, or use your own key.
- **Free, after 30 on your own key this month:** the same, with BYO Plus's 200 a
  month as the upgrade.
- **BYO Plus, after 10 on our key:** the own key carries on, and Plus is the upgrade.
- **Plus, after its allowance on our key:** the own key carries on.
- **Either paid plan, after 200 on the own key:** *More on 1 November.* There is no
  upgrade to offer, and the message doesn't pretend there is.
- Reading, listening, sync, sharing and the MCP connection keep working at every limit.
- **Queued captures** (playlists, the capture queue) wait at the limit and say why. They
  don't fail. They resume when the month turns, or when the reader adds a key or upgrades.
  The same waiting state, with a different reason and resume time, is what the queue shows
  at our server's daily safety cap (`docs/features/capture-queue.md`, "Waiting at a limit").

## Not decided here

- **The prices of Plus and BYO Plus,** and whether either has a trial: OV-18.
- **Which model generates on our key,** and so what an overview costs us: OV-92. If
  the cost turns out different, the numbers change. The shape doesn't.
- **Shared analysis across readers:** OV-19. If one objective analysis per video is cached,
  a popular video gets cheaper. The quotas still count overviews made, not tokens spent,
  because a reader can't see or predict tokens.
- **The numbers against real use.** Before billing ships, check overviews per reader per
  week in PostHog (`analytics.md`). The prototype's one heavy reader made about 30 in a
  week, about 120 a month: more than either Free quota and inside 200 on the reader's own key.

## Grandfathering

There is nothing to grandfather yet, because nobody pays. Accounts that exist today have
uncounted own-key use, and it becomes counted at 30 a month on Free when the counting ships.
Whether they get notice first is decided then.
