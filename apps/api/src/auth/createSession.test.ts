import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../http/ApiError.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { createSession } from "./createSession.js";
import { hashSessionToken } from "./hashSessionToken.js";

const options = { now: new Date("2026-09-26T09:00:00.000Z"), sessionTtlDays: 30 };

test("a minted token is not stored, only its hash", async () => {
  const { sql, close } = await createTestApp();
  const { token } = await createSession(sql, "reader@example.com", options);

  const rows = await sql.query<{ token_hash: string }>("select token_hash from sessions");
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0]!.token_hash, token);
  assert.equal(rows[0]!.token_hash, hashSessionToken(token));
  await close();
});

test("two mints for one email share one account", async () => {
  const { sql, close } = await createTestApp();
  const first = await createSession(sql, "reader@example.com", options);
  const second = await createSession(sql, "reader@example.com", options);

  assert.equal(first.accountId, second.accountId);
  assert.notEqual(first.token, second.token);
  await close();
});

test("an email is normalised before lookup, so casing and whitespace do not make a second account", async () => {
  const { sql, close } = await createTestApp();
  const first = await createSession(sql, "Reader@Example.com", options);
  const second = await createSession(sql, "  reader@example.com ", options);

  assert.equal(first.accountId, second.accountId);
  await close();
});

test("an invalid email is refused before anything is written", async () => {
  const { sql, close } = await createTestApp();
  await assert.rejects(() => createSession(sql, "not an email", options), ApiError);

  assert.deepEqual(await sql.query("select id from accounts"), []);
  await close();
});

test("the session expires the configured number of days after it was made", async () => {
  const { sql, close } = await createTestApp();
  const { expiresAt } = await createSession(sql, "reader@example.com", options);

  assert.equal(expiresAt, "2026-10-26T09:00:00.000Z");
  await close();
});
