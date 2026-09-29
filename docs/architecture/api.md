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
| Magic-link sign-in, the cookie transport, and the extension's link code | `migrations/V0003__magic_links_and_link_codes.sql`, `V0005__account_first_names_and_link_intents.sql`, `src/auth/authRoutes.ts`, `src/auth/sessionCookie.ts`, `src/mail/`; `docs/features/sign-in.md` |
| Deny-by-default session plugin; routes opt out with `config: { public: true }` | `src/auth/sessionPlugin.ts` |
| One client version on the wire, and the table that turns it into schema versions | `packages/domain`: `clientVersion.ts`, `clientSchemaVersions.ts` |
| The handshake, and the write floor as a hook | `src/versions/handshakeRoutes.ts`, `writeFloorPlugin.ts` |
| One error envelope, codes and statuses shared with the clients | `packages/domain/src/ApiErrorCode.ts`, `ApiErrorEnvelope.ts`; `src/http/` |
| Configuration from the environment, refused at startup when wrong | `src/loadConfig.ts` |
| The extension's origin vouched for, from an allowlist in the environment | `src/http/corsPlugin.ts`, `allowedOriginsFromEnv.ts` |
| A session minted from the command line, with no email involved | `src/scripts/mintSession.ts` |
| Each account's transcripts, outside the records feed | `migrations/V0004__transcripts.sql`, `src/transcripts/`, `src/routes/transcriptRoutes.ts`; `docs/features/transcript-storage.md` |

## Shape

```
apps/api/
  migrations/            V0001__accounts_and_sessions.sql, V0002__records.sql, V0003__magic_links_and_link_codes.sql, V0004__transcripts.sql
  src/
    server.ts            env → SqlClient → migrations → mailer → buildApp → listen
    buildApp.ts          the /api scope: error handler, CORS, then parse → floor → session, then routes
    loadConfig.ts
    db/                  SqlClient and its two implementations; the migration runner
    http/                ApiError, the handler, parseOrThrow, If-Match and ETag helpers, CORS
    auth/                accounts, sessions, the plugin, the cookie, GET/DELETE /api/session, the three /api/auth routes
    mail/                the Mailer interface, the magic-link email, Brevo, the log
    versions/            client version parsing, the floor, the handshake, the write guards
    records/             the repository and the three pure write decisions
    transcripts/         the per-account transcript repository
    routes/              changes, overviews, topics, settings, transcripts
    scripts/             mintSession
    testing/             createTestApp, TestAccount, record fixtures (.testHelper.ts)
```

`buildApp({ config, sql, mailer, clock })` takes everything it depends on, so a test
builds the same app over an in-process database with a clock it owns and a mailer that
records, and `server.ts` is the only place the environment is read.

## Auth

**Auth exists to gate writes to shared infrastructure**, which is the reasoning
`v1-architecture-decisions.md` gives, and nothing here changes it. Every `/api` route needs
a session unless it says otherwise; six do: `GET /api/health`, `GET /api/handshake`, the
three `/api/auth` routes that exist to make a session, and anything outside `/api`, which
is not registered yet.

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

**Two routes belong to the session:** `GET /api/session` says who is signed in and when it
expires, which is the startup check both shells will make and where a plan will one day be
read from instead of `Settings.plan`; `DELETE /api/session` deletes the row, clears the
cookie when the cookie was the transport, and answers a second call with the same token
`401`, which is right: the effect is idempotent, the status is not.

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

**What is vouched for.** GET, POST, PUT and DELETE; the four headers a sync request
carries, `Authorization`, `Content-Type`, `If-Match` and `X-Client-Version`; and `ETag`
exposed, so the answer to a write can be read whole. The preflight is answered before the
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
the order parse, floor, session: a client below the floor is told to update before it is
told to sign in, and without a database round trip. Reads are served below the floor, so
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
| `not_found` | 404 | no such route, or no such live record in this account |
| `already_exists` | 409 | a create-only write onto a live record |
| `link_invalid` | 410 | a magic link or link code that is spent, expired, or was never issued; one answer for all three |
| `record_newer_than_client` | 409 | the stored record's version exceeds the caller's for its kind |
| `revision_mismatch` | 412 | `If-Match` does not match; `details.rev` is current |
| `internal_error` | 500 | anything unexpected; logged with the request id, nothing about the cause sent |
| `unavailable` | 503 | the health check cannot reach the database |

**426 was considered for the floor and rejected.** RFC 9110 reserves it for a protocol
upgrade and requires an `Upgrade` header naming one. 403 is exact: authenticated,
understood, and refused for a reason no resend from this client can change. The floor is
about the client; `record_newer_than_client` is about the resource's state, which is what
409 says.

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
| `STATIC_ROOT` | unset | the built web app to serve outside `/api`; unset serves the API alone and says so at startup (`docs/architecture/deploy.md`) |

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

Rate limiting beyond the magic link's per-address cooldown; a sweep of expired sessions,
links and codes. Serving the SPA from this process, the image and the Fly.io configuration
are built: `docs/architecture/deploy.md`. The client half of the sync engine is built: `docs/features/sync-client.md`;
sign-in is built: `docs/features/sign-in.md`.
