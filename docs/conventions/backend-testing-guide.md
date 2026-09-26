# Backend testing guide

`docs/conventions/frontend-testing-guide.md` is frontend-only by its own stated stack and
left backend conventions as a parked decision. `apps/api` is the first backend, so this is
where they get decided. The frontend guide's shape is kept where it transfers: a test
drives the whole thing through one narrow helper, reads as a sentence about behaviour, and
never asserts on internals.

## Two kinds of test

| Kind | Where | Runs against | For |
|---|---|---|---|
| **Unit** | `*.test.ts` beside a pure function | nothing | the write decisions, header parsing, config, version guards |
| **Route** | `*.test.ts` beside a route or plugin | the whole app over PGlite, via `app.inject()` | everything a client can observe |

There is no third kind against a real Postgres in CI. PGlite is Postgres compiled to WASM,
in process: the same SQL, the same `jsonb`, `CHECK`s, `on conflict` and transactions, and
it runs the very same migration files the server applies at startup. What it is not is a
network, a pool or a concurrent client, so the seq-allocation lock is argued in
`docs/features/sync-api.md` rather than proved by a race here. Before a deploy that
changes the schema, run the smoke in `docs/architecture/api.md` against a real Postgres
once.

The runner is `node:test` over `dist`, as every package does it: `npm test` builds and
runs `dist/**/*.test.js`. `app.inject()` opens no port.

## The helpers

`src/testing/createTestApp.testHelper.ts` builds the whole API over a fresh PGlite with
migrations applied and a clock the test owns:

```ts
const testApp = await createTestApp({ minSupportedClientVersion: 2 });
testApp.clock.advance(HOUR_MS);
await testApp.close();
```

`src/testing/TestAccount.testHelper.ts` is the API's equivalent of a page object. One
account per test, so isolation is by account rather than by database, which is cheap and
exercises account scoping on every request:

```ts
const account = await makeAccount(testApp);
await account.inject({ method: "POST", url: "/api/overviews", body: storedOverview() });
const change = await account.change("overview", id);   // read back through the feed
await account.seedRaw("overview", id, 2, rawOverviewAtVersion2(id));  // a record this server did not write
```

`inject` sends the session and client-version headers; `changes` and `change` read the
feed; `seedRaw` inserts a row at any schema version, which is how the migration and floor
cases get a record the current client could not have written.

`src/auth/SessionFactory.testHelper.ts` mints a session in process through the same
`createSession` the CLI uses. Fixtures for records live in
`src/testing/storedRecords.testHelper.ts` and reuse `makeOverview` from
`@overview/store-conformance`.

## Rules

- **Assert through the feed.** A write test checks what `GET /api/changes` says afterwards,
  not what the handler returned. The response is the claim; the feed is the check.
- **Every shared test module ends `.testHelper.ts`**, and production code never imports
  one. There is no lint rule for this yet, as there is none on the frontend.
- **One behaviour per test, named as a sentence.** The name is the documentation.
- **Time is injected.** `createTestApp` hands the app a clock, and the SQL takes the time
  as a parameter rather than calling `now()` where the test needs to see it move.
- **No sleeping.** Sliding expiry, the touch interval and the floor are all tested by
  moving the clock.
- **Errors are asserted by code**, `response.json().error.code`, never by message text.

## What is deliberately not covered

The SPA served by this process, once it is; the Fly.io and Neon wiring; the Python TTS
service, which has its own language and will have its own guide; and concurrency between
two real connections, which is argued rather than tested.
