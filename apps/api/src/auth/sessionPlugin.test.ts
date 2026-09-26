import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeSession } from "./SessionFactory.testHelper.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

test("a request without a session is refused as unauthenticated with a Bearer challenge", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/session" });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  assert.match(response.headers["www-authenticate"] as string, /^Bearer/);
  await close();
});

test("an unknown token is refused the same way as a missing one", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({
    method: "GET",
    url: "/api/session",
    headers: { authorization: "Bearer not-a-real-token" },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  await close();
});

test("an expired session is refused", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now, sessionTtlDays: 1 });
  clock.advance(2 * DAY_MS);

  const response = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });

  assert.equal(response.statusCode, 401);
  await close();
});

test("a valid session resolves the account onto the request", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { email: "reader@example.com", now: clock.now });

  const response = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    accountId: session.accountId,
    email: "reader@example.com",
    expiresAt: "2026-10-26T09:00:00.000Z",
  });
  await close();
});

test("a session used more than an hour after it was last seen has its expiry slid forward", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now });
  clock.advance(2 * HOUR_MS);

  const response = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });

  assert.equal(response.json().expiresAt, "2026-10-26T11:00:00.000Z");
  await close();
});

test("a session used within the hour is not rewritten", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now });
  clock.advance(HOUR_MS / 2);

  const response = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });

  assert.equal(response.json().expiresAt, "2026-10-26T09:00:00.000Z");
  await close();
});

test("the handshake and health need no session", async () => {
  const { app, close } = await createTestApp();

  assert.equal((await app.inject({ method: "GET", url: "/api/handshake" })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: "/api/health" })).statusCode, 200);
  await close();
});

test("an unknown route under /api is a 404 in the envelope, not a session challenge", async () => {
  const { app, close } = await createTestApp();
  const response = await app.inject({ method: "GET", url: "/api/nowhere" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  await close();
});
