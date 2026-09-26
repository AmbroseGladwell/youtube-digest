import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeSession } from "./SessionFactory.testHelper.js";

test("logging out deletes the session so the token stops working", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now });

  const logout = await app.inject({ method: "DELETE", url: "/api/session", headers: session.headers });
  assert.equal(logout.statusCode, 204);

  const after = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });
  assert.equal(after.statusCode, 401);
  await close();
});
