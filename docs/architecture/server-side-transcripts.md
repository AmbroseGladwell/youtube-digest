# Our own server fetching transcripts

The last rung of the ladder in `docs/features/transcript-retrieval.md`. When the shared
cache and the reader's own extension have both failed to answer, the API
fetches the captions itself, through a residential proxy if it has to, and adds them to
the shared cache. `v1-architecture-decisions.md` deferred this "with its accompanying
YouTube-ToS exposure". This file records the position taken on that exposure, and how the
rung is built (OV-55).

## The terms-of-service position

YouTube's terms forbid accessing the service by automated means except through its
public search engines or with written permission. Fetching captions from our own server
is automated access, whatever address it leaves from. **We do it anyway, inside these
bounds, and they are the position:**

- **Captions only.** The rung asks for a video's player response and its caption track.
  It never downloads audio or video, never touches comments or accounts, and never
  signs in. What it fetches is the public text of a public video, the same for every
  reader.
- **Last, never first.** Every rung above it fetches nothing from our address. The
  shared cache answers from a row, and the extension fetches from the reader's own
  address. The server is asked only when both have failed.
- **Once per video, ever.** What the server fetches goes into the shared cache as
  confirmed, so the next reader of that video is answered from the row. The bill and
  the exposure both track the rate at which new videos enter the corpus, not readers
  times videos.
- **Never in the background.** The rung's cost is `metered`, so `freeTranscriptSources`
  keeps it from the background prefetch. Only a reader pressing Create can reach it. That
  makes it a property of what the prefetch is handed, not a rule anyone has to remember.
- **Capped, and switched off by default.** It runs only with `TRANSCRIPT_SERVICE=on`, and
  through the proxy only up to `TRANSCRIPT_PROXY_DAILY_FETCHES` a day. Turning it off is
  a config change that leaves every other rung untouched.
- **A legal view before it scales.** This is a position for a small product with a
  proven cache in front of it. It is not a position for one where the rung carries real
  traffic. If proxied fetches pass a few thousand a day, or YouTube or anyone else
  objects, get a lawyer's view before raising the cap.

What this does not claim: that the rung is within YouTube's terms. It is not. The claim
is that the exposure is small, bounded and reversible, and that the ladder exists to keep
it that way.

## Why there has to be a proxy

The web app cannot fetch captions itself. InnerTube and `timedtext` send no CORS headers,
which is why the extension exists. Fly's machines can fetch them, but from datacenter
addresses, which YouTube turns away by reputation: `LOGIN_REQUIRED` ("Sign in to confirm
you're not a bot"), or a caption track that comes back empty. Rotating IPv6 on a VPS
doesn't help. Supadata doesn't escape this either: it is InnerTube behind a proxy pool,
plus a margin.

So the rung tries **our own address first**, which costs nothing, and goes through the
proxy **only when YouTube turned that away**: `access-restricted`, `source-blocked`,
`rate-limited` or `source-unavailable` (`fetchThroughService`). `no-captions` and
`video-unavailable` are facts about the video, the same through any address, so they
never cost a proxied fetch. Logs say which route answered (`via: "direct"` or
`"proxy"`), so real traffic will show whether the direct attempt is worth keeping.

## The provider: Decodo, behind one URL

| Provider | Price (Oct 2026, USD ex VAT) | Why or why not |
|---|---|---|
| **Decodo** | $4/GB pay-as-you-go, prepaid $4 at a time, credit lasts 12 months; $2/GB at 1 TB | **Chosen.** Prepaid credit is a hard cap no bug in our code can get past. |
| Webshare | $3.50 for 1 GB/month, down to $1.40/GB at 3 TB | A 50% promo with no published end. Worth revisiting at about 25 GB a month. |
| IPRoyal | $7.35 to $4.55/GB, traffic never expires | Dearer at our volume. |
| Oxylabs, Bright Data | $30 for 5 GB/month; $8/GB | Competitive only at hundreds of GB. |
| Supadata, as a service | $17 for 3k up to $897 for 1M transcripts | The baseline: 3 to 6 times the proxy's cost per transcript. |

**What a transcript costs.** The research on the card measured 70 to 100 KB compressed
per fetch, so roughly 10,000 to 14,000 transcripts per $4, or $0.16 to $0.40 per
thousand. Under 10,000 proxied fetches a month is under $5. The 1,000-a-day cap bounds
the worst case at about $12 a month.

**The proxy is one secret, not a provider integration.** `TRANSCRIPT_PROXY_URL` is an
http(s) proxy URL with its credentials in it. Every literal `{session}` in it is
replaced with a fresh id per resolve, which is how Decodo (and most providers) pin a
sticky exit address in the username:

```
http://user-<username>-country-gb-session-{session}-sessionduration-1:<password>@gate.decodo.com:7000
```

That is Decodo's documented format (help.decodo.com, "Advanced Parameters"): the one proxy
user the dashboard gives you, with parameters added to its name. The dashboard's own
"Endpoints" list is sticky by port instead (`gb.decodo.com:30001` and up, no session in
the name), which this code can't rotate, so build the URL by hand.

Switching provider is changing that one value. Exit country GB or US, because the
InnerTube request already asks for `hl: "en"`, `gl: "US"`.

**One session per attempt, both calls on it.** YouTube signs the caption URL in the
player response, so the player call and the caption fetch go out on one exit address
(`proxiedYouTubeFetch` makes one undici `ProxyAgent` per session). A bot check through
the proxy is tried once more on a fresh session, then reported.

## Limits

Two kinds, and both live in Postgres (`service_transcript_usage`), not in the process's
memory like the request limits in `api.md`. A deploy resetting a request window only
forgives a caller, but a reset budget would spend real money twice.

**Transcripts from our server are part of an overview, not a quota of their own** (decided
6 Oct 2026, OV-107). A fetch is allowed while the reader has an overview left: on either key
this month for an account (`tiers.md`), or in the trial when signed out. Readers only ever
see the overview count. That check lands with OV-102 (accounts) and OV-103 (the trial);
until then the safety cap below is the only gate.

**A daily safety cap per caller.** It protects our address's standing with YouTube, not our
money, and sits well above normal use. Only a cold fetch that stored a transcript counts: a
slot is reserved before the fetch and given back when the fetch fails or `transcriptFault`
refuses what came back, so a video with no captions costs nothing (`ServiceUsageRepository`,
`reserveFetch` and `releaseFetch`, the same pattern as the proxy budget). A shared-cache hit
is free, and so is joining a fetch another reader started a moment ago: only the reader who
started it holds a slot.

| Caller | Cold fetches a UTC day |
|---|---|
| Signed out, per address | 5 |
| A free account | 50 |
| A Plus account | 100 |

`byo-plus: 100` joins when OV-102 adds the plan. Signed-out readers can use the rung
(decided 5 Oct 2026), because a web reader with no account is exactly who has no other
rung; signed out, our server fetches only for the trial's overviews. Their address is stored
only as a truncated SHA-256, and per-caller rows are deleted after seven days. Past the cap,
the answer is `429 too_many_requests` with `details.daily: true`, `details.retryAfterSeconds`
and a `Retry-After` at UTC midnight, and the server logs `service transcript quota spent` at
warn (below). The client turns it into the `daily-cap` failure: the reader is told when it
resets, in their own clock, and that the extension can fetch now; the capture queue waits at
it rather than failing (`docs/features/capture-queue.md`, "Waiting at a limit").

**Global, proxied fetches only.** One proxied fetch is reserved before the proxy is
touched and released if no request went through it. When none is left, the failure is
`budget-exhausted`, a `TranscriptFetchFailure` of its own: the reader is told our server
has fetched what it can today, and that the extension can still fetch it. It is not retryable.

The caps are constants in `serviceTranscriptQuotas`. The global cap is
`TRANSCRIPT_PROXY_DAILY_FETCHES`, default 1,000 (about 100 MB, or $0.40 a day).

## What happens on a request

`POST /api/service-transcripts/:videoId`, with or without a session
(`serviceTranscriptRoutes`, `ServiceTranscripts`):

1. **The shared cache first.** A confirmed copy is returned straight away. The client
   asked it a moment ago, but two readers can race, and this costs one row read.
2. **A recent no.** A video that had no captions, or doesn't exist, is answered from
   memory for six hours rather than asked again, before any cap is touched.
3. **One fetch per video.** Readers asking at the same moment share one in-flight fetch,
   and only the one who started it is counted. That map is in memory, which is exact on one
   machine (`deploy.md`). With two machines, a second fetch is possible and harmless: both
   copies hash the same.
4. **The caller's slot** is reserved, and given back at step 5 or 6 if nothing is stored.
5. **Direct, then the proxy**, with a 10-second timeout per request.
6. **Into the shared cache, confirmed.** The usual rule is that two accounts have to
   agree before a copy is served (`shared-transcript-cache.md`), because the server can't
   check what a client uploads. Our own fetch needs no second opinion: nobody but us
   touched it (`TranscriptsRepository.putServiceFetched`). It goes through
   `transcriptFault` and `shareableTranscript` like any upload.

A failure is `422 transcript_unavailable` with `details.failure` naming the
`TranscriptFetchFailure`, and the client rung turns it back into a `TranscriptFetchError`
so the ladder and the reader see it as they would from any other rung. A server with the
service off answers `GET /api/service-transcripts` with `{ "available": false }` and the
`POST` with `503 unavailable`.

## On the client

`serviceTranscriptSource` is tier `service`, cost `metered`, last in
`createTranscriptSources`, on both shells. It asks the server the shell already knows
(`useKnownApiUrl`), with the extension's bearer when it has one and the web app's cookie
otherwise, so a signed-in reader is counted by account.

**Degrading visibly.** `isReady` asks `GET /api/service-transcripts`, and a server that is
off, or can't be reached within three seconds, is a rung that isn't offered. The same
status, through `useServiceTranscriptStatusQuery`, is what lets `useGenerationReadiness`
call a web reader with only an Anthropic key ready. With the service off, they are still
told to install the extension, exactly as before.

## Logs and spend

The rung's outcomes are logs, not analytics events (`analytics.md`, "Three kinds of
record"). The reader's side is already counted: the capture event's `transcriptSource` is
`service` when this rung answered, and its `failure` names `budget-exhausted` like any
other.

| Line | Level | Carries |
|---|---|---|
| `service transcript fetched` | info | `via`, `proxySessions`, `proxyBytes`, `generated`, `segments`, `ms`, and today's `used` beside the caller's `limit` |
| `service transcript answered from the shared cache` | info | |
| `service transcript failed` | warn | `failure`, `proxyBytes`, `ms` |
| `service transcript refused` | warn | `fault`, `via` |
| `service transcript quota spent` | warn | `caller` (`account` or `address`), `plan` (`null` for an address), `accountId` for an account and never the address, `limit`, `used`, `retryAfterSeconds` |
| `request refused` | warn | `code: too_many_requests` with `daily: true` and `retryAfterSeconds`, which is what tells the cap apart from a per-minute refusal |
| `transcript proxy spend` | info | `proxyBytes`, `proxiedToday`, `proxyBytesToday` |
| `throttled` | warn | `limit: serviceTranscriptAddress`, the per-address request limit of 60 an hour. The client reads it as `rate-limited` with the `Retry-After`, and the capture queue waits it out rather than failing the video (`docs/features/capture-queue.md`, "Waiting at a limit") |

A reached cap is identifiable from the one `service transcript quota spent` line: who, which
plan, the limit and when it resets. On the client, a queue failure is traced without these
logs through the `transcriptFellThrough` warning, which names each rung tried and its
failure (`errors-and-logs.md`, "Client warnings").

Daily spend is the global row, `select day, proxied, proxy_bytes from
service_transcript_usage where caller = 'global'`, and the last `transcript proxy spend`
line of each day says the same.

**The bytes are an upper bound.** They are request plus decompressed response bodies.
The provider bills compressed bytes plus headers and TLS. One real fetch measured 563 KB
of bodies here against roughly 100 KB on the wire, so the provider's dashboard is the bill
and these numbers are for spotting trends.

## Turning it on

It is on in production from OV-55: `TRANSCRIPT_SERVICE = "on"` in `fly.toml`, and
`TRANSCRIPT_PROXY_URL` in `.env.prod.tpl` and in Bitwarden's `overview-prod` (and
`overview-dev`, for the check below). Locally it stays off unless `.env.local` says
otherwise.

- **To switch it off,** set `TRANSCRIPT_SERVICE = "off"` and deploy. Every other rung is
  untouched, and clients stop offering this one at their next status read.
- **To change provider,** replace the secret and run `task deploy:secrets`.
- **After a deploy,** the startup line `transcript service` names the proxy host and the
  cap.

## Checking it by hand

`npm run proxy-sanity-check --workspace apps/api -- <youtube-url>` fetches one real video
through the real proxy and prints the bytes each request carried. `--direct` skips the
proxy, to compare. Run it with the secret injected rather than written anywhere:
`task secrets:run -- npm run proxy-sanity-check --workspace apps/api -- <url>`. It is the
only thing that can catch a provider's username format changing, so a person runs it
whenever the proxy URL does.

Both paths were run on 5 Oct 2026 against `tL9Lw250spc` (a 36-minute video, 903 segments).
Direct from a residential connection took 360 ms. Through Decodo, on a GB exit with one
sticky session, it took 1,271 ms, and all three requests answered 200 with no bot check.
Each run carried about 563 KB of bodies.

## What is not built

- **A circuit breaker on failure rate.** The global cap is the backstop. If the proxy
  starts failing every request, each failure still spends a reservation, so a bad day
  costs at most the cap.
- **XML captions** (`srv1`), which the research measured at about half the size of json3
  on long videos. The parser is json3-only. Worth doing if spend ever matters.
- **Counting only accounts of some age** toward the cap, if magic-link accounts are
  ever made in bulk to farm it.
- **The "an overview left" check** in front of the safety cap: OV-102 for accounts, OV-103
  for the signed-out trial.
