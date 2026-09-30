import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeSession } from "./SessionFactory.testHelper.js";
import { setAccountPlan } from "./setAccountPlan.js";

test("logging out deletes the session so the token stops working", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { now: clock.now });

  const logout = await app.inject({ method: "DELETE", url: "/api/session", headers: session.headers });
  assert.equal(logout.statusCode, 204);

  const after = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });
  assert.equal(after.statusCode, 401);
  await close();
});

test("the session says which plan the account is on", async () => {
  const { app, sql, clock, close } = await createTestApp();
  const session = await makeSession(sql, { email: "plus@example.com", now: clock.now });

  const free = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });
  assert.equal(free.json().plan, "free");

  await setAccountPlan(sql, "plus@example.com", "plus");
  const plus = await app.inject({ method: "GET", url: "/api/session", headers: session.headers });
  assert.equal(plus.json().plan, "plus");
  await close();
});
