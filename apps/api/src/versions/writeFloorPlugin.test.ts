import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER } from "@overview/domain";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("a write from a client below the floor is refused with client_unsupported and both numbers", async () => {
  const { app, sql, clock, close } = await createTestApp({ minSupportedClientVersion: 1 });
  const session = await makeSession(sql, { now: clock.now });
  await app.close();

  const floored = await createTestApp({ minSupportedClientVersion: 2 });
  const stale = await makeSession(floored.sql, { now: floored.clock.now });
  const response = await floored.app.inject({
    method: "DELETE",
    url: "/api/session",
    headers: { ...stale.headers, [CLIENT_VERSION_HEADER]: "1" },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json().error.code, "client_unsupported");
  assert.deepEqual(response.json().error.details, { clientVersion: 1, minSupportedClientVersion: 2 });
  void session;
  await close();
  await floored.close();
});

test("a write without X-Client-Version is refused as invalid_request", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now });

  const response = await app.inject({
    method: "DELETE",
    url: "/api/session",
    headers: { authorization: session.headers.authorization! },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");
  await close();
});

test("a read from a client below the floor is still served", async () => {
  const floored = await createTestApp({ minSupportedClientVersion: 2 });
  const stale = await makeSession(floored.sql, { now: floored.clock.now });

  const response = await floored.app.inject({
    method: "GET",
    url: "/api/session",
    headers: { ...stale.headers, [CLIENT_VERSION_HEADER]: "1" },
  });

  assert.equal(response.statusCode, 200);
  await floored.close();
});

test("a write from a client at the floor is allowed", async () => {
  const { app, sql, clock, close } = await createTestApp({ minSupportedClientVersion: 1 });
  const session = await makeSession(sql, { now: clock.now });

  const response = await app.inject({ method: "DELETE", url: "/api/session", headers: session.headers });

  assert.equal(response.statusCode, 204);
  await close();
});

test("a client below the floor is told to update before it is told to sign in", async () => {
  const floored = await createTestApp({ minSupportedClientVersion: 2 });

  const response = await floored.app.inject({
    method: "DELETE",
    url: "/api/session",
    headers: { [CLIENT_VERSION_HEADER]: "1" },
  });

  assert.equal(response.statusCode, 403);
  await floored.close();
});
