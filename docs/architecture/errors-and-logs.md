# Errors and logs

What went wrong for a reader, and what the server was doing when it did. Client errors go
through our own API to PostHog's error tracking, the way events do (`analytics.md`). Each
one carries the account it happened to, the id of the call that failed, and the last few
things the reader did. The server's own logs go to PostHog too, so a client error and the
server's lines for the same call can be found by one request id. This is OV-61.

It has ten parts:

- the server's half: `POST /api/errors`, its checks, and passing errors on to PostHog
- source maps, so a minified frame reads as the TypeScript it came from
- the server's own errors, reported the same way
- the TTS service's errors
- the reporter in the app that both shells mount
- what's reported before the app mounts
- the extension's service worker
- shipping the server's own logs
- alerts, so a new or worsening issue reaches someone
- logging codes, so a line is found by a code rather than by its prose

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
| `source` | where it was caught: `uncaught`, `unhandledRejection`, `routeBoundary`, `errorState`, `failedRequest`, `serviceWorker`, `startup` | |
| `type` | the error's class name, as an identifier | a sentence |
| `message` | redacted by `redactErrorMessage`, at most 200 characters | URLs, emails, quoted text, ids |
| `frames` | up to 30: a function name, a path inside the bundle, a line and a column, and the chunk id its file was injected with | a page's address, query strings |
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

## Source maps

A client's frame is a minified file, line and column until PostHog has that build's source
map. Both builds make maps (`build.sourcemap: "hidden"`, so no `sourceMappingURL` comment
points at them), and `scripts/uploadSourceMaps.mjs` hands them to PostHog's CLI and then
deletes them, so none is ever served or zipped.

**How a frame finds its map.** `posthog-cli sourcemap process` does two things:

- It injects a snippet into each chunk. The snippet records the chunk's id in
  `globalThis._posthogChunkIds`, keyed by a stack taken inside that chunk. The id is a
  UUIDv5 of the chunk's content, so the same code gets the same id on every build.
- It uploads each map under that id, tied to a release named `overview-web` or
  `overview-extension` at `<version>+<commit>`.

On the device, `parseStackFrames` reads the snippet's map and gives each frame the chunk id
of its file, the way PostHog's own SDK does. The sink sends a frame that has one as
`platform: "web:javascript"` with `chunk_id`, which PostHog resolves through the uploaded
map. A frame without one stays `custom` and reads as it was sent.

**Where it runs.** The CLI's inject step needs the key too, because it registers the release.
So it runs wherever the shipped bundle is built:

- **The web app** is built inside the image on Fly's builder. The deploy job passes the key
  and project id as Docker build secrets (`--build-secret`), which no layer keeps.
- **The extension** is built by CI's `build (extension)` job. Only on a push to `main` does
  it get the key. Every other build deletes its maps unread.

Without a key, nothing is uploaded and the maps are still deleted. That covers the `image`
CI job, a pull request, and `task deploy` from a laptop. With a key, an upload that fails
fails the build. A deploy that silently lost its maps would leave that release's errors
unreadable, and nobody would know until they needed one.

**The key** is a PostHog personal API key with the *error tracking write* and *organization
read* scopes. It isn't the project token events use. It lives in GitHub's secrets beside
`FLY_API_TOKEN`, as `POSTHOG_CLI_API_KEY`, with the project's id as
`POSTHOG_CLI_PROJECT_ID`. `gh secret set POSTHOG_CLI_API_KEY` asks for the value without
echoing it.

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

## The TTS service

`services/tts` reports its own failures to the same project, the same way: an `$exception`
over PostHog's batch call, with no SDK (`posthog_exception_reporter.py`). An SDK would
bring a background thread to a process that exits 15 seconds after its last render and
could take a queued error with it.

- **What counts.** An exception the FastAPI app has no handler for. It is answered as `500`
  with code `internal_error` in the API's envelope, and reported. A `ServiceError` (an
  unknown voice, another render version) and a request that fails validation are the
  service working, so they aren't reported.
- **When it goes.** As a background task on the `500`, so the answer goes first and the
  report doesn't hold it up. The send waits at most five seconds. If it fails, that's
  logged as `error not forwarded` with the failure's type, and the answer is unchanged.
- **What it carries.** `error_source: "tts"`, `surface: "tts"`, the environment, a fresh
  id with no person, and `$geoip_disable`. The frames are Python's own, oldest first, with
  paths relative to the service's directory. A frame in `site-packages` or outside the
  service is marked as not its own.
- **The message.** A spoken line is a reader's own words, and an exception can quote one,
  such as a phonemiser failing on a word. So the message goes through
  `redact_error_message`, a port of `redactErrorMessage` tested against the same cases.
- **Request id.** The API's queue makes a fresh id for each render attempt, logs it as
  `ttsRequestId` on `audio rendered` or `audio render failed`, and sends it as
  `X-Request-Id`. The service logs that call under it as `reqId`. A malformed one is
  replaced, as the API's own is.

**Its logs** are JSON on stdout in pino's shape (`JsonLogFormatter`): `level` as pino's
number, `time`, `msg`, `service: "overview-tts"`, the `reqId`, and the line's own fields.
They ship the way the API's do, through `OtlpLogHandler`, by the same `OTEL_*` variables
(`otlp_logs_config`, defaulting `service.name` to `overview-tts`), and with none set, to
PostHog's log ingest under the `POSTHOG_API_KEY` the service already holds. A batch is
held for two seconds, and the handler is closed as the process exits, so a machine that
stops 15 seconds after its last render ships its last lines. uvicorn's access log is off,
because it names the caller's address.

| Line | Level | Fields |
|---|---|---|
| `render requested` | `info` | `voice`, `language`, `renderVersion`, `lines`, `characters` |
| `render finished` | `info` | the same, with `synthesisSeconds`, `audioSeconds` and `bytes` |
| `render refused` | `warn` | `code` (`unknown_voice`, `render_version_mismatch`, `invalid_request`), `status` |
| `unhandled error` | `error` | `err`: its type and redacted message. Also reported, as above |
| `model loaded` / `model failed to load` | `info` / `error` | `loadSeconds` / `err` |
| `idle, stopping` | `info` | `idleSeconds`; `servingSeconds`, how long since the model was ready, and `upSeconds`, since boot |

No line carries a word of the script.

It reads `POSTHOG_API_KEY`, `POSTHOG_HOST` (default the EU host) and `ANALYTICS_ENVIRONMENT`,
as the API does. Without a key, nothing is reported. The key is the TTS app's own Fly
secret, imported by `task deploy:tts:secrets` from `services/tts/.env.prod.tpl`.

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
| `libraryMove` | the move on sign-in of what this device made without an account, when it fails (`docs/features/account-libraries.md`); what it didn't move is tried again on the next start |

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

## Client warnings

Some moments aren't failures but are worth knowing about: something the app depends on let
it down, and it carried on. They go through `POST /api/errors` as `warnings` beside the
errors, and the server logs each one at `warn` as `client warning`. That's all it does
with them. A warning never becomes an error-tracking issue, so it never opens an alert,
and it isn't an event, because events are what readers did (`analytics.md`, "Actions, not
logs"). The line carries the reader's account, session and surface, so it sits with the
server's own lines for that device.

The catalogue is `ClientWarning` in `packages/domain`. Every field is an enum, a count or
an id:

| Warning | When | Fields |
|---|---|---|
| `transcriptFellThrough` | making an overview, a transcript rung threw before another answered, or no rung answered. A rung that had no answer is the ladder working, and alone isn't a warning. Watching detection's background ladder doesn't warn | `passed` (each rung asked, its outcome, and its `failure` when it named a `TranscriptFetchFailure`), `answeredBy` (or `null`) |
| `narrationFellBack` | the player moved to the pacer because the render failed or didn't match the note, or because asking for it failed. A signed-out reader's pacer isn't a warning | `reason` (`renderFailed`, `requestFailed`), the failed call's `requestId` and `apiErrorCode` |
| `signOutSyncGaveUp` | signing out, the last sync ran past its ten seconds and the reader was signed out anyway. Sent before the session ends, so it carries the account (`docs/features/account-libraries.md`) | `pending`, `stuck` |
| `playlistCheckFailed` | a followed playlist could not be checked for new videos on opening (`docs/features/playlists.md`) | `outcome`, `requestId`, `apiErrorCode` |
| `queuedCaptureFailed` | a video the queue took from a playlist could not be made (`docs/features/capture-queue.md`, "Needs attention") | `problem` |
| `captureQueueHeld` | the queue stopped asking and waited at a limit (`docs/features/capture-queue.md`, "Waiting at a limit") | `reason` (`serverCap` or `serverBusy`), `waiting`, `resumesInSeconds` |
| `captureQueueResumed` | the queue carried on after waiting at a limit | `reason`, `waiting`, `via` (`reset` or `extension`) |

A **parked sync write** needs no warning. The refusal that parks it is already a
`request refused` line under the device's session.

Warnings share the error queue's budget of 10 a minute, and its batch, so a loop that
keeps falling back can't send more than a loop that keeps throwing. The app reports one
with `ErrorReporter.warn()`. `PlayerEngine` and `resolveVideo` take a `warn` callback,
which the player's runtime and the generation mutation wire to the reporter.

## Before the app mounts

A shell that can't open its local database renders `StartupFailure` instead of `App`. With
no `App`, there's none of the reporter. So in that branch the shell calls
`reportStartupFailure` (`packages/app-core/src/app/`), which sends the one error straight
to `/api/errors` as source `startup`, with `keepalive`:

- **Where to:** the web app's own origin. For the extension, the server its saved
  connection names, or the server it was built for. This is what `useKnownApiUrl` would
  have answered.
- **Under which session:** the extension's saved token, when there is one. The web app's
  cookie goes with it as it does for every call.
- **What with:** the surface, layout, build version and platform, and an empty trail,
  because the reader hasn't done anything yet.

A send that fails is dropped silently, because there's nothing mounted to report it to.
The shell has already logged the error to the console.

A **blocked** open isn't reported. That's another window holding an older version, which
the screen tells the reader how to fix. It's the expected answer, not a failure, the same
as the dead ends `ErrorState` shows without an `error`.

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

## Alerts

Error tracking only helps if someone looks, so PostHog posts to Slack when something
changes. There are three notifications, one per trigger, all to `#alerts` in a Slack
workspace kept for this:

| Trigger | Means |
|---|---|
| **Issue created** | a failure nobody has seen before |
| **Issue reopened** | an issue marked resolved has come back: the fix didn't hold |
| **Issue spiking** | a known issue is happening much more often than usual, often after a deploy |

They fire once per **issue**, not once per error. PostHog groups repeated errors into one
issue, so a bug every reader hits is one alert. That grouping is what the redacted message
and the frames are for ("What an error may carry").

**Why Slack.** PostHog's issue alerts can go to Slack, Discord, Teams or a webhook, but not
email. Email exists only on trend alerts, which watch the total `$exception` count and can
miss a single new issue. Slack's free plan is enough: one app, and alerts don't need more
than 90 days of history.

**Setting it up again**, in a new project or after the workspace changes:

1. In PostHog, go to Error tracking → Configuration → Alerting → **New notification**, and
   pick a trigger.
2. Choose Slack. **Connect to Slack** the first time, which opens Slack's permission page,
   and click **Allow** for the workspace. It can also be connected from
   Settings → Project → Integrations.
3. In Slack, `/invite @PostHog` into `#alerts`. The app can't post to a channel it hasn't
   joined.
4. Pick `#alerts`, then **Test function**, and **Create & enable** once the test message
   arrives.
5. Do the same for the other two triggers. If spiking turns out noisy, disable it alone.

## Logging codes

**Every line carries a `logCode`**, the way every analytics event carries a name. This is
OV-111. Before it, a line was found only by matching the prose in its message, which any of
us could reword, and PostHog's log table had no column that told one kind of line from
another. A code is stable; a message is prose and may be reworded without breaking a filter
or a saved view.

A code is `service.area.event`, mirroring `feature.screen.action` for events
(`analytics.md`, "Naming"), so a code says where a line came from without a lookup, and
`api.audio.*` is one filter for everything narration does:

| Part | Is | Examples |
|---|---|---|
| service | which process wrote it | `api`, `tts` |
| area | the part of that service, as the code is laid out | `audio`, `sync`, `http`, `render` |
| event | what happened, in the past tense | `rendered`, `changesServed`, `requestRefused` |

**The code is the line's position in the catalogue**, so the two can't drift:
`apiLogLines.audio.rendered` *is* `api.audio.rendered`.

- **The API's catalogue** is `packages/domain/src/logLines.ts`. Each entry declares its
  level, its message and a description of what it means. A call site is
  `request.log.info(apiLogLines.audio.rendered({ key, bytes }))` — the level stays at the
  call site so `.error(` still greps, and the message and code come from the catalogue.
- **The TTS service's** is `services/tts/src/overview_tts/log_lines.py`, the same scheme
  under `tts.*`. A call site is `log_lines.RENDER_FINISHED.write(log, bytes=len(audio))`,
  and the level comes from the entry because Python's logger takes it as the method.

**The field is `logCode`, not `code`.** A refusal already logs the API error's `code`
(`invalid_grant`, `client_unsupported`) and an error serialises its own, and a second
meaning on that name would have overwritten them.

**Fastify writes a dozen lines of its own** — the request pair, a route not found, a stream
that closed early, a serializer that threw — several of them named by an error's message.
`CodedLogController` (`logs/CodedLogController.ts`) overrides every one with a line from the
catalogue, through Fastify 5's `logController` option.

**A line from a library can't declare a code**, so the TTS service's formatter gives it one
by the library's name: Kokoro's own notices are `tts.thirdParty.kokoroOnnx`, the phonemizer
it calls is `tts.thirdParty.phonemizer`, and uvicorn's lifecycle lines are
`tts.thirdParty.uvicorn`. Nothing reaches PostHog uncoded, and `tts.thirdParty.*` is one
clause to filter out.

**Library chatter is demoted to debug, not left at warn.** The phonemizer checks that every
word came back as phonemes and warns when it didn't — `words count mismatch on 200.0% of the
lines (2/1)` — several times a render, and the audio is fine. At warn it made "every warning
from the TTS service" almost entirely that line. `configure_logging.py` demotes anything below
error from `phonemizer` and `kokoro_onnx`, and uvicorn's info lifecycle lines (`Started server
process`, `Application startup complete` and the rest), to debug. The service logs at info,
so they are dropped; a root logger at debug still shows them. An error from either library,
and a uvicorn warning, keep their level.

**The service is on every line too**, as `service` (`overview-api` or `overview-tts`). The
TTS service already put it there; the API only had it as an OTLP resource attribute, which
PostHog's `service` column doesn't read, so every API row showed blank.

**Adding a line:** add it to the catalogue with its level, message and description, then
call it. `logCodes.test.ts` fails if a log call writes a message of its own instead, and
`logLines.test.ts` fails on a duplicate code, a code that doesn't match its position, or a
description too short to act on. `test_log_lines.py` does the same for the TTS service.

The request pair is about five in six lines by volume, so most queries start by excluding
`api.http.requestReceived` and `api.http.requestCompleted`. Both are kept: a call that
started and never finished is only visible as a received line with no completed one.

## Which level

A log says what the system did. What a reader did is an event (`analytics.md`, "Three
kinds of record"), and the two aren't swapped for each other.

| Level | When | For example |
|---|---|---|
| `fatal` | the process can't go on | an exception nothing caught |
| `error` | something failed that someone must fix: an unexpected exception, a dependency down with no fallback, data that can't be read. An unexpected exception also becomes an issue in error tracking. A failure the code caught, such as a render that gave up, is a log line only | `unhandled error`, `audio render gave up` |
| `warn` | degraded but handled: a refusal, a fallback, a retry, a limit hit, a delivery skipped | `request refused`, `client events not forwarded` |
| `info` | a step that means something to the business, done: once per operation, never once per loop iteration | `record written`, `changes served` |
| `debug` | detail for local development. Production logs at `info` and drops it | |

**A message** is a short lower-case phrase that says what happened, in the past tense
(`record written`, not `writeRecord` or `Writing record...`). The fields carry the rest.
Lines named in camelCase before OV-71 (`shareCreated`) have been renamed this way.

**Every line made while handling a request goes through `request.log`**, never `app.log`.
`request.log` adds the `reqId`, and the ids below once they are known.

### Who a request was for

As soon as a request has said who it's from, `bindLogContext` adds that to every later line
for it, `request completed` included:

| Field | Bound by | Is |
|---|---|---|
| `clientVersion` | `clientVersionPlugin` | the version the client sent in `X-Client-Version` |
| `surface` | `clientVersionPlugin` | `web` or `extension`, from `X-Client-Surface`, which every app-core API client and the extension's worker send. Anything else is left off |
| `accountId` | `sessionPlugin`, `connectionAccessPlugin` | the opaque account id, the one error tracking and events already carry |
| `sessionId` | `sessionPlugin` | the session's row id, never its token or the token's hash. Each device signs in separately, so this tells one reader's devices apart |
| `connectionId` | `connectionAccessPlugin` | the assistant connection an `/mcp` call came through |

Signing in logs `session created` with the new `accountId`, `sessionId` and `surface`, and
signing out logs `signed out` under the same two. A
support question then runs as: the account, its sessions (one per device), and each
session's writes and feed reads. The account id is the only way into this from a reader,
so finding it from their email is a database lookup, never a log search: an email is
never logged.

### What every request logs

- **A refusal.** Every refusal is logged at `warn` as `request refused` (`logRefused`), with
  `code` and `status`. That covers every `ApiError` and every 4xx Fastify raises itself, under
  `/api`, `/s`, `/oauth` and `/mcp`, plus an `/mcp` call without a valid token. An OAuth
  refusal's `code` is its OAuth error (`invalid_grant`). Of the `details` sent
  to the client, only the ids, numbers and enums are logged (`LOGGED_DETAILS` in
  `apiErrorHandler.ts`): `kind`, `rev` and the schema versions. A validation failure's
  `detail` can quote what was sent, so it's never logged. The route is on the request's
  own lines.
- **A 500.** See "The server's own errors".

### Versions

A client below the floor trying to write is a `request refused` with
`code: "client_unsupported"`, its `clientVersion`, `minSupportedClientVersion` and
`surface`. So "who is still on an old extension" is a filter on those lines.

### Sync

| Line | Level | Fields |
|---|---|---|
| `record written` | `info` | `kind`, `id`, `rev`, `seq`, `deleted`, `schemaVersion`, and `migratedFrom` when the write moved a stored record up from an older schema version |
| `record already deleted` | `info` | `kind`, `id`: a delete retried after it was done |
| `changes served` | `info` | `since`, `next`, `count`, `more` |

A conflict (`already_exists`, `revision_mismatch`, `record_newer_than_client`) and a write
from below the floor (`client_unsupported`) are `request refused` lines. For a note
that's missing on one device:

1. Filter on the note's `id`. Its `record written` lines show whether it reached the
   server, at which `seq`, and from which `sessionId`.
2. Filter on the other device's `sessionId` (from its account's `session created` lines)
   for `changes served`. A `next` that never reaches that `seq` means the device stopped
   pulling. A `request refused` instead means the server turned it away, and its `code`
   says why.

### Transcripts

`docs/features/shared-transcript-cache.md`, "Logs", lists them: `transcript stored`,
`transcript not kept`, `transcript refused`, `transcript served`, `shared transcript read`
and `transcripts forgotten`. A transcript line never carries the video id or a word of the
transcript. A signed-in one carries the account and session, so a reader's missing
transcript is found by their `sessionId`, as a missing note is.

### Audio

`docs/features/tts-pre-rendered-speech.md`, "The API side", lists them: `audio requested`,
`audio queued`, `audio rendered`, `audio render failed` (`warn`, to be tried again),
`audio render gave up` (`error`), `audio worker stopped` (`error`) and `audio deleted`.
The renders run on the API's queue, outside any request, so their lines carry no `reqId` or
account. They're joined to the request by the audio `key`, which both carry, and to the TTS
service's lines by `ttsRequestId` ("The TTS service"). A failure's
message goes through `redactErrorMessage`, because the TTS service's error can quote a
spoken line.

### Sign-in and mail

| Line | Level | Fields |
|---|---|---|
| `magic link sent` | `info` | `surface`, `purpose` |
| `magic link held back` | `warn` | `surface`, `intent`, `reason: "cooldown"`: a second link asked for inside a minute, answered as if sent |
| `signed in`, `account created` | `info` | `accountId`, `intent`, `surface` |
| `session created` | `info` | `accountId`, `sessionId`, `surface` |
| `signed out` | `info` | `transport`, under the ending session's `accountId` and `sessionId` (`docs/features/account-libraries.md`) |
| `link code issued` | `info` | `transport` |

Mail that can't be sent fails the request, so it's an `unhandled error` with the
provider's answer (`Brevo answered 503`). It's reported to error tracking like any other
500, because a reader who can't get a link can't sign in at all. No line carries the
address, the link or its token.

### Shares

`share created`, `share revoked`, `share viewed` and `share page missing` (`state`:
`unknown` or `revoked`), all at `info` (`docs/features/sharing.md`, "Counting"). None of
them carries the token or anything from the note. The owner's lines carry their account and
session. A viewer's carry nothing about them.

### The database

- **`slow query`** (`warn`), with `durationMs` and `statement`: any query at or over 500 ms
  (`SLOW_QUERY_MS` in `timedSqlClient.ts`). The statement is the code's own SQL, with
  whitespace collapsed and cut at 120 characters. Its parameters are the reader's data and
  are never logged. **`slow transaction`** is the same for a whole transaction.
- **`database connection lost`** (`error`): the pool's `error` event, for an idle connection
  the database dropped. Before this, nothing listened for it, and an unheard `error` event
  crashes the process. The pool replaces the connection on the next query.

A query has no request in hand, so `trackCurrentRequest` (`logs/currentLog.ts`) keeps the
current request in `AsyncLocalStorage`, and `currentLog` hands the database client that
request's logger. A slow query then carries the `reqId`, account and session of the
request that made it. Outside a request, such as the audio queue, it logs on the app's
logger.

## What a log line may carry

A request is logged by its **route**, `{ method, route }`, never by its URL or the
caller's address. A path can hold a share token (`/s/:token`, `/api/shares/:token`) or a
video id, and a query can hold an OAuth `state` or an address someone typed. Fastify's
default request log carried all of that, and the caller's IP address too. That had
already broken the rate limits' promise never to log an address, and shipping would have
copied it all to a third party. A request no route matched is logged with `route: null`.
The response is logged by its status. `createLogger.test.ts` fails if a token, a query or
an address appears in a line.

**An error** is logged by its type, its message through `redactErrorMessage`, its `code`
and its stack, and nothing else (`createLogger`'s `err` serializer). pino's own serializer
copied every field an error has. A Postgres error's `detail` quotes the row it refused
(`Key (email)=(...)`), so that would have put an address in the logs.

Otherwise the logs are what they were: ids, never names or content
(`docs/architecture/api.md`).

## Finding what happened

PostHog's error tracking has an error's `request_id`, the id of the call that failed. In
PostHog's Logs, filter on `reqId` equal to that id to see the server's lines for the call.
Filter on `failedRequestId` to find the server's `client error` line for the report
itself.

Otherwise, start from the code. `logCode = api.audio.rendered` is every render that
finished; `logCode` starting `api.audio.` is the whole of narration, request to render to
delete; `logCode` starting `tts.` is what the Kokoro pool was doing at the time. A narration
that never arrived is `api.audio.queued` with no `api.audio.rendered` for the same `key`,
and the TTS service's side of it is joined by `ttsRequestId`.

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

The TTS service has its own copy of the token. Run `task deploy:tts:secrets` once, after
which a render that fails reports itself.

## Not built yet

- **Traces.** Logs are joined by request id, not by a trace. If a request ever spans more
  than this one process, OpenTelemetry tracing is the next step.
- **One copy of the extension's session.** Keeping the connection in `chrome.storage`
  rather than `localStorage` would let the worker read the original rather than a copy.
  It is a larger change to how the app reads its connection in the extension.
