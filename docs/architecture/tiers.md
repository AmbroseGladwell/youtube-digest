# Tiers: what signed-out, free and paying readers can do

Decided on 6 Oct 2026 (OV-78). Which key an overview uses was added on 15 Oct 2026, and the
allowances on our key and the launch prices on 18 Oct 2026. Free's own-key quota went from 30 to
10 a month on 20 Oct 2026, and signed out became 3 overviews in total, on any key, the same
day. **On 28 Oct 2026 (OV-46) signed out stopped seeing overviews at all:** a reader without an
account starts their first overview through onboarding and sees it once they have one, and
**since 18 Nov 2026 (OV-327) nothing is made before the account.**
Four tiers, arranged to push readers towards paying: signed out is the first overview's
start, a free account is the whole product in small amounts, and the two paid plans sell
volume. **Plus** sells overviews on our key. **BYO Plus** is cheaper, and
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

|                                                               | Signed out                                               | Free account           | BYO Plus            | Plus                |
| ------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- | ------------------- | ------------------- |
| Price a month (launch, 18 Oct 2026)                           | free                                                     | free                   | £4.99               | £7.99               |
| Overviews on our key                                          | — (needs an account; onboarding's first is made after it) | 5 a month              | 10 a month          | 50 a month          |
| Overviews on your own key                                     | —                                                        | 10 a month             | 200 a month         | 200 a month         |
| Saves without an overview, once the month's are made (OV-358) | —                                                      | 50 a month             | 50 a month (OV-351) | 300 a month         |
| Chat on our key, in usage (OV-309, OV-376)                    | — (needs an account)                                     | About 100 typical questions | About 500     | About 1,000         |
| Seeing an overview                                            | — (needs an account)                                     | Yes                    | Yes                 | Yes                 |
| Transcripts from our server                                   | Onboarding's video read only (OV-327)                     | Part of an overview, or of a save without one | Same | Same |
| Daily safety cap on those fetches (not shown to readers)      | 5 per address                                            | 50                     | 100                 | 100                 |
| Library                                                       | —                                                        | Synced to every device | Synced              | Synced              |
| Narration, every voice                                        | — (needs an account)                                     | Yes                    | Yes                 | Yes                 |
| Sharing an overview                                           | — (needs an account)                                     | Yes                    | Yes                 | Yes                 |
| MCP connection                                                | — (needs an account)                                     | Yes                    | Yes                 | Yes                 |
| Chapters, transcript tab, personalisation                     | —                                                        | Yes                    | Yes                 | Yes                 |
| Extension, playlists                                          | Only to start onboarding                                 | Yes                    | Yes                 | Yes                 |

**The paid plans sell volume, never features.** A free account has every feature, so a
free reader sees the whole value of the product, including their library in Claude and
other assistants through the MCP connection. What they run out of is overviews. **BYO Plus
costs less than Plus** because we don't pay for its generation. Prices are OV-18's, with the
guidance below.

**No account says "unlimited".** Every overview on an account costs us something, so every
plan has a number, and the app shows it with its reset date.

## What an own-key overview costs us

Measured, not estimated, in the docs each line cites:

| Cost                           | Figure                                                            | Source                       |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------- |
| Rendering narration            | about $0.002 to $0.003 a render, and each voice is its own render | `tts-pre-rendered-speech.md` |
| Storing the audio              | about 0.7 MB an overview on R2, kept for as long as the overview  | `tts-pre-rendered-speech.md` |
| A transcript through the proxy | about $0.0004 a fetch, and only when every earlier rung failed    | `server-side-transcripts.md` |
| The overview record            | a few KB in Postgres                                              |                              |
| The YouTube Data API           | not money: a shared daily allowance across every reader           | `playlists.md`               |

That is about half a cent an overview at worst, so 200 a month costs us at most about $1.
**Narration for an own-key overview renders only when it is first played,** never in
advance, so the cost follows what readers listen to rather than what they make. A cap on
narration renders per account per day stops one account rendering a whole library in every
voice: 30 new renders a UTC day, counted in `narration_render_usage`, with narration already
made free to play again (`audio-player.md`, "The day's new narration"). Our key's overviews
are still narrated ahead, as soon as they are made. The transcript proxy's global cap and each playlist's pace (OV-95) stay as they are.

**The allowances on our key were set on 18 Oct 2026, from what an overview costs.** OV-92
chose GPT-6.1 Sol, at a mean of $0.038 an overview over its 20 real videos (about $0.033
per 20 minutes of video, `model-comparison.md`). At that price:

|          | On our key              | Generation if every one is used |
| -------- | ----------------------- | ------------------------------- |
| Free     | 5 a month, down from 10 | $0.19                           |
| BYO Plus | 10 a month              | $0.38                           |
| Plus     | 50 a month              | $1.90                           |

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

|          | Price | Stripe Managed Payments | Paddle | Stripe, not registered | Cost at the cap |
| -------- | ----- | ----------------------- | ------ | ---------------------- | --------------- |
| BYO Plus | £4.99 | **£3.67**               | £3.53  | £4.68                  | about £0.70     |
| Plus     | £7.99 | **£6.00**               | £5.88  | £7.61                  | about £1.95     |

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

**Chapters, the transcript tab and personalisation are parts of an overview,** not
features beside it. They come with every overview at every tier. Gating them would mean
making a worse overview for the same cost.

**Playlists stay open to every account (OV-27).** A capture from a followed playlist counts
against the matching quota like any other overview: on our key or on the reader's own. On
either key, the playlist's pace applies as well: up to 5 a day unless the reader chooses
otherwise (OV-95, `docs/features/playlists.md`, "A pace for each playlist"). A video the
reader chooses to make now skips the pace but still counts against the month.

## Signed out

**Signed out sees no overviews, and nothing is made** (decided 28 Oct 2026, OV-46, replacing
the 3-overview trial of 20 Oct; nothing made since 18 Nov 2026, OV-327). Onboarding
(`docs/features/onboarding.md`) reads the reader's link for free and shows what they'll get;
the overview is written once they have created an account or signed in, as one of the plan's
overviews on us. Two things run on our key before the account, on purpose: onboarding's topic
suggestions, and the video read's kind check, with the transcript it is made from, which the
device keeps for the overview so it is fetched once. Both are capped per trial token and in total. Before, signed out made 3
overviews on either key into a library on the device, then was asked to sign up; an own key
was briefly unlimited before that, so a reader with a key gave up volume by signing up.
Making the account the way to see anything removes both problems: there is no signed-out
volume to compare with Free, and every reader who sees an overview has an account to count
it against. The shared link page stays public.

**Where there are accounts, every page that would show an overview shows the way to one
instead:** home is onboarding's Start, on the web and in the side panel, except in a panel on
a device that has had an account, which offers signing back in; an overview's own address and
the queue show `SignedOutGate` (in the shell; `useAccountNeeded`). It has Create an account and Sign in,
counted as `account.signedOutGate.chosen` with the way taken. Settings, signing in and
creating an account stay open. Nothing is made signed out on either key (`accountNeeded` in
`useGenerationReadiness`): no Generate, no New, no capture queue, and the injected YouTube
button opens Create account.

**A shell with no server has no accounts to offer,** so it has no gate: its library stays on
the device and it makes overviews on the reader's key, as before.

**The no-account library stays, unseen** (OV-47). It holds onboarding's answers (topics,
About you) until the account exists, and signing in moves them in
(`docs/features/account-libraries.md`). The overview is written straight into the account.

## Which key an overview uses

Decided on 15 Oct 2026. A reader with a key of their own has two keys behind each
overview, and the order is set by what each plan sells:

|                         | First                | Then                 |
| ----------------------- | -------------------- | -------------------- |
| Free, BYO Plus          | the reader's own key | ours                 |
| **Plus**                | **ours**             | the reader's own key |
| No key of their own     | ours                 | —                    |

**Own key first, ours last,** for everyone but Plus. It spends the reader's credit before
ours, and our allowance (5 or 10 a month) becomes the reader's safety net rather than a quota they spend
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

**Nor on a model the provider refuses (other 4xx).** The provider read the request and
turned it down for the model it names: a model it no longer has, or a smaller one whose
structured-output limits the overview's schema goes past. The adapters classify it as
`ModelRefusedError`. A reader on their own key chose that model, so when it fails on the
last key tried, or the schema still breaks there, they're told in our words which provider
and model couldn't make it, with a link to Settings › API keys to pick another (OV-247).
The provider's response stays off the screen. An overview on our key that fails says only
"Something went wrong making this overview. Try again in a while.", because the reader
didn't choose that model.

**The reader sees which key made it.** An overview made by falling back says so in one
quiet line ("On us: your Anthropic key was out of credit"), and the count it used
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

**On the device** (OV-102). `keyOrderFor` sets the order from the plan the server reports
(`GET /api/overview-usage`), whether the reader holds a key, and `onlyMyKey`;
`makeOverviewOnKeys` walks it. An own-key attempt reserves its slot first and releases it
if the key fails. Only a spent quota stops it there: offline or with the server down, the
overview is made anyway and its push reserves when it goes. `fallbackCauseOf` decides
whether a failure moves on, and the last key's own failure is what the reader sees when none
is left. A reader with no key of their own is ready to generate whenever the server makes
overviews on ours (`useGenerationReadiness`, `ourKeyUsable`), on the account's month. Signed
out, nothing is made (OV-327): onboarding waits for the account before it writes.
The quiet line is `MadeOnLine` under the playlist line in the reader (`madeOnLine` words it),
and the switch is `OnlyMyKeySwitch`, beside the keys in Settings, shown only where there is
a fallback to switch off. Saving a shared overview sends the share's token before the copy
is saved, so its push is let in uncounted.

## What the reader is told is left

**Readers never read "our key"** (decided 27 Oct 2026, OV-131). The overviews we pay for are
_on us_, as Settings › Plan's "On us" cell already said: _7 of 10 left on us this month_,
_this one is on us_, _On us: your Anthropic key was out of credit_. "Our key" stays the
name for it in code, logs and these docs. The reader's own is still _your own key_.

Built in OV-131, from designs 95a–95h with the key order flipped for everyone but Plus. Every
number is the server's (`GET /api/overview-usage`), worked out in code, never by a model.
Signed out there is no line: nothing is made there.

**Only the quota the next overview will use is shown where the reader generates.**
`nextQuotaOf` walks the same order `keyOrderFor` gives a run, and picks the first key with
any left. The line (`UsageLine`, under Generate in the dialog, under the hero, and under
Create on the panel's capture screen) reads:

| State                         | Line                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| First key in the order        | _7 of 10 left on your own key this month · Resets 1 November · Plan_                                                      |
| First key spent, falling back | _This month's 10 on your own key are made, so this one is on us: 4 of 5 left. · Get more overviews with Plus · See plans_ |
| Counts not loaded             | _Overviews left this month: Checking… · Plan_                                                                             |
| Couldn't ask                  | _Couldn't check what's left · Plan_, and Generate stays: the server enforces the limit anyway                             |

Falling back to our key on Free or BYO Plus, the line mentions Plus once (95m), because an
upsell names only a plan that makes more on the key this overview uses (decided on OV-131):
Plus for our key. A reader on our key is never offered BYO Plus, and a Plus reader falling
back to their own key is offered nothing, since no plan makes more. On the panel the line
drops "this month" and Plan and shortens the date (_Resets 1 Nov_), but keeps Plan when it
mentions Plus (_… Get more overviews with Plus · Plan_).
Settings › Plan counts both quotas (`docs/features/plus-upsell.md`, "16c"). No count ever
reads 0 before it is known, and none reads "unlimited". The counts are asked for again
after every run, made or failed, on any surface or the capture queue.

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
- **Signed out makes nothing** (OV-327, 18 Nov 2026). The trial token the server issues a device
  only reads onboarding's link (5 reads a token, 15 a UTC day per address across every token)
  and asks for its topic suggestions. Before, it made onboarding's overview on our key, with a
  cap of 3 a day per address, a signed-out share of the day's cap, and a carry of the moved
  overview into a later month (OV-325); all of that went with it.
- **A global daily cap on our key** sits behind every tier, the way
  `TRANSCRIPT_PROXY_DAILY_FETCHES` sits behind the proxy. When it is spent, generation on our
  key says so plainly and points to adding a key. It doesn't fail with a generic error.
- **Transcripts from our server are part of an overview, not a quota of their own**
  (decided 6 Oct 2026, OV-107). A fetch is allowed while the account has an overview left on
  either key this month; signed out, only onboarding's video read fetches one. Readers only ever
  see the overview count. Behind that sits a daily safety cap per caller, 5 per signed-out
  address, 50 per free account, 100 per Plus or BYO Plus account, which protects our
  address's standing with YouTube rather than our money and logs a warning when reached
  (`OverviewUsageRepository`, `overview_usage`; `server-side-transcripts.md`, "Limits").

## Generating on our key

`POST /api/generations` (OV-102) takes the input a device would give its own model, with the
transcript it already resolved, and makes the overview through production's own
`generateOverview` on GPT-6.1 Sol (`OurKeyGenerator`). It reserves the day's slot under
`OUR_KEY_DAILY_GENERATIONS`, then the account's month's slot on our key, and gives both back
on any failure. The device saves the overview it is handed, as it does one made on its own key.
`GET /api/generations` says whether it can, and with which provider and model, so the app's
analytics can name our model (OV-255, `docs/architecture/analytics.md`).

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

**Signed out, a trial token reads and suggests, and makes nothing** (OV-103, narrowed by
OV-327). The device asks `POST /api/trials` for one before onboarding's first read (public, 10
an hour per address), keeps it (`useSignedOutTrial`, in local storage), and sends it as
`X-Trial-Token`; the server keeps only its hash (`TrialsRepository`, `trial_tokens`). A
generation, a transcript from our server, finding an episode's words or transcribing it all need
an account: signed out they are `401`. A token this server never issued is `401 unauthenticated`
with `details.trial: "unknown"`, so the device asks for another.

**The trial reads onboarding's link** (OV-154, OV-327), on `POST /api/articles/read`,
`/api/podcasts/read` and `/api/videos/read`, and checks an episode's words on
`/api/podcasts/transcript/check`. Its reads: 5 a token (`TRIAL_READS`), and 15 a UTC day per address
across every token, counted whether or not the page could be read. Past the token's,
`429` with `details.quota: "trial-reads"`, logged as `trial reads spent`; past the address's,
`429` with `details.quota: "trial-reads-address"` and a `Retry-After` at UTC midnight, logged
as `trial read address cap spent`, never the address. A token it never issued is `401` with
`details.trial: "unknown"`. A video read also checks the video's kind on our key, with the
transcript it's made from, remembered per video for everyone and capped at 300 a UTC day
signed out (`SIGNED_OUT_KIND_CHECKS_DAILY`); the transcript goes back to the device, which keeps
it for the overview.

**And suggests onboarding's topics** (OV-176), on `POST /api/generations/topic-suggestions`:
a small pass on our key, a few hundred tokens, never counted as the trial's overview. Its
caps are rate limits rather than counts kept in the database, since each costs a fraction of a
cent: 5 a day a token and 20 a day an address (`api.md`, "Rate limits"). A token it never issued
is `401` with `details.trial: "unknown"`. An account may ask too, under `smallPassAccount`.

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
- **An overview made on our key in a signed-out trial counts on our key when it moves in.**
  Its reservation takes a slot on the account's month on our key rather than the reader's
  own, and is granted even past that month's quota, counting on the next month with room
  instead (OV-325). The server knows it by its id, so there is nothing for
  a modified client to claim.
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

- **Signed out** there is no limit to meet: nothing is seen or made but onboarding's
  overview ("Signed out", above).
- **Free with no key, after 5 on our key this month:** _You've made this month's 5. More
  on 1 November._ Plus makes more, or add your own key.
- **Free or BYO Plus with a key, after the month's own-key quota (10 or 200):** the
  allowance on our key (5 or 10) carries on as the fallback, then _More on 1 November._ The upgrade is BYO Plus's 200 from
  Free, and Plus's allowance on our key from BYO Plus.
- **Free or BYO Plus, after the allowance on our key has gone on fallbacks:** the own key carries on, with
  no fallback behind it until the month turns.
- **Plus, after its allowance on our key:** the own key carries on.
- **Plus, after both:** _More on 1 November._ There is no upgrade to offer, and the
  message doesn't pretend there is.
- Reading, listening, sync, sharing and the MCP connection keep working at every limit.
- **Queued captures** (playlists, the capture queue) wait at the limit and say why. They
  don't fail. They resume when the month turns, or when the reader adds a key or upgrades.
  The same waiting state, with a different reason and resume time, is what the queue shows
  at our server's daily safety cap (`docs/features/capture-queue.md`, "Waiting at a limit"
  and "At the month's limit"). The playlist preview and the queue's _Choose_ say what the
  allowance left means before anything runs.

**Built in OV-131.** `limitMessageOf` turns the next quota into the message, and
`LimitMessageNote` puts it where Generate or Create would be: in the dialog, under the hero,
and on the panel's capture screen. The pasted link stays in the field. The title names what
ran out and when it's back, both quotas in the order they were spent when both are (_You've
made this month's 10 on your own key and 5 on us. More on 1 November._), and every state
ends _Everything you've already made keeps working._ The ways round go only to Settings ›
API keys, Settings › Plan or Create account: Add your own key where a key would give more,
See plans or See BYO Plus where a plan would, and See this month's usage where none would.
The title and body are a polite live region, and the dialog moves focus to the first action
as it opens. Each message shown is `capture.limitMessage.shown` (quota, plan, surface) and
each way taken `capture.limitMessage.wayChosen`.

## Questions about an overview

Chat inside an overview (`chats.md`, OV-309) has its own monthly allowance, in
`chatAllowances.ts` in `@overview/domain`, counted apart from overviews so asking never spends one. Every plan
asks on our key, on GPT-6 Luna, whatever key it uses for overviews: Free 100 a month, BYO
Plus 500, Plus 1,000, set by the owner on 16 Nov 2026 (BYO Plus raised from a suggested 300).

- **Counted in Postgres**, one `chat_usage` row per account and UTC day; the month is the
  sum of its days. A message is reserved under the account's row lock before the provider is
  asked and given back if the answer fails, so it counts once, when it is answered.
- **Behind it:** 200 a day per account (`CHAT_MESSAGES_PER_ACCOUNT_DAILY`), and a global
  daily cap on our key, `OUR_KEY_DAILY_CHAT_MESSAGES` (20,000 by default), kept beside
  overviews' in `our_key_usage.chat_messages`. A conversation holds at most 50 questions.
- **At a limit the reader waits:** a 429 with `quota` (`chat-month`, `chat-day` or
  `chat-our-key-daily`), `retryAfterSeconds`, and for the month `resetsOn`.
- **What it costs, fully used,** at OV-267's measured cost per message: about $0.03, $0.17
  and $0.34 a month for Free, BYO Plus and Plus; about $0.05, $0.27 and $0.53 if every
  source is over an hour; about $0.10, $0.52 and $1.04 with no caching. Measured through
  the endpoint on a 169-minute source (`chats.md`, "Measured through the endpoint"): about
  $0.0004 a question, other chats included, in any conversation about an overview asked
  about in the last 30 minutes, and $0.004 for the first after that (OV-313). A Plus month of
  1,000 questions each about a different 169-minute source would be about $4.40; the same
  1,000 in conversations of 30 about $0.60.
- `GET /api/chat-usage` says what is used, the limit and the reset date, and since OV-376 the
  `share` of the month's usage spent.

### Chat usage (OV-376)

Questions don't cost the same: a follow-up about a short video is a fraction of a cent, and a
broad library answer covering dozens of overviews costs several times more (OV-373). So the
allowance is moving from a count of questions to **usage**, as Claude counts it: each answer
spends what it really cost, and each plan has an amount of usage a month. The owner's
conditions, 22 Nov 2026: stay profitable without being stingy, and keep about today's numbers
for questions about long-form content.

- **A unit of usage is a millionth of a dollar** of list-price cost (`chatUnitsOf`), worked out
  by code from the provider's own token counts, both passes of a library answer included. The
  amounts live in config (`chatAllowances.ts`), so they can move without a migration, and
  readers never see a unit.
- **One question means one about long-form content:** `CHAT_UNITS_PER_QUESTION` is a question
  about a 169-minute source in a conversation of four, the first from a cold cache and the rest
  from a warm one (the endpoint measurements in `chats.md`). Each plan's usage is its question
  count times that, so a plan's most expensive month of chat is fixed, however it's spent.
- **What things cost, in those questions** (measured, OV-267's endpoint runs and OV-373's
  production arm, with the map cached):

  | Question                                             | Questions' worth |
  | ---------------------------------------------------- | ---------------- |
  | A follow-up about a video of up to 89 minutes        | about 0.15       |
  | A follow-up about a 169-minute video                 | about 0.3        |
  | The first question about a 169-minute video          | about 3          |
  | A library question, deep, reading 5 in full          | about 2          |
  | A broad library answer                               | about 2 to 8     |
  | A library question in a new conversation (cold map)  | about 2 more     |

  A reader who asks a handful of questions about each long video, or many about short ones,
  gets at least today's numbers. One who asks a single question about each of many long videos,
  or mostly broad library questions, gets fewer.
- **Edge rules:** a question about one overview goes ahead while the month is under 100%. A
  library or project question needs room for its worst case, `CHAT_LIBRARY_RESERVE_UNITS` (12
  questions' worth, against a measured worst of about 10.5), so near the end it can be refused
  while overview questions still work (design 376h). Either way the real cost is charged once
  it's answered, so the last answer may go a little over. A failed or stopped answer spends
  nothing (its cost still goes on the account's tally, `unit-economics.md`).
- **Settled and enforced** (`ChatUsageRepository`): every stored answer settles its usage into
  `chat_usage.units` on the day it was reserved, and into `our_key_usage.chat_units`. The month,
  the day (`CHAT_UNITS_PER_ACCOUNT_DAILY`, 200 questions' worth) and the global day
  (`OUR_KEY_DAILY_CHAT_MESSAGES` questions' worth) are checked in units, under the account's row
  lock, against what is settled, so two questions at once can both go ahead near the end. The
  question count is kept beside the units for analytics, and `library_units` holds the part
  spent on library and project questions, for the cost dashboard (`cost_reports.chat_months`).
- **Refusals** keep their shape: `chat-month` (with `scope: "library"` when only a library
  question won't fit), `chat-day`, `chat-our-key-daily`. `GET /api/chat-usage` adds `share` and
  `libraryFits`; `used` and `limit` still count questions for older clients.
- **What readers see** (designs 376a–376j, `chats.md`): a percentage and the reset date, never a
  count, a unit or a cost. Plans say "about N typical questions a month".

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
