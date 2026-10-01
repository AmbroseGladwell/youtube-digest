# Errors and logs

What went wrong for a reader, and what the server was doing when it did. Client errors go
through our own API to PostHog's error tracking, the way events do (`analytics.md`). Each
one carries the account it happened to, the id of the call that failed, and the last few
things the reader did. The server's own logs go to PostHog too, so a client error and the
server's lines for the same call can be found by one request id. This is OV-61.

The first slice is the server's half: `POST /api/errors`, its checks, and passing errors on
to PostHog. The client's reporter, the extension's service worker and shipping the
server's logs come in later slices ("Not built yet").

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
| `source` | where it was caught: `uncaught`, `unhandledRejection`, `routeBoundary`, `failedRequest`, `serviceWorker` | |
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

## Turning it on

There's nothing more to set up than `analytics.md`'s "Turning it on". The same project and
token carry errors, and error tracking is on by default in a new PostHog project. After the
deploy, the startup line reads `analytics` with the EU host rather than "client events and
errors are logged only".

## Not built yet

- **The client's reporter** (slice 2) has these parts:
  - a queue for errors, separate from the events queue and sent before it
  - the trail kept in memory from what `useAnalytics()` records, signed in or not
  - the stack parser and redaction run on the device
  - capturing the router's boundary, `error`, `unhandledrejection` and failed mutations
  - a `requestId` on `SyncTransportError`
- **The extension's service worker** (slice 3) sends each error at once, because the worker
  can be stopped between messages.
- **Shipping the server's logs** (slice 4): pino through OpenTelemetry to PostHog's log
  ingest, configured with the standard `OTEL_EXPORTER_OTLP_*` variables, so another
  destination needs no code change.
- **Source maps.** Frames are minified paths and positions until a build uploads its maps
  to PostHog.
