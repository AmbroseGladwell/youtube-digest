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
| **Analytics** | what readers did in the app, and nothing else | `/api/events`, then PostHog | `mcp.consentScreen.approved` |
| **Logging** | everything: what the system did, what went wrong, and a copy of every event | pino, as JSON on stdout (`docs/architecture/api.md`) | `connection request decided`, `mcp tool called`, `client event` |
| **Audit records** | facts the system itself needs later | Postgres tables | a share's row, who fetched which transcript |

An event is never how the app finds something out, and a log line is never what a chart
is drawn from. When the server already logs something, as it logs every decision on an
assistant's request, the event is the reader's side of it and the log line is the system's.

### Actions, not logs

**An analytics event is something the reader did in the app**: a click, a choice, a thing
they made or opened. Everything else is a log line, however countable it looks:

| Not an event | Why | Where it is instead |
|---|---|---|
| Events the app dropped | the app's own bookkeeping | `dropped` on the batch, logged as `client events dropped` |
| An assistant calling a tool over `/mcp` | the reader asked their assistant, but did nothing in the app | `mcp tool called`, with the tool, the assistant, the overview count, whether it failed and how long it took (`mcp-connector.md`, "Logging") |
| Audio rendered, a transcript cached, a share page viewed | the system or someone else acting | their existing log lines |

So PostHog holds reader actions and nothing to filter out, and the logs hold the whole
story, actions included, for anyone tracing what happened. The logs are shipped to
PostHog's Logs, where what is only logged can be queried (`errors-and-logs.md`).

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
session the batch arrives on: the app never sends an id of its own. The one exception is a
shared link's page, which counts its visitors with or without an account ("The shared page"). The basis is
legitimate interests, which OV-62's privacy notice has to state before launch.

A reader without an account sends nothing. Usage from someone with no account is OV-62's
tier 2, which needs their consent and an anonymous id kept on the device, and neither
exists yet. So the queue doesn't hold, send or count events while there is no session, the
route is an ordinary authenticated one, and "signed-out use stays local" is still true.

Nothing about analytics is written to the device: no cookie, no `localStorage`, no
extension storage. The queue lives in memory and is gone with the page.

## What an event may carry

A property is a choice (`z.enum`), a flag, a number, or one of the ids in `ANALYTICS_IDS`:
an overview's (`OverviewId`) or a topic's (`TopicId`), and nothing else. The catalogue's
type allows only those, `analyticsEvents.test.ts` checks every entry at runtime in case a
cast gets past the type, and the server parses each event's properties strictly against
its declaration, so an id has to be a uuid to pass. So an event can't carry a URL, a video
id, an overview's text, an element's label, a file name or anything the reader typed,
because there is no field shaped to hold one.

The two ids are allowed because they are ours: random uuids minted on the device, which say
nothing about the video or the reader on their own, and are what lets every event about one
overview be read together, or a filter be told apart by the topic it chose. A video id is
not: it names the video. A choice the app defines, a novelty or a read status, is sent as
its own enum value (`novel`, `unread`), never its label, so a chart reads the same when the
copy changes.

### One overview's events

Everything a reader does on an overview's page carries the overview's id, so a funnel can
follow one overview from opened to read to the video watched anyway. The tabs, the note,
the transcript, the chapters and the player are drawn on two pages, the reader's own and a
shared link's, so their events are declared once (`overviewPageEvents`) and sent under two
features:

- `reader.*`, with `overviewId`, which `bindOverviewId` adds so a component says only what
  happened. The reader's page provides it through `OverviewAnalyticsProvider`.
- `sharedPage.*`, without it. The shared page never sees the owner's overview id; the server
  adds it from the share (see below).

A component used on both pages calls `useOverviewPageAnalytics()`, and one only on the
reader's page calls `useReaderAnalytics()`. Neither knows which page it is on.

### Typing

What someone types is never sent. A field that is worth counting says so once they stop,
through `useTypingSettled`, a second after the last keystroke, with what the typing found:
the transcript search sends how many matches there were, the topic picker how many topics
matched, the shared page's link field whether it was a YouTube link. A field's starting
value isn't typing and sends nothing.

### Changing a state

An event that changes something says what it changed to: `readSwitched({ read: true })`,
`favouriteSwitched({ favourite: false })`, `rateChanged({ rate: 1.5 })`, and where it was
done from when there is more than one place (`from: "masthead" | "actionsMenu" | "playerBar"`).

What every event carries without being asked is said once per batch, in `context`: the
shell (`web` or `extension`), the layout (`full` or `panel`, or `worker` for an error from
the extension's service worker), the app's version when it is a plain `x.y.z`, and the
operating system in one word, from `analyticsPlatform`. The server adds the environment.

## Naming

Every event is `feature.screen.action`, so a name says where it came from without a
lookup, and one `feature.*` filter in PostHog shows everything a feature does across its
screens.

| Part | Is | Examples |
|---|---|---|
| feature | the thing a reader would say they were doing | `mcp` (connecting and using an assistant), later `library`, `reader`, `analyticsConsent` |
| screen | the screen or region of the app it happens on, as the design names it | `consentScreen`, `settingsConnections`, `sortPill`; `tools` for what the server sees on `/mcp` |
| action | what the reader did, in the past tense, not the control they used | `approved`, not `approveClicked`; `orderChosen`, not `sortPillChanged` |

The feature is never a word that could mean two features. `consent` alone would have meant
both an assistant asking to connect and, once OV-62 lands, a reader agreeing to analytics,
which is why the first events are `mcp.consentScreen.*`.

## Adding an event

1. Add it to `analyticsEvents` in `packages/domain`, named as above, with a description
   someone reading the numbers can act on, and any properties.
2. Call it where it happens: `useAnalytics()` and then
   `analytics.mcp.consentScreen.declined({ plan })`.
   The method exists only because the catalogue entry does, and its argument is typed by
   the declaration.
3. Assert it in the IWFT for the feature, through `backendSimulator.analytics`. The
   catalogue is also what the server checks against, so shipping the API first, as
   `api.md` asks, keeps a new event from being refused.

Call it after the fact, not before. `mcp.consentScreen.approved` is sent once the server
has taken the answer, and `mcp.settingsConnections.revoked` once the revoke succeeded, so a count is a count of
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
the count goes as `dropped` on the next batch that gets through, where the server logs it
as `client events dropped`. A gap then reads as lost data, not as a quiet day, without the
app's bookkeeping becoming an event.

## The server

`POST /api/events` takes a batch of up to 50 events and 32 KB, from a session, at most
60 batches a minute per account (`eventsAccount`). A malformed batch is refused whole with
`invalid_request`. Inside a well-formed one, each event is checked on its own, so an event
a newer client knows about costs only itself. Each event that passes is logged at `info`
as `client event` with its name, properties and context, and any that were refused are
counted in one `client events refused` warning. Then the batch is passed to the sink
without waiting: PostHog being slow or down is logged as `client events not forwarded` and
never reaches the reader. The answer is `204` either way.

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

## The shared page

A shared link is read mostly by people with no account, so its page sends its events to
`POST /api/shares/:token/events` rather than `/api/events`, with or without a session:

- **Only `sharedPage.*` events.** Anything else in the batch is refused, one at a time.
- **The token never travels on.** The server looks the share up, adds the overview's id to
  each event, and logs and forwards the events without the token. The log line records the
  route, never the URL (`errors-and-logs.md`). A stopped link still counts, against the
  overview it shared, and an unknown token's events go on with no overview id.
- **A view id, not a person.** The page makes a uuid when it loads and keeps it in memory, so
  one visit's events read together. Nothing is written to the device. In PostHog it is the
  `distinct_id` (`shared-view:<uuid>`) with `$process_person_profile: false`, so no person is
  made. A visitor who is signed in is counted under their account instead.
- **Rate limited per address**, at `sharedPageEventsAddress`, like `/api/errors`.

The page sends nothing about the reader who shared it, and the shared copy carries no id:
the link is all the page has.

## Request ids

Every API call carries an `X-Request-Id` the client made, and the server logs the request
under it and says it back (`docs/architecture/api.md`, "Request ids"). A client error carries
the id of the call that failed, which finds the server's lines for it
(`errors-and-logs.md`, "Finding what happened").

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

- **Consent, the anonymous id, linking it at sign-up, the privacy policy:** OV-62.
- **The events other cards named:** the sort order people pick (`library-sort.md`), the
  voices sampled and chosen (`narration-voice.md`) and time from play to first sound are
  OV-63, and the link shapes the parser refuses are OV-29. Each is a catalogue entry and
  a call.
- **The rest of the app's actions.** The reader and the shared page are counted. The
  library, making an overview, the player outside the reader, settings, sign-in and the
  extension's own surfaces follow, each as catalogue entries and calls in the pattern above.
- **A generated catalogue page.** `analyticsEvents.ts` is short enough to read. When it
  isn't, a script can print the features, screens, names, descriptions and properties from the same
  object the server checks against.
