# The API

`apps/api` is the Fastify service `docs/architecture/v1-architecture-decisions.md` named and
did not build: the thin sync server of Model D. This document is the service itself: what
it is made of, how a caller is identified, what the two version numbers on the wire mean,
the one error shape, and how it is configured and run. What it stores and how the sync
endpoints behave is `docs/features/sync-api.md`; how it is tested is
`docs/conventions/backend-testing-guide.md`.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Fastify 5, TypeScript, NodeNext, built to `dist` like every package | `apps/api/package.json`, `tsconfig.json` |
| Postgres behind one small interface, `pg` in production and PGlite in tests | `src/db/SqlClient.ts`, `createPgSqlClient.ts`, `createPgliteSqlClient.ts` |
| SQL migrations in Flyway's naming, applied by an in-repo runner | `migrations/V*.sql`, `src/db/runMigrations.ts` |
| Accounts and sessions; bearer tokens, hashed | `migrations/V0001__accounts_and_sessions.sql`, `src/auth/` |
| Magic-link sign-in, the cookie transport, and the extension's link code | `migrations/V0003__magic_links_and_link_codes.sql`, `V0005__account_first_names_and_link_intents.sql`, `V0011__magic_link_anonymous_ids.sql`, `src/auth/authRoutes.ts`, `src/auth/sessionCookie.ts`, `src/mail/`; `docs/features/sign-in.md` |
| Deny-by-default session plugin; routes opt out with `config: { public: true }` | `src/auth/sessionPlugin.ts` |
| One client version on the wire, and the table that turns it into schema versions | `packages/domain`: `clientVersion.ts`, `clientSchemaVersions.ts` |
| The handshake, and the write floor as a hook | `src/versions/handshakeRoutes.ts`, `writeFloorPlugin.ts` |
| One error envelope, codes and statuses shared with the clients | `packages/domain/src/ApiErrorCode.ts`, `ApiErrorEnvelope.ts`; `src/http/` |
| Configuration from the environment, refused at startup when wrong | `src/loadConfig.ts` |
| The extension's origin vouched for, from an allowlist in the environment | `src/http/corsPlugin.ts`, `allowedOriginsFromEnv.ts` |
| A session minted from the command line, with no email involved | `src/scripts/mintSession.ts` |
| Rate limits per address, per account, and on the four sign-in routes, answered `429` with `Retry-After` | `src/rateLimit/`; "Rate limits", below |
| Each account's transcripts, outside the records feed | `migrations/V0004__transcripts.sql`, `src/transcripts/`, `src/routes/transcriptRoutes.ts`; `docs/features/transcript-storage.md` |
| An account's plan, and the OAuth 2.1 authorization server MCP clients connect through, outside `/api` | `migrations/V0008__account_plans_and_connections.sql`, `src/oauth/`; `docs/features/mcp-connector.md` |
| The MCP endpoint, `/mcp`, and its read-only tools over a reader's overviews and transcripts | `src/mcp/`; `docs/features/mcp-connector.md` |
| Shared transcripts, read by anyone, added to by accounts, served once two agree; the script that removes a bad one | `migrations/V0009__shared_transcripts.sql`, `src/transcripts/`, `src/scripts/forgetSharedTranscript.ts`; `docs/features/shared-transcript-cache.md` |
| Our own server fetching a transcript, the ladder's last rung: direct, then through the residential proxy, under daily quotas and a proxy budget; the check through the real proxy | `migrations/V0012__service_transcript_usage.sql`, `src/transcripts/`, `src/routes/serviceTranscriptRoutes.ts`, `src/scripts/proxySanityCheck.ts`; `docs/architecture/server-side-transcripts.md` |
| A shared copy of an overview behind an unguessable link, and the public document and card image it serves at `/s/<token>`, outside `/api` | `migrations/V0010__shares.sql`, `src/shares/`, `src/routes/shareRoutes.ts`, `apps/api/assets/fonts/`; `docs/features/sharing.md` |
| The app's analytics at `POST /api/events`, from a session or under the anonymous id a reader without an account agreed to, checked against the catalogue, logged, and passed on to PostHog when there is a key | `packages/domain`: `analyticsEvents.ts`, `AnalyticsEventBatch.ts`; `src/events/`; `docs/architecture/analytics.md` |
| The app's errors at `POST /api/errors`, with or without a session, redacted again, logged, and passed on to PostHog's error tracking when there is a key | `packages/domain`: `ClientErrorBatch.ts`, `redactErrorMessage.ts`; `src/errors/`; `docs/architecture/errors-and-logs.md` |
| One id per request, the client's when it sent a usable one, said back in `X-Request-Id` | `packages/domain/src/RequestId.ts`, `src/http/requestIdFor.ts`; "Request ids", below |

## Shape

```
apps/api/
  migrations/            V0001__accounts_and_sessions.sql, V0002__records.sql, V0003__magic_links_and_link_codes.sql, V0004__transcripts.sql, …, V0006__audio_renders.sql, V0007__voice_samples.sql, V0008__account_plans_and_connections.sql, V0009__shared_transcripts.sql, V0010__shares.sql, V0011__magic_link_anonymous_ids.sql, V0012__service_transcript_usage.sql, …, V0015__magic_link_email_codes.sql, V0016__followed_playlist_records.sql, V0017__overview_video_ids.sql, V0018__one_overview_per_video.sql
  assets/fonts/          the two faces the Open Graph card is drawn in, bundled because the image has none
  src/
    server.ts            env → SqlClient → migrations → mailer → buildApp → listen
    buildApp.ts          the /api scope: error handler, CORS, then address limit → parse → floor → session → account limit, then routes; the OAuth, MCP and /s scopes beside it
    loadConfig.ts
    db/                  SqlClient and its two implementations; the migration runner
    http/                ApiError, the handler, parseOrThrow, If-Match and ETag helpers, CORS, the request id
    auth/                accounts, sessions, the plugin, the cookie, GET/DELETE /api/session, POST /api/session/link-code, the four /api/auth routes
    mail/                the Mailer interface, the magic-link email, Brevo, the log
    versions/            client version parsing, the floor, the handshake, the write guards
    records/             the repository and the three pure write decisions
    transcripts/         the shared copies per video, each account's link to its own, who fetched what, and what a contribution must be
    oauth/               the authorization server's routes, the consent and connections routes, clients, codes, tokens and their lookups
    mcp/                 /mcp: the access-token plugin, the JSON-RPC handler, the tools and prompt, reading and searching a library
    shares/              /s/<token>: the repository, the document and its Open Graph head, the card image and the text measuring it is laid out with
    audio/               the render queue and its repository, the audio key, the Narrator and AudioStore seams, R2 and file stores, the voice samples and their seed
    events/              POST /api/events, the EventSink seam, PostHog for events, the caller's address cut to a network
    errors/              POST /api/errors, the ErrorSink seam, PostHog's error tracking
    postHog/             PostHog's one batch call, shared by events and errors
    logs/                pino with a route-only request log, written to stdout and to an OTLP log endpoint
    playlists/           reading a YouTube playlist whole through the Data API, and telling a private one from a missing one
    rateLimit/           the limits, the fixed-window limiter, the hook that throttles, the caller's address
    routes/              changes, overviews, topics, settings, followed playlists, playlists, transcripts, audio, shares
    scripts/             mintSession, setPlan, seedVoiceSamples (the deploy's release step), forgetSharedTranscript
    testing/             createTestApp, TestAccount, record fixtures (.testHelper.ts)
```

`buildApp({ config, sql, mailer, audio, eventSink, clock })` takes everything it depends on, so a test
builds the same app over an in-process database with a clock it owns, and a mailer and an
event sink that record, and `server.ts` is the only place the environment is read.

## Auth

**Auth exists to gate writes to shared infrastructure**, which is the reasoning
`v1-architecture-decisions.md` gives, and nothing here changes it. Every `/api` route needs
a session unless it says otherwise; eight do: `GET /api/health`, `GET /api/handshake`, the
four `/api/auth` routes that exist to make a session, `GET /api/shared-transcripts/:videoId`,
which only reads what accounts have added (`docs/features/shared-transcript-cache.md`),
`GET /api/playlists/:id`, which reads a public or unlisted playlist for anyone following
one (`docs/features/playlists.md`),
and anything outside `/api`: the web app's files, the OAuth routes MCP clients call,
which have their own tokens and never resolve a session (`docs/features/mcp-connector.md`),
and `/s/<token>`, the shared copy of an overview, which is read by the people the reader
sent the link to and by whatever unfurls it in their chat app (`docs/features/sharing.md`).

**The mechanism is a session row, and the transport is a bearer token or a cookie.** An
opaque 32-byte token is minted once, handed back once, and only its SHA-256 hex is stored,
in `sessions.token_hash`. `Authorization: Bearer <token>` resolves it, and so does the
`overview_session` cookie, which carries the same kind of token onto the same row; the
plugin looks for the bearer first and the cookie only in its absence. Missing, unknown and
expired tokens get one answer, `401 unauthenticated` with a `WWW-Authenticate: Bearer`
challenge, because the client has one response to all three and a prober learns nothing
from the difference.

**Which transport is whose.** The web app shares this service's origin, so a cookie set by
the sign-in response is sent by the browser on every call with no script holding a secret.
The extension is another origin, so it holds a bearer and sends the header. Both are set
out in `docs/features/sign-in.md`, with the cookie's attributes and why a cross-site write
is refused before any handler runs. No refresh token: a server-held row is revocable by
deleting it, which is all a refresh token buys.

**Lifetime.** Thirty days, sliding: a request more than an hour after the session was last
seen moves both `last_seen_at` and `expires_at` forward, and a request within the hour
rewrites nothing. `SESSION_TTL_DAYS` sets the thirty. Expired rows are ignored rather than
swept; a sweep is a later cron.

**How a session is born in this slice.** `npm run mint-session -- <email>` in `apps/api`
creates the account if it is new and prints a token to stdout and everything else to
stderr, so `TOKEN=$(npm run -s mint-session -- me@example.com)` works. Tests use
`makeSession` in `SessionFactory.testHelper.ts`, the same code path in process.

**What the sign-in slice adds, named so it is not rediscovered:** a `magic_links` table
(hashed one-time token, fifteen-minute expiry, `consumed_at`), `POST /api/auth/magic-link`
answering 202 whether or not the account exists, `GET /api/auth/callback?token=` consuming
the link and setting the cookie, an extension link-code exchange so the panel gets its
bearer, and a transactional email provider, which is still unchosen.

**Three routes belong to the session:** `GET /api/session` says who is signed in and when it
expires, which is the startup check both shells will make and where a plan will one day be
read from instead of `Settings.plan`; `DELETE /api/session` deletes the row, clears the
cookie when the cookie was the transport, and answers a second call with the same token
`401`, which is right: the effect is idempotent, the status is not; `POST
/api/session/link-code` mints a link code for the session's own account, so a signed-in
web app can hand the extension beside it a way in with no second email
(`docs/features/sign-in.md`).

## Origins

The web app shares this service's origin, so the browser lets it call `/api` with no
ceremony. The extension's panel is `chrome-extension://<id>`, a different origin, so
before every sync call the browser asks this server whether that origin may read the
answer, and before a write it asks in advance, with a preflight that carries no token.
`src/http/corsPlugin.ts` answers both, for the origins in `CORS_ALLOWED_ORIGINS` and no
others.

**Why the server and not the manifest.** A host permission would exempt the extension's
own pages from the check, but it has to name the API's origin in the manifest, and the
server's address is a setting, filled in with production and `localhost` in development. Naming it there
would mean an optional permission and a runtime prompt on connect, built in the shell.
One line of config on the server does the same job with nothing to build.

**An allowlist, never `*`.** The browser attaches the session cookie to a request from any
origin it vouches for that asks with credentials, so vouching for every origin would be
the hole, and a permissive setting nobody remembers is how it would become one.
`loadConfig` refuses `*` and anything carrying a path, and the CORS plugin never sets
`Access-Control-Allow-Credentials`, so a listed origin can send a bearer and cannot borrow
the cookie. Empty, the default, registers nothing and the service behaves exactly as it
did: a preflight is the same 404 as any unknown route.

**What is vouched for.** GET, POST, PUT and DELETE; the six headers a sync request
carries, `Authorization`, `Content-Type`, `If-Match`, `X-Client-Version`,
`X-Client-Surface` and `X-Request-Id`;
and `ETag`, `Retry-After` and `X-Request-Id` exposed, so the answer to a write, or to a
throttle, can be read whole and matched to the server's log of it. The preflight is answered before the
parse, floor and session hooks run, because it carries no token and a 401 on it would
reach the client as an unreachable server rather than a sign-out. The origin is echoed
on error responses for the same reason: an envelope the browser hides reaches the client
as a transport failure, and `stopReasonFor` would call a sign-out, or a write the server
refused, being offline.

**Finding the extension's origin.** An unpacked build's id is derived from its directory
and shown at `chrome://extensions` until the store's key is in its manifest, after which
it is the store's id everywhere and `task deploy:extension:id` prints the origin
(`docs/architecture/deploy.md`, "The extension"). `.env.tpl` has the line, `.env.local` is
where a per-checkout id goes until then, and `docs/conventions/local-dev.md` has the step.

## Versions on the wire

`docs/features/record-migrations.md` binds the handshake to two numbers and the write rule
to "a client may write to a record it can read, enforced server-side". This is how both
are carried.

**One number: `X-Client-Version`.** `CLIENT_VERSION` in `packages/domain/src/clientVersion.ts`
is bumped deliberately, when a migration registry moves or the wire contract changes in a
way the floor must be able to exclude, not on every release. Every request may send it; every
write must. Malformed is `400` on any route; absent on a write is `400` too, since a write
with no version cannot be checked.

**`X-Client-Surface`** says which shell sent the request, `web` or `extension`. It's only
ever logged, never used for a decision, so a value that isn't one of the two is ignored
rather than refused (`errors-and-logs.md`, "Who a request was for").

**From that number the server derives everything else it knows about the caller.**
`clientSchemaVersions.ts` is a table, one row per client version that moved a registry,
mapping it to the four per-kind schema versions (`overview`, `overviewState`, `topic`,
`settings`). `schemaVersionsForClient(v)` takes the greatest row at or below `v`, and a
client above the whole table is taken to be at least the last row. A test fails if a
registry moves without a new row, which is the same trick the migration corpus uses. The
alternative, a second header listing per-kind versions, was rejected because it is a second
claim that can disagree with the first, and the server has no way to say which is the lie.

**The table is release metadata, so it lives beside the registries** rather than in
Postgres, where it would need populating at deploy time and could drift from the code
that defines the versions.

**A client can lie about its version, and the lie only widens its own write surface.** A
stale client claiming a newer version can pass the floor and field-patch a record it
cannot display; the merge migrates the stored body to the smaller of the claimed and the
server's version and keeps every unknown key, so the worst outcome is marking read
something the liar cannot render. A whole-record write must carry a `schemaVersion` equal
to the claimed per-kind version, and if the server knows that version it parses the body
against the schema. Every write is scoped to the caller's account. This is what
`docs/features/sync-metadata.md` means by enforcing against the stored record rather than
the claim.

**The handshake.** `GET /api/handshake`, public, `Cache-Control: no-store`, always 200:

```json
{ "minSupportedClientVersion": 1, "currentClientVersion": 1 }
```

Below the first, writes are refused and the client shows its wall. The second is the
server's own `CLIENT_VERSION`, which is how a web tab can tell that a reload is all it
needs. `record-migrations.md` called the second number `currentSchemaVersion`; it is
renamed here because there are four schema versions, and a number named after the wrong
thing gets used as that thing. The correction is recorded in that document's table.

**The floor is a hook, and it has no exemptions.** In the `/api` scope the hooks run in
the order address limit, parse, floor, session, account limit (the two limits are "Rate
limits", below): a client below the floor is told to update before it is told to sign in,
and without a database round trip. Reads are served below the floor, so
the wall can still say who is signed in. `DELETE /api/session` is a write and is refused
too: a walled client offers no logout and the token expires on its own. One rule with no
exceptions cannot be misapplied.

**Per-record checks live in the write path, not the hooks**, because they need the stored
row: `record_newer_than_client` when the stored `schemaVersion` exceeds the caller's for
that kind, `revision_mismatch` when `If-Match` does not match. `docs/features/sync-api.md`
has both.

## Errors

Every failure under `/api` is one shape, and the codes and their statuses are in
`packages/domain/src/ApiErrorCode.ts` so the client's API store parses what the server
sends:

```json
{ "error": { "code": "revision_mismatch", "message": "The record has changed since it was read", "details": { "rev": 7 } } }
```

| Code | Status | When |
|---|---|---|
| `invalid_request` | 400 | body, header or query fails validation; malformed JSON; a body written at a version other than the client's own |
| `unauthenticated` | 401 | no, unknown or expired bearer |
| `client_unsupported` | 403 | a write from below `minSupportedClientVersion`; `details` carry both numbers |
| `plan_required` | 403 | the account is not on the plan the action needs: approving an assistant's connection needs Plus |
| `not_found` | 404 | no such route, or no such live record in this account |
| `already_exists` | 409 | a create-only write onto a live record |
| `video_already_held` | 409 | a second overview of a video the account holds; `details.overviewId` names the first (`docs/features/one-overview-per-video.md`) |
| `link_invalid` | 410 | a magic link or link code that is spent, expired, or was never issued; one answer for all three |
| `record_newer_than_client` | 409 | the stored record's version exceeds the caller's for its kind |
| `revision_mismatch` | 412 | `If-Match` does not match; `details.rev` is current |
| `playlist_private` | 422 | the playlist asked for is private on YouTube, so it can't be read (`docs/features/playlists.md`) |
| `playlist_not_found` | 404 | there is no playlist with that id, or it was deleted |
| `transcript_unavailable` | 422 | our own server could not fetch a video's transcript; `details.failure` names the `TranscriptFetchFailure`, `budget-exhausted` included (`docs/architecture/server-side-transcripts.md`) |
| `too_many_requests` | 429 | a rate limit is spent, with `Retry-After` and `details.retryAfterSeconds` saying when to try again; or an account already has its limit of narration waiting to be rendered, and `details.limit` says how many |
| `internal_error` | 500 | anything unexpected; logged with the request id, nothing about the cause sent |
| `unavailable` | 503 | the health check cannot reach the database; narration asked of a server with no TTS service; a transcript asked of a server with server-side retrieval off; a playlist asked of a server with no YouTube key |

**426 was considered for the floor and rejected.** RFC 9110 reserves it for a protocol
upgrade and requires an `Upgrade` header naming one. 403 is exact: authenticated,
understood, and refused for a reason no resend from this client can change. The floor is
about the client; `record_newer_than_client` is about the resource's state, which is what
409 says.

## Request ids

Every request is logged under one id, and the client makes it. `createApiRequester` sends a
fresh UUID in `X-Request-Id` with every call; `requestIdFor` takes it as Fastify's request id
when it is 8 to 64 letters, digits and hyphens, and mints a UUID when it is missing or
anything else, because the id is written into every log line for that request and a header
is whatever the caller chose to put in it. Every answer says the id back in the same
header, and a refused call's `SyncRequestError` carries it as `requestId`, so a failure the
app reports and the server's lines for the same call can be found by one string. Nothing
takes a client's report of a failure at `POST /api/errors`, which logs that call's id as
`failedRequestId` (`docs/architecture/errors-and-logs.md`).

## Rate limits

Every limit is a fixed window counted in this process's memory, and a request past it is
`429 too_many_requests` with `Retry-After` in whole seconds and the same number in
`details.retryAfterSeconds`, because the clients read the envelope rather than headers.
Each throttle is logged at `warn` as `throttled` with the limit's name, the route and the
wait, and never the address or the email, so the numbers can be tuned from real traffic.

| Limit | Counts | Per | Where |
|---|---|---|---|
| `address` | 1,200 | minute, per address | every `/api`, `/oauth` and `/mcp` request, before anything else runs |
| `account` | 600 | minute, per account | every request with a session, after the session is known |
| `magicLinkAddress` | 20 | hour, per address | `POST /api/auth/magic-link` |
| `magicLinkEmail` | 10 | hour, per normalised email | `POST /api/auth/magic-link` |
| `signInAddress` | 30 | hour, per address | `POST /api/auth/sign-in` |
| `emailCodeAddress` | 30 | hour, per address | `POST /api/auth/email-code` |
| `emailCodeEmail` | 10 | hour, per normalised email | `POST /api/auth/email-code` |
| `linkCodeAddress` | 30 | hour, per address | `POST /api/auth/link-code` |
| `oauthRegisterAddress` | 20 | hour, per address | `POST /oauth/register` |
| `oauthTokenAddress` | 60 | minute, per address | `POST /oauth/token`, `POST /oauth/revoke` |
| `mcpAccount` | 120 | minute, per account | every `/mcp` request, after its access token is known |
| `sharedTranscriptAddress` | 300 | hour, per address | `GET /api/shared-transcripts/:videoId` |
| `serviceTranscriptAddress` | 60 | hour, per address | `POST /api/service-transcripts/:videoId`, on top of the daily fetch quotas kept in Postgres (`docs/architecture/server-side-transcripts.md`, "Limits") |
| `playlistAddress` | 120 | hour, per address | `GET /api/playlists/:id`: each read spends YouTube Data API quota shared by every reader (`docs/features/playlists.md`) |
| `sharePageAddress` | 600 | hour, per address | `GET /s/:token` and its card and audio |
| `eventsAccount` | 60 | minute, per account | `POST /api/events`: a batch per two seconds at the most the app sends, with room for a second tab (`docs/architecture/analytics.md`) |
| `anonymousEventsAddress` | 60 | minute, per address | `POST /api/events` without a session, and `POST /api/events/declined`: per address, because a reader without an account has no account to count against (`docs/features/analytics-consent.md`) |
| `sharedPageEventsAddress` | 60 | minute, per address | `POST /api/shares/:token/events`: per address, because most people on a shared link have no account (`docs/architecture/analytics.md`, "The shared page") |
| `errorsAddress` | 30 | minute, per address | `POST /api/errors`: per address, because most readers sending errors have no account (`docs/architecture/errors-and-logs.md`) |

The numbers are in `src/rateLimit/rateLimits.ts`. What they are for:

- **`address` is refused before the session is looked up**, so a flood of made-up tokens
  costs a map lookup rather than a database round trip, and it covers the public routes
  as much as the private ones. It is high because a household or an office shares one
  address.
- **`account` is the sync limit.** The sync client pushes one request per outbox entry,
  so a first sync of a large library is a burst: 600 a minute is ten a second held for a
  minute, far past anything a reader does and well short of what would hurt one small
  machine. A sync throttled mid-push stops the cycle as `failed` and carries on at the
  next one, with nothing parked (`docs/features/sync-client.md`), so a very large first
  sync takes a few cycles rather than failing.
- **Asking for a link is limited both ways.** Per address stops one caller mailing many
  inboxes and spending the mail provider's daily allowance; per email stops many callers
  filling one inbox. They sit on top of the one-minute cooldown in `sign-in.md`, which
  still answers `202` silently. The per-email limit is honest instead: someone flooding an
  address can keep its owner from asking for an hour, and a `429` that says how long is a
  better answer to the owner than a `202` for a mail that never comes. It says the same
  whether or not the account exists, so it tells a prober nothing.
- **Sign-in and link codes are limited per address** because both take a guess. A link
  token is 256 bits and needs no limit; a link code is 40 bits and ten minutes, which
  `sign-in.md` argued was enough on its own, and thirty guesses an hour per address puts
it further out of reach.
- **`mcpAccount` is shared by all of a reader's assistants.** An assistant working through
  a question calls a tool every few seconds, and paging a large topic is a burst of a few
  dozen. Two a second held for a minute is well past that, and every call reads the
  reader's whole library, so it is kept lower than the sync limit.
- **The shared transcript cache is limited per address** because it is read without a
  session, so the account limit never applies to it. Each read is one note being made or
  one transcript being refilled, so 300 an hour is far past a household's use and turns
  copying the cache out one video at a time into a slow job. It is not meant to stop a
  determined scraper with many addresses: what it guards is public captions, and
  `docs/features/shared-transcript-cache.md` says why that is enough.
- **The shared page is limited per address** for the same reason as the shared transcript
  cache: it has no session, so the account limit never reaches it. An account is also held
  to fifty live links at once, which is about this not becoming somewhere to host a
  library rather than about the rate of anything (`docs/features/sharing.md`).
- **A refused request does not count.** A caller hammering past the limit is let back in
  when its window ends, not held out while it keeps knocking.

**The address.** Behind Fly the socket is Fly's proxy, so the caller is read from
`Fly-Client-IP`, which the proxy sets and overwrites, named in `CLIENT_IP_HEADER`. Unset,
the socket's address is used and any such header ignored, so a client talking to the
process directly cannot choose its own address. `X-Forwarded-For` is not used: its first
entry is whatever the client wrote. An IPv6 caller is counted by its `/64`, since one
connection is usually given a whole `/64` and could otherwise take a fresh address per
request; an IPv4 address mapped into IPv6 counts as the IPv4 address.

**In memory, because there is one machine.** `deploy.md` runs one machine, and a limiter
in its memory is exact, costs no round trip, and needs nothing new to run. Two things
follow, and both are accepted. A deploy or a stop resets every window, which only
forgives, and a stopped machine had no traffic to limit. With more than one machine each
counts alone and the limits multiply by the count; the day `fly.toml` runs two, the
windows move to Postgres (a row per key and window, `insert … on conflict do update`),
behind the same `FixedWindowLimiter.take`. Redis was not considered: a second store to
run for one counter.

**Fixed windows, not a sliding log or a token bucket.** A caller can spend a limit at the
end of one window and again at the start of the next, twice the rate for a moment. At
these numbers that burst does no harm, and in exchange the limiter is a count and a start
time per key, the wait it reports is exact, and moving it to Postgres later is one row.

The OAuth routes outside `/api` are counted per address too, with their own `address` window, and
registration and the token endpoint also have their own limits above. Registration is open and makes a row, so it is
limited like asking for a link; codes and tokens are 256 bits and need no guessing limit, so the token limit only
keeps one caller from hammering the database. The static web app outside `/api` is not limited: it is files. Narration keeps its own
limit of renders waiting per account, which is about the TTS pool rather than the rate of
requests, and answers the same code without a `Retry-After`.

## Configuration and running

`loadConfig` reads the environment through zod and refuses to start on anything wrong,
printing the reason. Where the values come from, and how a secret among them is kept out
of the repository, is `docs/conventions/secrets.md`:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection string |
| `PORT` | 3000 | |
| `MIN_SUPPORTED_CLIENT_VERSION` | 1 | the floor; refused if above the server's own `CLIENT_VERSION`, which would refuse the clients it ships with |
| `SESSION_TTL_DAYS` | 30 | |
| `CORS_ALLOWED_ORIGINS` | empty | comma-separated origins the browser may call `/api` from, as the browser sends them: the extension's `chrome-extension://<id>`. Empty vouches for none; `*` and anything with a path are refused |
| `APP_URL` | `http://localhost:5173` | where the web app is served from: every magic link opens `/sign-in` there, and the session cookie is `Secure` when it is https |
| `MAIL_TRANSPORT` | `log` | `log` prints each magic link to the server's output; `brevo` sends it |
| `BREVO_API_KEY` | | required with `brevo` |
| `MAIL_FROM` | | the sender, e.g. `The Overview <signin@example.com>`; required with `brevo`, and with `brevo` `APP_URL` must be https |
| `CLIENT_IP_HEADER` | unset | the header a trusted proxy puts the caller's address in, which the rate limits count by: `fly-client-ip` on Fly. Unset counts by the socket's address. Set it only behind a proxy that overwrites the header, or any client can name itself |
| `STATIC_ROOT` | unset | the built web app to serve outside `/api`; unset serves the API alone and says so at startup (`docs/architecture/deploy.md`) |
| `TTS_URL` | unset | the TTS service narration renders through; unset leaves `/api/audio` answering `unavailable`, and says so at startup |
| `TTS_CONCURRENCY` | 5 | renders at once: the size of the TTS pool (`docs/architecture/deploy.md`, "The TTS service") |
| `R2_BUCKET` | unset | the private R2 bucket narration is kept in; with it, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are required, and the last two are secrets |
| `AUDIO_DIR` | | a directory to keep narration in instead, for working offline; `TTS_URL` needs this or R2 |
| `TRANSCRIPT_SERVICE` | `off` | `on` lets the server fetch transcripts itself, as the ladder's last rung; `off` answers `unavailable`, and says so at startup (`docs/architecture/server-side-transcripts.md`) |
| `TRANSCRIPT_PROXY_URL` | unset | an http(s) residential proxy with its credentials, `{session}` replaced per fetch for a sticky exit address; a secret. Unset fetches only from the server's own address |
| `TRANSCRIPT_PROXY_DAILY_FETCHES` | 1000 | transcripts a UTC day that may go through the proxy, across everyone |
| `YOUTUBE_API_KEY` | unset | the YouTube Data API key playlists are read with; a secret. Unset, `/api/playlists` answers `unavailable` and says so at startup (`docs/features/playlists.md`) |
| `POSTHOG_API_KEY` | unset | the PostHog project the app's analytics are passed on to; unset logs them and stops, and says so at startup (`docs/architecture/analytics.md`) |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` | the project's ingestion host: the EU cloud, where the project is made |
| `ANALYTICS_ENVIRONMENT` | `development` | `development` or `production`, on every event passed on, because the free plan has one project for both |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` and the other `OTEL_*` log variables | unset | where the server's logs are shipped besides stdout. Unset with `POSTHOG_API_KEY` set ships to PostHog; `OTEL_LOGS_EXPORTER=none` ships nowhere (`docs/architecture/errors-and-logs.md`, "Shipping the server's logs") |

`server.ts` applies migrations on every start, under an advisory lock so two starting
machines cannot both apply the same one, then listens. Locally, from the Nix dev shell
(`docs/conventions/local-dev.md`):

```
task secrets                           # .env rendered from .env.tpl and Bitwarden
task run:db                            # Postgres 17 under .local/pg, port 5433
task run:api                           # builds, migrates, listens on :3000
task session -- me@example.com         # a bearer token with no mail involved, if wanted
```

With `MAIL_TRANSPORT=log`, asking for a link from either shell prints it to the API's
output, and opening it on `http://localhost:5173` signs the browser in.

Both scripts read `.env` from the repo root, then `.env.local` if it exists. Without the
shell, the same thing is a
Postgres 17 on port 5433, `npm run mint-session --workspace apps/api -- me@example.com`,
and `npm run dev --workspace apps/api`.

**Deploy the API before or with the clients.** A client newer than the server has its
records stored as given and unvalidated (`docs/features/sync-api.md`); nothing breaks, but
the server's own validation only catches up on its next deploy. The reverse order, server
first, costs nothing.

## Not built in this slice

A sweep of expired sessions, links and codes; a rate limit shared between machines, which
is wanted the day there is more than one ("Rate limits"). Serving the SPA from this process, the image and the Fly.io configuration
are built: `docs/architecture/deploy.md`. The client half of the sync engine is built: `docs/features/sync-client.md`;
sign-in is built: `docs/features/sign-in.md`.
