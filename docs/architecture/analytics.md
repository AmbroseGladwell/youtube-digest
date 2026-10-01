# Analytics

What a reader did in the app, counted: one catalogue of named events shared by both shells
and the API, a typed method per event at the call site, a small queue on the client, and
`POST /api/events`, which checks each event and passes it on to PostHog. This is OV-60's
first slice. Client errors and the trail before them are OV-61, and consent, an anonymous
id for readers without an account, and the privacy policy are OV-62.

## Three kinds of record

They answer different questions and belong in different places, and mixing them is how an
event ends up missing from a funnel or a business fact ends up in a log with a 14-day life.

| | Answers | Goes to | Example |
|---|---|---|---|
| **Analytics** | what readers do in the app, counted | `/api/events`, then PostHog | `consent.approved` |
| **Logging** | what the system did, and what went wrong | pino, as JSON on stdout (`docs/architecture/api.md`) | `connection request decided`, `throttled` |
| **Audit records** | facts the system itself needs later | Postgres tables | a share's row, who fetched which transcript |

An event is never how the app finds something out, and a log line is never what a chart
is drawn from. When the server already logs something, as it logs every decision on an
assistant's request, the event is the reader's side of it and the log line is the system's.

## Where events go

**Our own API, then PostHog.** The app only ever posts to `/api/events` on the server it
already talks to. The server checks every event against the catalogue, logs it, and passes
it on to PostHog's EU cloud when `POSTHOG_API_KEY` is set. Without a key, which is dev and
tests, it logs and stops.

- **Nothing new in either shell.** The extension already calls the API cross-origin, so it
  needs no new `host_permissions` and no connect rule. No vendor script or token ships in
  either bundle, and MV3's ban on remote code isn't in play.
- **The rules are enforced where the client can't skip them.** The server refuses a name
  the catalogue doesn't have and a property an event doesn't declare, whatever the client
  sends.
- **The vendor can be swapped.** `EventSink` is one method. PostHog is reached with its
  one batch call over `fetch`, as Brevo is for mail, with no SDK and so no queue or retries
  of its own in the request path.

Rejected: **the PostHog SDK in both shells**, which brings autocapture and session replay
to turn off, a remote-code build to pick for the extension, and consent enforced only on
the client. **An events table in Postgres**, which is counted with SQL and needs no DPA,
but has no funnels or dashboards, and its retention sweep waits for a job runner nobody
has built. PostHog's free plan (1M events a month, dropped rather than billed past the
limit, a year's retention) and Better Stack's are compared on OV-60 and OV-61.

## Who is counted

Only a signed-in reader, under their opaque account id, which the server takes from the
session the batch arrives on: the app never sends an id of its own. The basis is
legitimate interests, which OV-62's privacy notice has to state before launch.

A reader without an account sends nothing. Usage from someone with no account is OV-62's
tier 2, which needs their consent and an anonymous id kept on the device, and neither
exists yet. So the queue doesn't hold, send or count events while there is no session, the
route is an ordinary authenticated one, and "signed-out use stays local" is still true.

Nothing about analytics is written to the device: no cookie, no `localStorage`, no
extension storage. The queue lives in memory and is gone with the page.

## What an event may carry

A property is a choice (`z.enum`), a flag or a number, and nothing else. The catalogue's
type allows only those, `analyticsEvents.test.ts` checks every entry at runtime in case a
cast gets past the type, and the server parses each event's properties strictly against
its declaration. So an event can't carry a URL, a video id, an overview's text, an
element's label, a file name or anything the reader typed, because there is no field
shaped to hold one.

What every event carries without being asked is said once per batch, in `context`: the
shell (`web` or `extension`), the layout (`full` or `panel`), the app's version when it
is a plain `x.y.z`, and the operating system in one word, from `analyticsPlatform`. The
server adds the environment.

## Adding an event

1. Add it to `analyticsEvents` in `packages/domain`, under the area of the app it happens
   in, with a description someone reading the numbers can act on, and any properties.
   Name it for what the reader did (`declined`), not for the control (`declineClicked`).
2. Call it where it happens: `useAnalytics()` and then `analytics.consent.declined({ plan })`.
   The method exists only because the catalogue entry does, and its argument is typed by
   the declaration.
3. Assert it in the IWFT for the feature, through `backendSimulator.analytics`. The
   catalogue is also what the server checks against, so shipping the API first, as
   `api.md` asks, keeps a new event from being refused.

Call it after the fact, not before. `consent.approved` is sent once the server has taken
the answer, and `connections.revoked` once the revoke succeeded, so a count is a count of
things that happened.

## The client

`AnalyticsRuntime` sits inside the sync runtime, because it sends over the reader's
session, and gives the app an `Analytics` built from the catalogue. `AnalyticsQueue`
behind it holds events for two seconds and sends them together. A batch is sent at once,
with `keepalive` so it outlives the page, when the page is hidden or left, and when a call
site is about to leave the page itself: the consent screen flushes before sending the
reader back to the assistant.

The queue can never fail or slow down what the reader did. A send that fails is dropped,
never retried. Past 60 events a minute, or more than a batch waiting, events are dropped
too, so a render loop can't spend the month's allowance. What is dropped is counted, and
the count goes as `analytics.dropped` at the head of the next batch that gets through. A
gap then reads as lost data, not as a quiet day.

## The server

`POST /api/events` takes a batch of up to 50 events and 32 KB, from a session, at most
60 batches a minute per account (`eventsAccount`). A malformed batch is refused whole with
`invalid_request`. Inside a well-formed one, each event is checked on its own, so an event
a newer client knows about costs only itself. Each event that passes is logged at `info`
as `client event` with its name, properties and context, and any that were refused are
counted in one `client events refused` warning. Then the batch is passed to the sink
without waiting: PostHog being slow or down is logged as `client events not forwarded` and
never reaches the reader. The answer is `204` either way.

## Events the server sends

Some usage never passes through the app. An assistant reading the library over `/mcp`
talks to the server directly, so the server records it itself: `mcp.toolCalled`, under the
reader's account id, once per tool call. It carries the tool (one of the five, as an enum
that `mcpTools.test.ts` holds to the tools offered), the assistant (`claude`, `chatgpt` or
`other`, from the name it registered with by `mcpAssistant`, never the name itself),
whether the call failed, how many overviews it returned (zero for a tool that returns
none), and how long it took in whole milliseconds, measured by the server. It carries no
query, topic, id, overview text or transcript, the same line `mcp-connector.md` draws for
its logs. Its origin is `mcp`, so PostHog shows `surface: mcp` beside `web` and `extension`.
No address is sent with it, because the caller is the assistant's server, not the reader.

These events live in `serverAnalyticsEvents`, apart from the app's catalogue, so the app
has no method for them and `/api/events` refuses them: a client can't forge one.

PostHog's own MCP SDK (`@posthog/mcp`, via `wizard mcp-analytics`) was considered and not
used. It instruments an `McpServer` from the MCP SDK, which `/mcp` doesn't use, and by
default it sends the tool's arguments, its result and an "intent" it asks the assistant to
write, all of which would carry what the reader asked for.

## Location

PostHog places an event from an IP address, and every event the server passes on would
otherwise come from the server's own. So the server sends `$ip`, cut down by `geoAddress`
to the caller's network: the last octet of IPv4 goes, and everything past the /64 of IPv6.
PostHog's "Discard client IP data" setting then drops even that after GeoIP has run.

A network is still more precise than it sounds. The first real event (1 Oct 2026) came
back with a city, a postcode district and coordinates good to 50 km, because a /24
usually belongs to one provider in one place. City is kept: it is useful and is shared by
many readers. **Postcode and coordinates are not**, since next to an account id a postcode
district narrows a reader down further than counting needs, and the coordinates are often
the postcode's centre rather than the city's. GeoIP runs inside PostHog, after the
server's part is done, so a transformation in PostHog removes them on the way in (step 3 of
"Turning it on").

| Kept | Removed |
|---|---|
| continent, country, region (England), city, time zone | `$geoip_postal_code`, `$geoip_latitude`, `$geoip_longitude`, `$geoip_accuracy_radius` |

## Request ids

Every API call carries an `X-Request-Id` the client made, and the server logs the request
under it and says it back (`docs/architecture/api.md`, "Request ids"). Nothing reports client
failures yet, so for now this matches a refused call in the console to its server lines.
OV-61 is what puts the two side by side.

## Turning it on

Once, when the PostHog project is made:

1. Make the project in the **EU** region. The region can't be changed afterwards.
2. In the project's settings, turn on **Discard client IP data**, and turn off
   autocapture, session replay and surveys. The app never loads PostHog's script, so they
   would only matter to someone adding it later, who should read this first.
3. Add a transformation that removes `$geoip_postal_code`, `$geoip_latitude`,
   `$geoip_longitude` and `$geoip_accuracy_radius` from every event, and the same fields
   from person properties (`$geoip_*` and `$initial_geoip_*`), after GeoIP has run
   ("Location"). Then check a new event carries a city and none of the four.
4. Sign PostHog's DPA.
5. Put the project token (`phc_…`, Project settings → General) in Bitwarden as
   `POSTHOG_API_KEY` in `overview-prod`, and run `task deploy:secrets`
   (`docs/conventions/secrets.md`). `.env.prod.tpl` already names it, and `fly.toml`
   already sets `ANALYTICS_ENVIRONMENT` to `production`. No secret or personal API key is
   needed: nothing here reads from PostHog.
6. After the deploy, check the startup line reads `analytics` with the EU host rather than
   "client events are logged only", then approve or decline a test request and see the
   event arrive in PostHog with a city, no postcode, no coordinates and no IP.

Until then, events are logged on the server and go nowhere else.

## Not built

- **Client errors and the trail before them, and shipping the server's logs:** OV-61.
- **Consent, the anonymous id, linking it at sign-up, the privacy policy:** OV-62.
- **The events other cards named:** the sort order people pick (`library-sort.md`), the
  voices sampled and chosen (`narration-voice.md`) and time from play to first sound are
  OV-63, and the link shapes the parser refuses are OV-29. Each is a catalogue entry and
  a call.
- **Debouncing a noisy event.** Nothing noisy is sent yet. The per-minute cap is the
  backstop until something is.
- **A generated catalogue page.** `analyticsEvents.ts` is short enough to read. When it
  isn't, a script can print the areas, names, descriptions and properties from the same
  object the server checks against.
