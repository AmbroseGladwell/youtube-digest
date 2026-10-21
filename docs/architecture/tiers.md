# Tiers: what signed-out, free and paying readers can do

Decided on 6 Oct 2026 (OV-78). Which key an overview uses was added on 15 Oct 2026, and the
allowances on our key and the launch prices on 18 Oct 2026. Free's own-key quota went from 30 to
10 a month on 20 Oct 2026, and signed out became 3 overviews in total, on any key, the same
day. Four tiers, arranged to push readers towards paying:
signed out is a taste, a free account is the whole product in small amounts, and the two
paid plans sell volume. **Plus** sells overviews on our key. **BYO Plus** is cheaper, and
sells many more overviews on the reader's own key. This file records the shape of each
tier, and why. OV-19 decided how much of an overview is personal (`cost-model.md`), which
lowers what a shared video costs but not the allowances. OV-92
chose the model for our key, GPT-6.1 Sol, and priced an overview on it: about $0.033 per 20
minutes of video (`model-comparison.md`). The shape is not provisional.

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
| Price a month (launch, 18 Oct 2026) | free | free | £4.99 | £7.99 |
| Overviews on our key | 3 in total, on either key | 5 a month | 10 a month | 50 a month |
| Overviews on your own key | (within the 3) | 10 a month | 200 a month | 200 a month |
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
plan has a number, and the app shows it with its reset date. Signed out has a number too,
the trial's 3.

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

**The allowances on our key were set on 18 Oct 2026, from what an overview costs.** OV-92
chose GPT-6.1 Sol, at a mean of $0.038 an overview over its 20 real videos (about $0.033
per 20 minutes of video, `model-comparison.md`). At that price:

| | On our key | Generation if every one is used |
|---|---|---|
| Free | 5 a month, down from 10 | $0.19 |
| BYO Plus | 10 a month | $0.38 |
| Plus | 50 a month | $1.90 |

**Free went from 10 to 5** because the allowance barely changes what a typical free reader
costs, about 4 overviews a month, but it halves what the heaviest free readers can cost. In
the tier economics model, at 1,000 accounts with 5% on Plus, that cut the worst case by
about $190 a month. Plus's 50 sits inside the $2.50 a month it was sized to.

**Free's own-key quota went from 30 to 10 a month on 20 Oct 2026,** so a free account makes
15 a month in all rather than 35. The reason is the upgrade, not the cost: an own-key
overview costs us half a cent at worst, but 35 a month covered a regular reader with room
to spare, and nothing pushed them towards a paid plan. At 15, a reader who uses it every few
days meets the limit, and BYO Plus's 200 is the obvious next step.

## Price guidance

**Launch prices, set 18 Oct 2026, and expected to change: BYO Plus at £4.99 a month and
Plus at £7.99.** OV-18 builds the billing. The reasoning OV-78 handed it is below, and the
prices land above it: the margin it called thin is not thin at these prices.

**Payments go through Stripe Managed Payments, with Paddle as the fallback** (decided
19 Oct 2026), to keep tax hands-off. Either one is the seller of record: it charges the right
VAT or sales tax in every country and files every return. Stripe Managed Payments takes 3.5%
a transaction on top of Stripe's usual 1.5% + 20p and 0.7% for Billing; Paddle takes 5% + 50¢.
The cost of either is that VAT comes out of **every** sale, UK ones included, even below the
£90,000 a year at which we would otherwise have to register. The price the reader sees is the
final price, tax included, and it doesn't change if we cross that threshold.

Stripe Managed Payments wins on three counts. It keeps a little more of each sale. It has no
minimum order, where Paddle asks for bespoke pricing on orders under $10, and BYO Plus at
£4.99 is about $6.60. And the subscriptions already live in Stripe if we ever register for
VAT ourselves and drop the seller of record, so nothing has to migrate. Its catch is that
Stripe reviews the business before approving it, so OV-18 applies early and falls back to
Paddle if refused. Lemon Squeezy was ruled out because Stripe bought it and is moving its
customers onto Stripe Managed Payments; Creem and Dodo are smaller and save pennies at most.

**What a subscriber brings in a month,** against what they cost if every allowance is used:

| | Price | Stripe Managed Payments | Paddle | Stripe, not registered | Cost at the cap |
|---|---|---|---|---|---|
| BYO Plus | £4.99 | **£3.67** | £3.53 | £4.68 | about £0.70 |
| Plus | £7.99 | **£6.00** | £5.88 | £7.61 | about £1.95 |

Costs are billed in dollars and converted at $1.33 to the pound (September 2026). These fees
come from the providers' published rates, and get confirmed on their own pricing pages when
OV-18 signs up.

**Where it breaks even, through Stripe Managed Payments.** In the tier economics model, at
1,000 accounts with typical use:
- With 5% on Plus and 2% on BYO Plus, the tiers make about £160 a month. Each Plus
  subscriber covers nearly 30 free accounts and each BYO Plus about 20, and a free account
  costs about £0.17 a month, its share of the servers included.
- They break even at about **2% on Plus** with 2% on BYO Plus, or 2.7% with 1% on BYO Plus.
- If every account used every overview it is allowed, break-even rises to about 5 to 6% on
  Plus.
- Through Paddle, every one of these moves by less than a tenth of a percentage point.

These figures rest on assumed usage and estimated server costs, so they get rechecked once
PostHog shows real use.

The guidance OV-78 gave, which the launch prices were set against:

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
copy was wrong. The MCP connection was gated on Plus. **OV-104 took that gate out and
rewrote the copy to sell volume** (`mcp-connector.md`, `plus-upsell.md`); what is still to
come is showing a reader their own counts, which waits on OV-102 and OV-103.

**Signed out is 3 overviews in total, on either key, then a prompt to create an account**
(decided 20 Oct 2026). Until then an own key was unlimited signed out, which meant a reader
with a key gave up volume by signing up: 30, then 10, a month on Free against no limit at
all. Signed out is now a taste of the product, and the account is where it continues. An
own-key overview signed out still costs us nothing, so the 3 is about the prompt, not the
money. Our server fetches transcripts only while the trial has an overview left, so an
own-key overview signed out may still need the extension or the shared cache.

**Chapters, the transcript tab and personalisation are parts of an overview,** not
features beside it. They come with every overview at every tier. Gating them would mean
making a worse overview for the same cost.

**Playlists stay open to everyone (OV-27).** A capture from a followed playlist counts
against the matching quota like any other overview: on our key or on the reader's own. On
the reader's own key, OV-95's caps apply as well.

## Which key an overview uses

Decided on 15 Oct 2026. A reader with a key of their own has two keys behind each
overview, and the order is set by what each plan sells:

| | First | Then |
|---|---|---|
| Signed out, Free, BYO Plus | the reader's own key | ours |
| **Plus** | **ours** | the reader's own key |
| No key of their own | ours | — |

**Own key first, ours last,** for everyone but Plus. It spends the reader's credit before
ours, and our allowance (5 or 10 a month, or what is left of the trial's 3) becomes the reader's safety net rather than a quota they spend
first. **Plus is the other way round** because Plus is what a reader pays for overviews on
our key. With their own key first, a Plus reader would rarely use what they paid for.

**An overview moves to the next key when the first can't make it:**
- that key's quota for the month is spent;
- the provider is down, overloaded or rate-limiting (5xx, 429), or the reader's account
  is out of credit. Providers report this differently, so the adapters classify it;
- the model's answer still breaks the schema after its retry. Our key then pays for
  another model's mistake, but this is rare except for the problem OV-119 is fixing, and a
  failed overview is worse.

**It never moves on a refused key (401, 403).** The reader sees the key problem (design
110f) and fixes it. If it fell back quietly, a broken key would go unnoticed and spend our
10 without the reader knowing why.

**The reader sees which key made it.** An overview made by falling back says so in one
quiet line ("Made on our key: your Anthropic key was out of credit"), and the count it used
goes down where the reader can see it. This follows "degrade visibly". The record carries it as
`madeOn` (overview schema 9, client version 7): which key made it and, for a fallback, the
key passed over, the reader's provider when it was theirs, and the cause (`quota-spent`,
`out-of-credit`, `provider-down`, `schema-failure`, or `busy` for our key's daily cap). It
is null for an overview made before, and for one saved from a share, and it is never in a
shared copy.

**Falling back changes where the transcript goes.** A fallback to our key sends the
transcript and the reader context through our server to OpenAI, whatever provider the
reader chose. Settings says so beside the key, and a reader can switch the fallback off
("Only ever use my key", the synced setting `onlyMyKey`). The fallback is on by default,
so the switch starts off (confirmed 21 Oct 2026): a key that runs dry keeps making
overviews, labelled, and a reader who minds where their transcripts go turns it on.

**Counting follows the key that made it.** Each attempt reserves a slot on its own
counter and releases it on failure, so a fallback counts once, on ours, and the own-key slot
it reserved first is released.

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
  device. That is the signed-out experience, which is free anyway. See "Reserving on the
  reader's own key" below.
- **Months are UTC calendar months.** The reset date shown to the reader is the first of
  the next month.
- **Accounts count against the account,** read beside `accounts.plan` the way the MCP
  connection and the transcript quota already do. `Plan` gains `byo-plus`.
- **The signed-out trial is 3 overviews on either key, counted twice.** The device counts
  every overview it makes signed out, on both keys, and offers the account at 3. Clearing
  site data resets that count, which is accepted: an own-key overview costs us nothing. The
  ones on our key are also counted by the server, against a token it issues to the device
  on its first generation on our key, so the device can never be talked into more than 3 on
  ours. The token has its own counter. It is never the no-account library's
  contents, because OV-47 empties that library into the account on sign-in, which would
  reset the trial every time. A private window mints a new token, so the trial can be
  reset. It is small enough that this is acceptable. A cap on new tokens per address per
  day (stored as a truncated hash, like the transcript quota) stops one machine minting
  tokens without limit.
- **Signing in doesn't carry a trial's count over.** The free account starts its own
  month. Its 15 a month, 5 on our key and 10 on the reader's own, are the reason to sign up. **A no-account library moved in on sign-in
  (OV-47) counts against the month,** on the key that made each overview (decided 20 Oct
  2026, reversing the first rule that moved overviews were free). Otherwise a reader at
  their cap could sign out, make the trial's 3, sign back in and repeat, clearing site data
  to reset the device's count each time. A signed-out library now holds at most 3, so a new
  reader is never short. A reader already at the cap keeps the moved overviews on the device,
  readable, and they sync when the month resets. The server can't tell a moved overview from
  a new one, so there is no "this was moved" for a modified client to claim.
- **A global daily cap on our key** sits behind every tier, the way
  `TRANSCRIPT_PROXY_DAILY_FETCHES` sits behind the proxy. When it is spent, generation on our
  key says so plainly and points to adding a key. It doesn't fail with a generic error.
- **Transcripts from our server are part of an overview, not a quota of their own**
  (decided 6 Oct 2026, OV-107). A fetch is allowed while the reader has an overview left: on
  either key this month for an account, or in the trial when signed out. Readers only ever
  see the overview count. Behind that sits a daily safety cap per caller, 5 per signed-out
  address, 50 per free account, 100 per Plus or BYO Plus account, which protects our
  address's standing with YouTube rather than our money and logs a warning when reached.
  OV-102 checks it for accounts (`OverviewUsageRepository`, `overview_usage`); until OV-103
  counts the trial, the safety cap is the only gate signed out
  (`server-side-transcripts.md`, "Limits").

## Generating on our key

`POST /api/generations` (OV-102) takes the input a device would give its own model, with the
transcript it already resolved, and makes the overview through production's own
`generateOverview` on GPT-6.1 Sol (`OurKeyGenerator`). It reserves the day's slot under
`OUR_KEY_DAILY_GENERATIONS`, then the account's month's slot on our key, and gives both back
on any failure. The device saves the overview it is handed, as it does one made on its own key.

- **Past the month's quota:** `429 too_many_requests` with `details.quota: "ours"`,
  `details.resetsOn` and a `Retry-After` at the month's turn.
- **Past the global daily cap:** `429` with `details.quota: "our-key-daily"` and a `Retry-After`
  at UTC midnight. A fallback has nowhere to go and says so.
- **A failed generation:** `502 generation_failed` with `details.fallback`, from
  `fallbackReasonOf`: `out-of-credit`, `provider-down` or `schema-failure` may move to the
  reader's own key, and null may not.
- **Our own key refused by OpenAI:** `503 unavailable`, logged at error as `our key refused`.
  It is ours to fix, so the reader never sees it as their key problem.
- **Measured, not estimated:** each overview logs the tokens OpenAI reported and their cost
  from `modelPrices.ts`, the same table and metering (`meteredFetch`) the model comparison used.

## Reserving on the reader's own key

`POST /api/overview-reservations` with `{ overviewId }` (OV-102) takes a slot on the
account's own-key month before the device generates, and answers with the month's counts
(`OverviewReservationsRepository`, `overview_reservations`). Asking again for an overview
whose slot is still held is the same reservation, so a retry never counts twice; asking once
it has been pushed is a regeneration, and counts again. `DELETE
/api/overview-reservations/<overviewId>` gives the slot back when the generation fails.

- **Past the month's quota:** `429 too_many_requests` with `details.quota: "own"`,
  `details.resetsOn` and a `Retry-After` at the month's turn.
- **A new overview is let in by one of three things:** an own-key reservation, a generation
  on our key under its id (`POST /api/generations` records it), or a saved share. Anything
  else pushed as new is `428 not_reserved`, logged as `new overview pushed without a
  reservation`. A replace (a regeneration) isn't refused, since its slot was reserved when it
  was made.
- **A slot is spent once its overview is pushed,** new or replaced, and can't be given back
  after that, so reserving, pushing and releasing buys nothing.
- **A fallback counts once, on ours.** An overview made on our key gives back an own-key slot
  still held for the same id.
- **Saving a shared overview isn't counted.** The device sends the share's token with the
  overview's id. The server lets it in only while the link is live and the share is of that
  overview, which a saved copy is: it keeps the shared overview's id. Each share is let in
  once per account.
- **The gate holds from client version 7** (`FIRST_RESERVING_CLIENT_VERSION`). An older
  client's new overview is let in unreserved, so shipping this doesn't strand anyone's
  writes. Raising `MIN_SUPPORTED_CLIENT_VERSION` to 7 once reserving clients are out closes
  it for everyone, because the write floor then refuses the older ones.

## At the limit

Following "degrade visibly", the reader is told what ran out, when it comes back, and the
ways around it. Nothing they already have stops working.

- **Signed out, after 3 on either key:** *Sign up to keep going: a free account makes 15 a
  month, syncs them to your other devices, and reads them aloud.* Adding a key doesn't get
  round it. The on-device library stays readable, and moves into the account on sign-in
  (OV-47).
- **Free with no key, after 5 on our key this month:** *You've made this month's 5. More
  on 1 November.* Plus makes more, or add your own key.
- **Free or BYO Plus with a key, after the month's own-key quota (10 or 200):** the
  allowance on our key (5 or 10) carries on as the fallback, then *More on 1 November.* The upgrade is BYO Plus's 200 from
  Free, and Plus's allowance on our key from BYO Plus.
- **Free or BYO Plus, after the allowance on our key has gone on fallbacks:** the own key carries on, with
  no fallback behind it until the month turns.
- **Plus, after its allowance on our key:** the own key carries on.
- **Plus, after both:** *More on 1 November.* There is no upgrade to offer, and the
  message doesn't pretend there is.
- Reading, listening, sync, sharing and the MCP connection keep working at every limit.
- **Queued captures** (playlists, the capture queue) wait at the limit and say why. They
  don't fail. They resume when the month turns, or when the reader adds a key or upgrades.
  The same waiting state, with a different reason and resume time, is what the queue shows
  at our server's daily safety cap (`docs/features/capture-queue.md`, "Waiting at a limit").

## Options for saving cost, not built

Noted on 19 Oct 2026 and deliberately left out of the build. Revisit them if free use
outgrows what subscribers bring in.

- **A free-tier cap sized from income.** At the start of each month, set aside a share of
  last month's subscription income after fees and VAT, say 30%, for free readers on our key.
  Divide it by what one free overview costs us, about £0.03 (Sol plus narration and the
  transcript fetch), and spread the result over the month as a daily cap for Free only.
  - With 50 on Plus and 20 on BYO Plus, income is about £373 a month. 30% of that buys about
    3,650 free overviews a month, or 120 a day. That's about what 1,000 accounts make with
    typical use, so the cap would only bite in a spike of free sign-ups.
  - Once it's spent, free overviews on our key wait until the next day and the app says so.
    Own-key overviews and subscribers are unaffected.
  - It needs a starting budget before there is any income, for example £20 a month.
  - A BYO Plus reader's fallback to our key would not count against it.
  - It turns "paid plans cover free ones" into a limit the server enforces, which the fixed
    global daily cap in OV-102 does not.
- **The generation cost levers:** batch APIs, caching, chapters in their own cheaper call,
  and trimming long transcripts. OV-121 measures them.

## Not decided here

- **The prices of Plus and BYO Plus,** and whether either has a trial: OV-18.
- **Shared analysis across readers:** decided by OV-19 (`cost-model.md`), not built. A
  video's first reader pays today's $0.038 on Sol, and each later reader about $0.005. The
  quotas still count overviews made, not tokens spent, because a reader can't see or
  predict tokens.
- **The numbers against real use.** Before billing ships, check overviews per reader per
  week in PostHog (`analytics.md`). The prototype's one heavy reader made about 30 in a
  week, about 120 a month: well past Free's 15 in all, and inside 200 on the reader's own key.

## Grandfathering

There is nothing to grandfather yet, because nobody pays. Accounts that exist today have
uncounted own-key use, and it becomes counted at 10 a month on Free when the counting ships.
Whether they get notice first is decided then.
