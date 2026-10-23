import test from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

test("both checks answer while the database is up", async () => {
  const { app, close } = await createTestApp();

  assert.deepEqual((await app.inject({ method: "GET", url: "/api/live" })).json(), { ok: true });
  assert.deepEqual((await app.inject({ method: "GET", url: "/api/health" })).json(), { ok: true });
  await close();
});

test("with the database gone, liveness still answers and health is unavailable", async () => {
  const { app, sql } = await createTestApp();
  await sql.close();

  const live = await app.inject({ method: "GET", url: "/api/live" });
  const health = await app.inject({ method: "GET", url: "/api/health" });

  assert.equal(live.statusCode, 200);
  assert.equal(health.statusCode, 503);
  assert.equal(health.json().error.code, "unavailable");
  await app.close();
});
