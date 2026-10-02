# Errors and logs

What went wrong for a reader, and what the server was doing when it did. Client errors go
through our own API to PostHog's error tracking, the way events do (`analytics.md`). Each
one carries the account it happened to, the id of the call that failed, and the last few
things the reader did. The server's own logs go to PostHog too, so a client error and the
server's lines for the same call can be found by one request id. This is OV-61.

It has five parts:

- the server's half: `POST /api/errors`, its checks, and passing errors on to PostHog
- the server's own errors, reported the same way
- the reporter in the app that both shells mount
- the extension's service worker
- shipping the server's own logs

## Where errors go

**Our own API, then PostHog.** `POST /api/errors` is the only place the app sends an error.
The server checks each error, logs it at `warn` as `client error`, and passes it on to
PostHog's error tracking as an `$exception` when `POSTHOG_API_KEY` is set. It uses the same
project token, host and batch call as events (`src/postHog/sendPostHogBatch.ts`). Without a
key, the server logs the error and goes no further.

It's one error tracker, not two. Sentry was the alternative (OV-61's card has the
comparison). Its free plan has one seat and 5K errors a month, against PostHog's 100K. Its
real strength is source maps and releases, and they don't matter until someone is reading
minified stacks every day. Keeping PostHog also means no second vendor, no second DPA and
no SDK in either shell.

Errors have their own route rather than being events, for three reasons:

- **They are tier 1.** An error is operational, not usage, so it is reported whether or not
  the reader can be counted (see "Who is reported").
- **Their shape is different.** A stack and a trail don't fit a catalogue entry's
  enums-and-flags properties.
- **They are limited differently.** Errors are limited per address, because many of the
  readers sending them have no account.

## Who is reported

A **signed-in reader's** error goes under their opaque account id, which the server takes
from the session, as it does for events. A reader **without an account**, or whose session
has expired, still has their errors reported, with no id. PostHog gets a fresh random
`distinct_id` per error and `$process_person_profile: false`. That means no person is
created and nothing ties one anonymous error to another.

The route says `optionalSession` in its config. The session plugin then resolves a session
if one was sent, and lets the request through with none rather than answering `401`. It is
the only route that does this.

## What an error may carry

| Field | Is | Kept out |
|---|---|---|
| `source` | where it was caught: `uncaught`, `unhandledRejection`, `routeBoundary`, `errorState`, `failedRequest`, `serviceWorker` | |
| `type` | the error's class name, as an identifier | a sentence |
| `message` | redacted by `redactErrorMessage`, at most 200 characters | URLs, emails, quoted text, ids |
| `frames` | up to 30: a function name, a path inside the bundle, a line and a column | a page's address, query strings |
| `requestId` | the failing call's `X-Request-Id`, when it was a call to the API | |
| `apiErrorCode`, `status` | the API's own answer, when there was one | a code the API doesn't have |
| `trail` | up to 20 catalogue event names, each with its time | event properties, anything not in the catalogue |

**The message** is where a reader's own words turn up: a title in a parse error, a URL in
a fetch failure, a video id in a "not found". `redactErrorMessage` (`packages/domain`)
replaces each kind with a marker: `<url>`, `<email>`, `<text>` for quoted text, and `<id>`
for any token of eight or more characters mixing letters and digits, or six or more
digits. A quoted JavaScript identifier is kept, because
`Cannot read properties of undefined (reading 'title')` names code and not content.
The same failure then reads the same for every reader, which is also what lets PostHog
group it. The client redacts before sending, and the server redacts again
(`readClientError`), because it can't take the client's word for it. Redacting twice
changes nothing, and a test checks that.

**A frame** is checked by its characters. A file is a path (`assets/index-Bx3k9.js`) with
no scheme, host or query, and a function is an identifier with dots and brackets. A frame
that doesn't fit refuses the whole batch with `invalid_request`, as a malformed event batch
is refused.

**Frame order.** Frames travel and are logged newest call first, as a stack reads, so a log
line's `top` is the frame that threw. The sink reverses them on the way to PostHog, which
wants the frame that threw last. Before OV-70 they went unreversed, so issues grouped
before then may have been grouped by the wrong frame.

**The trail** holds names and times only, because a name is something the catalogue already
vouches for. The server drops any name that isn't in the catalogue.

## The server

`POST /api/errors` takes up to 10 errors and 64 KB, and at most 30 batches a minute per
address (`errorsAddress`). Each error is logged at `warn` as `client error`, with the
following fields:

- its source, type, redacted message and top frame
- the API's code and status, when there was an answer
- the trail's names
- whether the reader was signed in
- the batch's context
- `failedRequestId`, which is the id of the call that failed

The log line's own `reqId` is the id of the `/api/errors` call. To read the server's side of
a failure, search the logs for `failedRequestId` as a `reqId`. A `dropped` count on the batch
is logged as `client errors dropped`, never as an error or an event ("Actions, not logs" in
`analytics.md`). The batch is passed to the sink without waiting, and PostHog being down is
logged as `client errors not forwarded`. The answer is `204` either way.

## The server's own errors

A reader's error and the server's both become issues in PostHog's error tracking, so a
failure on either side is found in the same place. Before OV-70, a server 500 was a log line
only.

**What counts.** Only what the server didn't plan for is reported:

- **A 500.** The three error handlers (`/api` and `/s`, `/oauth`, `/mcp`) each log
  `unhandled error`, then pass the error to `reportRequestError`.
- **An exception nothing caught, or a rejection nothing handled.** `reportProcessErrors`
  logs it at `fatal`, reports it, and exits, which is what Node would have done without the
  handler. It is registered before the migrations run, so a database that refuses the
  server at boot is reported too.

A 4xx stays a log line. It is the server working: a refused write, an expired session, a
route that doesn't exist.

**What one carries.** `toServerError` builds it the way `toClientError` does on the device:

- the type, as an identifier
- the message, through `redactErrorMessage`
- up to 30 frames, with paths relative to where the server runs. A frame in `node:` or
  `node_modules/` is marked as not the app's own (`in_app: false`)
- for a 500, the request's id, method, route (never its URL, as "What a log line may
  carry" says) and status, and the account or assistant connection it was for

It goes to PostHog with `error_source: "server"` and `surface: "api"`, and
`mechanism.type` says what caught it: `request`, `uncaughtException` or
`unhandledRejection`. An error under an account goes under that account's id. One with no
account, and every process crash, gets a fresh id and no person, as an anonymous reader's
does. `$geoip_disable` is set, because the address PostHog would see is the server's own.

Reporting never changes the answer or holds it up. The error goes without waiting, and the
tracker being down is logged as `server error not forwarded`. A crash waits for its one
report, then ships the logs it still holds and exits. A second crash while the first is
being sent is logged and not reported again.

**Finding the server's lines.** The `request_id` on a server error is the call's own
`reqId`, so filtering PostHog's Logs on it shows everything the server logged for that
call.

## The client

`ErrorReportingRuntime` sits inside the sync runtime and above `AnalyticsRuntime`. It sends
to the server the shell knows (`useKnownApiUrl`) whether or not the reader is signed in,
with the session when there is one. It gives the app an `ErrorReporter`.

**What is caught, and as which source:**

| Source | Caught by |
|---|---|
| `uncaught` | the window's `error` event |
| `unhandledRejection` | the window's `unhandledrejection` event |
| `routeBoundary` | `RouterErrorBoundary`: a page that threw while it rendered. The only one sent as `handled: false`, because the reader hit a dead end the app didn't plan |
| `failedRequest` | an `ErrorState` given an `error` that is a `SyncRequestError` or `SyncTransportError`: a call to the API that was refused or never answered |
| `errorState` | an `ErrorState` given any other `error`, such as a read from the device's store that failed |

`ErrorState` takes the failure it is showing as `error` and reports it once, however often
it renders. A screen that shows a dead end for an expected answer (a request that has
expired, a session that has ended, a page that doesn't exist) passes no `error`, so only
failures are reported. Each error object is reported once, so a failure that reaches both
a screen and the window is one report.

**The request id.** A `SyncRequestError` already carried the id its call was sent with.
`SyncTransportError` now carries it too, for a call that never got an answer, so that
failures without a server answer can be found as well.

**Redaction runs on the device** before anything is queued. `toClientError` passes the
message through `redactErrorMessage` and the stack through `parseStackFrames`, which keeps
a frame's function name and its URL's path and drops its origin, query and hash. A frame
with no URL, such as `<anonymous>` or native code, is dropped.

**The trail.** Every call to `useAnalytics()` also records the event's name and time in an
`ActionTrail` of 20. It records whether or not the reader is signed in, because it leaves
the device only attached to an error, never as usage. It lives in memory and is gone with
the page. A reader who isn't signed in sends no events, but their errors still carry what
they did.

**The queue.** `ErrorQueue` is separate from the events queue. It holds errors for a second
and sends up to 10 together. Past 10 a minute, a render loop's errors are dropped. A send
that fails, or has no server to go to, is dropped rather than retried, and the count goes
as `dropped` on the next batch that gets through. When the page is hidden or left,
`AnalyticsRuntime` flushes errors before events, both with `keepalive`. Errors are sent
first because they matter more, and because a browser limits how much can be in flight
as a page closes.

## The service worker

The extension's worker runs none of the app, so it has its own small reporter,
`apps/extension/src/workerErrorReporter.ts`. It catches the worker's own `error` and
`unhandledrejection` events, and a failure to read the local database when the injected
button asks whether a video already has an overview.

**Each error is sent the moment it is caught,** on its own and with `keepalive`. Chrome can
stop a worker between any two messages, so a batch held for a second could be lost with it.
It is sent as source `serviceWorker`, with layout `worker` in the context, and an empty
trail, because nothing the reader does happens in the worker. Past 10 a minute, errors are
dropped and counted, as in the app.

**Where to send it, and under which session.** The worker can't read the page's
`localStorage`, where the extension keeps its connection. So whenever the server or the
session changes, the app hands both to the shell through `errorDestinationMirror`. The
extension writes them to `chrome.storage.session` (`errorDestination.ts`), and the worker
reads them from there. With nothing written yet, the worker sends to the server the
extension was built for, with no session.

This is a second copy of the reader's bearer token. It is safe for these reasons:

- **Readers.** `chrome.storage.session` can be read only by the extension's own pages,
  which can already read the original in `localStorage`, and by its worker.
- **Lifetime.** It is held in memory and wiped when the browser closes or the extension
  reloads. The original copy is on disk.
- **Content scripts.** They are kept out by Chrome's default, and nothing may change that.
  `sessionStorageAccess.test.ts` fails if any source calls `setAccessLevel`.
- **Sign-out.** It replaces the copy with no token, and the IWFT checks this. A copy that
  was somehow stale would be harmless: the server answers an unknown token on
  `/api/errors` by treating the report as anonymous.

## Shipping the server's logs

**Why ship them.** `fly logs` keeps a short tail, and a reader's support request arrives
days later. So the server writes every log line twice: to stdout, as before, and to an
OTLP log endpoint, which by default is PostHog's log ingest. PostHog keeps logs for 14 days
on the free plan, and its free allowance was 10 GB a month when OV-61 was researched.

**How it works.** `createLogger` (`src/logs/`) builds pino with two destinations.
`OtlpLogExporter` is one of them. It turns each line into an OpenTelemetry log record:

- pino's level becomes a severity
- its message becomes the body
- every other field becomes an attribute, with nested fields named by dotted path, such as
  `req.route` or `clientError.status`

The exporter holds records for two seconds, or until it has 500, then posts them as
OTLP/HTTP JSON in one call.

It uses no OpenTelemetry SDK and no pino transport, for two reasons:

- A transport runs in a worker thread and brings an exporter for every protocol, on a
  256 MB machine.
- OTLP/HTTP JSON is one `fetch`, the same choice made for PostHog's events. PostHog's
  ingest reads JSON as well as protobuf (`rust/capture-logs` in PostHog's repository), with
  a 2 MB limit on a request.

**What it can never do is fail or slow a request.**

- A batch the destination refuses is dropped, not retried, and a line goes to stderr.
- Past 5,000 held records, new lines are dropped.
- Either way, the next batch that gets through starts with a `log records dropped` record
  that carries the count, so a gap reads as lost lines rather than a quiet hour.
- On `SIGINT` or `SIGTERM`, which is how Fly stops an idle machine, the server closes and
  ships what it still holds.

**Where they go** is set only by the standard OpenTelemetry variables, so moving to Grafana
Cloud or Better Stack is a change of secrets, not of code:

| Variable | Effect |
|---|---|
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`, or `OTEL_EXPORTER_OTLP_ENDPOINT` with `/v1/logs` added | the destination |
| `OTEL_EXPORTER_OTLP_LOGS_HEADERS`, or `OTEL_EXPORTER_OTLP_HEADERS` | its headers, as `key=value` pairs, values percent-encoded. A token in here is a secret |
| `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL`, or `OTEL_EXPORTER_OTLP_PROTOCOL` | only `http/json`. Anything else stops the server starting rather than shipping nowhere |
| `OTEL_SERVICE_NAME` | `service.name`, which PostHog groups logs by. Default `overview-api` |
| `OTEL_RESOURCE_ATTRIBUTES` | more resource attributes. `deployment.environment.name` is always `ANALYTICS_ENVIRONMENT` |
| `OTEL_LOGS_EXPORTER=none` | stdout only |

With none of them set and `POSTHOG_API_KEY` set, logs go to `<POSTHOG_HOST>/i/v1/logs`
under the same project token, so production needs no new secret. A destination named
without headers is never handed that token.

## What a log line may carry

A request is logged by its **route**, `{ method, route }`, never by its URL or the
caller's address. A path can hold a share token (`/s/:token`, `/api/shares/:token`) or a
video id, and a query can hold an OAuth `state` or an address someone typed. Fastify's
default request log carried all of that, and the caller's IP address too. That had
already broken the rate limits' promise never to log an address, and shipping would have
copied it all to a third party. A request no route matched is logged with `route: null`.
The response is logged by its status. `createLogger.test.ts` fails if a token, a query or
an address appears in a line.

Otherwise the logs are what they were: ids, never names or content
(`docs/architecture/api.md`).

## Finding what happened

PostHog's error tracking has an error's `request_id`, the id of the call that failed. In
PostHog's Logs, filter on `reqId` equal to that id to see the server's lines for the call.
Filter on `failedRequestId` to find the server's `client error` line for the report
itself.

## Turning it on

Errors and logs both ride on `analytics.md`'s "Turning it on". The same project and token
carry them. Error tracking is on by default in a new PostHog project, and logs ship as soon
as `POSTHOG_API_KEY` is set. After the deploy, check three things:

- the `analytics` startup line names the EU host rather than "client events and errors are
  logged only"
- the `log shipping` startup line names `https://eu.i.posthog.com` rather than "logs go to
  stdout only"
- the deploy's own lines appear in PostHog's Logs under `overview-api`, and no
  `logs not shipped` line appears on stderr

## Not built yet

- **Traces.** Logs are joined by request id, not by a trace. If a request ever spans more
  than this one process, OpenTelemetry tracing is the next step.
- **Errors before the app mounts.** A shell that can't open its database renders
  `StartupFailure` outside `App`, so that failure isn't reported yet.
- **One copy of the extension's session.** Keeping the connection in `chrome.storage`
  rather than `localStorage` would let the worker read the original rather than a copy.
  It is a larger change to how the app reads its connection in the extension.
- **Source maps.** Frames are minified paths and positions until a build uploads its maps
  to PostHog.
