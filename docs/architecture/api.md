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
| Deny-by-default session plugin; routes opt out with `config: { public: true }` | `src/auth/sessionPlugin.ts` |
| One client version on the wire, and the table that turns it into schema versions | `packages/domain`: `clientVersion.ts`, `clientSchemaVersions.ts` |
| The handshake, and the write floor as a hook | `src/versions/handshakeRoutes.ts`, `writeFloorPlugin.ts` |
| One error envelope, codes and statuses shared with the clients | `packages/domain/src/ApiErrorCode.ts`, `ApiErrorEnvelope.ts`; `src/http/` |
| Configuration from the environment, refused at startup when wrong | `src/loadConfig.ts` |
| A session minted from the command line, until sign-in exists | `src/scripts/mintSession.ts` |

## Shape

```
apps/api/
  migrations/            V0001__accounts_and_sessions.sql, V0002__records.sql
  src/
    server.ts            env → SqlClient → migrations → buildApp → listen
    buildApp.ts          the /api scope: error handler, then parse → floor → session, then routes
    loadConfig.ts
    db/                  SqlClient and its two implementations; the migration runner
    http/                ApiError, the handler, parseOrThrow, If-Match and ETag helpers
    auth/                accounts, sessions, the plugin, GET/DELETE /api/session
    versions/            client version parsing, the floor, the handshake, the write guards
    records/             the repository and the three pure write decisions
    routes/              changes, overviews, topics, settings
    scripts/             mintSession
    testing/             createTestApp, TestAccount, record fixtures (.testHelper.ts)
```

`buildApp({ config, sql, clock })` takes everything it depends on, so a test builds the
same app over an in-process database with a clock it owns, and `server.ts` is the only
place the environment is read.

## Auth

**Auth exists to gate writes to shared infrastructure**, which is the reasoning
`v1-architecture-decisions.md` gives, and nothing here changes it. Every `/api` route needs
a session unless it says otherwise; three do: `GET /api/health`, `GET /api/handshake`, and
anything outside `/api`, which is not registered yet.

**The mechanism is a session row, and the transport is a bearer token.** An opaque
32-byte token is minted once, handed back once, and only its SHA-256 hex is stored, in
`sessions.token_hash`. `Authorization: Bearer <token>` resolves it. Missing, unknown and
expired tokens get one answer, `401 unauthenticated` with a `WWW-Authenticate: Bearer`
challenge, because the client has one response to all three and a prober learns nothing
from the difference.

**Bearer only, for now.** The one-origin decision was made so a cookie session could work
without CORS or cross-site cookies, and that value is not spent by waiting: a cookie can
only be set by a response, and the only response that will ever set one is the magic-link
callback, which cannot exist until an email provider does. The extension is a separate
origin and has to send a header regardless. When the cookie lands it is a second transport
onto the same row, and `bearerToken` is the one function that grows a fallback. No refresh
token: a server-held row is revocable by deleting it, which is all a refresh token buys.

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

**Two routes belong to auth:** `GET /api/session` says who is signed in and when it
expires, which is the startup check both shells will make and where a plan will one day be
read from instead of `Settings.plan`; `DELETE /api/session` deletes the row, so a second
call with the same token is a `401`, which is right: the effect is idempotent, the status
is not.

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
printing the reason:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | required | Postgres connection string |
| `PORT` | 3000 | |
| `MIN_SUPPORTED_CLIENT_VERSION` | 1 | the floor; refused if above the server's own `CLIENT_VERSION`, which would refuse the clients it ships with |
| `SESSION_TTL_DAYS` | 30 | |

`server.ts` applies migrations on every start, under an advisory lock so two starting
machines cannot both apply the same one, then listens. Locally:

```
docker run -d -e POSTGRES_PASSWORD=secret -e POSTGRES_USER=overview -e POSTGRES_DB=overview -p 5433:5432 postgres:17
DATABASE_URL=postgres://overview:secret@localhost:5433/overview npm run mint-session --workspace apps/api -- me@example.com
DATABASE_URL=postgres://overview:secret@localhost:5433/overview npm run dev --workspace apps/api
```

**Deploy the API before or with the clients.** A client newer than the server has its
records stored as given and unvalidated (`docs/features/sync-api.md`); nothing breaks, but
the server's own validation only catches up on its next deploy. The reverse order, server
first, costs nothing.

## Not built in this slice

Magic-link sign-in and the cookie transport; serving the SPA from this process (the
`@fastify/static` half of the one-origin decision, with `index.html` set to revalidate);
Dockerfile, Fly.io and Neon configuration; rate limiting; a session sweep; the client half
of the sync engine, which is the next slice and is named in `docs/features/sync-api.md`.
