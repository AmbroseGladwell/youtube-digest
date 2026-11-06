import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { finishAccountDeletion } from "./deleteAccount.js";
import { AccountDeletionsRepository } from "./AccountDeletionsRepository.js";
import { makeSession, type TestSession } from "./SessionFactory.testHelper.js";

const MINUTE_MS = 60 * 1000;
const EMAIL = "leaver@example.com";
const OTHER = "stayer@example.com";
const VIDEO = "dQw4w9WgXcQ";
const ANONYMOUS_ID = "7b1f0a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b";
const SHARE_TOKEN = "share-token-one0";
const shareTokenFor = (email: string) => (email === EMAIL ? SHARE_TOKEN : "share-token-two0");

const hex64 = (seed: string) => createHash("sha256").update(seed).digest("hex");

const deleteAccount = (testApp: TestApp, session: TestSession) =>
  testApp.app.inject({ method: "DELETE", url: "/api/session/account", headers: session.headers });

const askToVerify = (testApp: TestApp, session: TestSession, body?: object) =>
  testApp.app.inject({ method: "POST", url: "/api/session/verification", headers: session.headers, ...(body === undefined ? {} : { payload: body }) });

const confirmVerification = (testApp: TestApp, session: TestSession, code: string) =>
  testApp.app.inject({ method: "POST", url: "/api/session/verification/confirm", headers: session.headers, payload: { code } });

const staleSession = async (testApp: TestApp, email: string): Promise<TestSession> => {
  const session = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  testApp.clock.advance(16 * MINUTE_MS);
  return session;
};

// Every kind of row an account can own, written straight into the tables so the sweep
// below has something to find in each of them.
async function seedEverything(testApp: TestApp, session: TestSession, email: string, narrationKey: string): Promise<void> {
  const { sql, clock } = testApp;
  const now = clock.now.toISOString();
  const { accountId } = session;
  const overviewId = randomUUID();
  await sql.query(
    `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, body)
     values ($1, 'overview', $2, 1, 1, 1, $3, $4::jsonb)`,
    [accountId, overviewId, "2026-11-05T10:00:00.000Z", JSON.stringify({ id: overviewId, video: { id: VIDEO } })],
  );
  await sql.query(
    `insert into magic_links (email, surface, token_hash, expires_at, intent, anonymous_id, consumed_at)
     values ($1, 'web', $2, $3::timestamptz, 'createAccount', $4, $3::timestamptz)`,
    [email, hex64(`link-${email}`), now, ANONYMOUS_ID],
  );
  await sql.query("insert into link_codes (account_id, code_hash, expires_at) values ($1, $2, $3::timestamptz)", [
    accountId,
    hex64(`code-${email}`),
    now,
  ]);
  await sql.query(
    "insert into shared_transcripts (video_id, words_hash, body, stored_at) values ($1, $2, $3::jsonb, $4::timestamptz) on conflict do nothing",
    [VIDEO, "words", JSON.stringify({ videoId: VIDEO, blocks: [] }), now],
  );
  await sql.query("insert into account_transcripts (account_id, video_id, stored_at, words_hash) values ($1, $2, $3::timestamptz, 'words')", [
    accountId,
    VIDEO,
    now,
  ]);
  await sql.query(
    "insert into transcript_contributions (video_id, account_id, words_hash, contributed_at) values ($1, $2, 'words', $3::timestamptz)",
    [VIDEO, accountId, now],
  );
  await sql.query(
    `insert into audio_renders (key, voice, render_version, lines, status, priority, not_before, requested_at, requested_by, line_starts, duration_seconds)
     values ($1, 'af_heart', 1, '["hello"]'::jsonb, 'ready', 1, $2::timestamptz, $2::timestamptz, $3, '[0]'::jsonb, 1)`,
    [narrationKey, now, accountId],
  );
  await testApp.audioStore.put(narrationKey, Buffer.from("audio"));
  await sql.query(
    `insert into shares (token, account_id, overview_id, snapshot, content_hash, shared_at, updated_at)
     values ($1, $2, $3, '{}'::jsonb, 'hash', $4::timestamptz, $4::timestamptz)`,
    [shareTokenFor(email), accountId, overviewId, now],
  );
  await sql.query("insert into overview_usage (month, account_id, key_source, overviews) values ('2026-11-01', $1, 'own', 1)", [accountId]);
  await sql.query("insert into overview_reservations (account_id, overview_id, source, reserved_at) values ($1, $2, 'own', $3::timestamptz)", [
    accountId,
    overviewId,
    now,
  ]);
  await sql.query("insert into narration_render_usage (day, account_id, renders) values ('2026-11-05', $1, 1)", [accountId]);
  await sql.query("insert into service_transcript_usage (day, caller, fetches) values ('2026-11-05', $1, 1)", [`account:${accountId}`]);
  await sql.query(
    "insert into oauth_clients (id, redirect_uris, token_endpoint_auth_method, created_at) values ('claude', '{https://claude.ai/cb}', 'none', $1::timestamptz) on conflict do nothing",
    [now],
  );
  const [connection] = await sql.query<{ id: string }>(
    "insert into connections (account_id, client_id, scope, created_at, last_used_at) values ($1, 'claude', 'overviews:read', $2::timestamptz, $2::timestamptz) returning id",
    [accountId, now],
  );
  await sql.query("insert into connection_tokens (token_hash, connection_id, kind, created_at, expires_at) values ($1, $2, 'access', $3::timestamptz, $3::timestamptz)", [
    hex64(`token-${email}`),
    connection!.id,
    now,
  ]);
  await sql.query(
    `insert into oauth_authorizations (client_id, redirect_uri, code_challenge, scope, created_at, expires_at, account_id, decided_at, approved)
     values ('claude', 'https://claude.ai/cb', $1, 'overviews:read', $2::timestamptz, $2::timestamptz, $3, $2::timestamptz, true)`,
    ["a".repeat(43), now, accountId],
  );
  await sql.query("insert into email_changes (account_id, old_email, new_email, expires_at) values ($1, $2, 'next@example.org', $3::timestamptz)", [
    accountId,
    email,
    now,
  ]);
  const [row] = await sql.query<{ id: string }>("select id from sessions where account_id = $1 limit 1", [accountId]);
  await sql.query("insert into session_verifications (session_id, code_hash, expires_at) values ($1, $2, $3::timestamptz)", [
    row!.id,
    hex64(`verify-${email}`),
    now,
  ]);
}

// Every column that names an account, read from the schema rather than from a list that
// could go stale; the two rows that are meant to outlive the account are the exceptions.
async function rowsNamingAccount(testApp: TestApp, accountId: string): Promise<Record<string, number>> {
  const columns = await testApp.sql.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and column_name in ('account_id', 'requested_by') order by table_name`,
  );
  const counts: Record<string, number> = {};
  for (const { table_name, column_name } of columns) {
    const [row] = await testApp.sql.query<{ count: number | string }>(
      `select count(*) as count from ${table_name} where ${column_name} = $1`,
      [accountId],
    );
    counts[table_name] = Number(row!.count);
  }
  return counts;
}

test("deleting needs the session to have proved its inbox, with a code that says what it is for", async () => {
  const testApp = await createTestApp();
  const session = await staleSession(testApp, EMAIL);

  const refused = await deleteAccount(testApp, session);
  assert.equal(refused.statusCode, 403);
  assert.equal(refused.json().error.code, "verification_required");

  const asked = await askToVerify(testApp, session, { purpose: "deleteAccount" });
  assert.equal(asked.json().required, true);
  const mail = testApp.mailer.accountMails.at(-1)!;
  assert.equal(mail.kind, "verificationCode");
  assert.ok(mail.kind === "verificationCode" && mail.purpose === "deleteAccount");

  assert.equal((await confirmVerification(testApp, session, testApp.mailer.lastAccountCode())).statusCode, 204);
  assert.equal((await deleteAccount(testApp, session)).statusCode, 204);
  assert.equal((await testApp.app.inject({ method: "GET", url: "/api/session", headers: session.headers })).statusCode, 401);
  await testApp.close();
});

test("asking for a code with no purpose is the email change's, as before", async () => {
  const testApp = await createTestApp();
  const session = await staleSession(testApp, EMAIL);

  await askToVerify(testApp, session);
  const mail = testApp.mailer.accountMails.at(-1)!;
  assert.ok(mail.kind === "verificationCode" && mail.purpose === "emailChange");
  assert.equal((await askToVerify(testApp, session, { purpose: "somethingElse" })).statusCode, 400);
  await testApp.close();
});

test("a fresh session deletes everything under the account, leaves the shared cache's record, and ends every other session", async () => {
  const testApp = await createTestApp();
  const { lines, logger } = recordingLogger();
  const loggedApp = await createTestApp({}, { logger });
  await testApp.close();
  const session = await makeSession(loggedApp.sql, { email: EMAIL, now: loggedApp.clock.now });
  const phone = await makeSession(loggedApp.sql, { email: EMAIL, now: loggedApp.clock.now });
  const bystander = await makeSession(loggedApp.sql, { email: OTHER, now: loggedApp.clock.now });
  const key = hex64("narration");
  await seedEverything(loggedApp, session, EMAIL, key);
  await seedEverything(loggedApp, bystander, OTHER, hex64("theirs"));
  const { account_deletions: none, ...before } = await rowsNamingAccount(loggedApp, session.accountId);
  assert.equal(none, 0);
  assert.ok(Object.values(before).every((count) => count > 0), JSON.stringify(before));

  const deleted = await deleteAccount(loggedApp, session);
  assert.equal(deleted.statusCode, 204, deleted.body);

  const after = await rowsNamingAccount(loggedApp, session.accountId);
  const kept = Object.entries(after).filter(([, count]) => count > 0).map(([table]) => table);
  assert.deepEqual(kept.sort(), ["account_deletions", "transcript_contributions"]);
  assert.equal((await loggedApp.sql.query("select 1 from shared_transcripts where video_id = $1", [VIDEO])).length, 1);
  assert.equal((await loggedApp.sql.query("select 1 from magic_links where email = $1", [EMAIL])).length, 0);
  assert.equal((await loggedApp.sql.query("select 1 from service_transcript_usage where caller = $1", [`account:${session.accountId}`])).length, 0);
  assert.equal((await loggedApp.sql.query("select 1 from session_verifications sv join sessions s on s.id = sv.session_id where s.account_id = $1", [session.accountId])).length, 0);
  assert.equal(await loggedApp.audioStore.get(key), null);
  assert.equal((await loggedApp.app.inject({ method: "GET", url: `/s/${SHARE_TOKEN}` })).statusCode, 404);
  assert.deepEqual(loggedApp.personEraser.erased, [session.accountId, ANONYMOUS_ID]);

  assert.equal((await loggedApp.app.inject({ method: "GET", url: "/api/session", headers: phone.headers })).statusCode, 401);
  assert.equal((await loggedApp.app.inject({ method: "GET", url: "/api/session", headers: bystander.headers })).statusCode, 200);
  const { account_deletions: theirsNone, ...theirs } = await rowsNamingAccount(loggedApp, bystander.accountId);
  assert.equal(theirsNone, 0);
  assert.ok(Object.values(theirs).every((count) => count > 0), JSON.stringify(theirs));
  assert.notEqual(await loggedApp.audioStore.get(hex64("theirs")), null);

  const [record] = await new AccountDeletionsRepository(loggedApp.sql).listUnfinished();
  assert.equal(record, undefined);
  const [row] = await loggedApp.sql.query<{ narration_status: string; posthog_account_status: string; posthog_anonymous_status: string; anonymous_id: string }>(
    "select narration_status, posthog_account_status, posthog_anonymous_status, anonymous_id from account_deletions where account_id = $1",
    [session.accountId],
  );
  assert.deepEqual(row, { narration_status: "done", posthog_account_status: "queued", posthog_anonymous_status: "queued", anonymous_id: ANONYMOUS_ID });

  const line = lines.find((entry) => entry.msg === "account deleted")!;
  assert.ok(line, "the deletion is logged");
  assert.equal(line.narration, "done");
  assert.ok(!JSON.stringify(lines).includes(EMAIL));
  await loggedApp.close();
});

test("a step that fails after the commit leaves the audit row saying so, and a retry finishes it", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const session = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });
  const key = hex64("narration");
  await seedEverything(testApp, session, EMAIL, key);
  testApp.audioStore.failingDeletes = true;
  testApp.personEraser.failing = true;

  assert.equal((await deleteAccount(testApp, session)).statusCode, 204);
  assert.equal((await testApp.sql.query("select 1 from accounts where id = $1", [session.accountId])).length, 0);
  const repository = new AccountDeletionsRepository(testApp.sql);
  const [unfinished] = await repository.listUnfinished();
  assert.ok(unfinished);
  assert.equal(unfinished.narration, "failed");
  assert.equal(unfinished.postHogAccount, "failed");
  assert.equal(unfinished.postHogAnonymous, "failed");
  assert.equal(unfinished.finishedAt, null);
  assert.ok(unfinished.lastError?.includes("PostHog is down"));
  assert.equal(lines.filter((entry) => entry.msg === "account deletion step failed").length, 3);

  testApp.audioStore.failingDeletes = false;
  testApp.personEraser.failing = false;
  const finished = await finishAccountDeletion(testApp.sql, unfinished, {
    narrationStore: testApp.audioStore,
    personEraser: testApp.personEraser,
    log: logger,
    now: () => testApp.clock.now,
  });
  assert.equal(finished.narration, "done");
  assert.equal(finished.postHogAccount, "queued");
  assert.notEqual(finished.finishedAt, null);
  assert.deepEqual(await repository.listUnfinished(), []);
  assert.equal(await testApp.audioStore.get(key), null);
  await testApp.close();
});

test("an account with no narration and no linked anonymous id records those steps as skipped", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });

  assert.equal((await deleteAccount(testApp, session)).statusCode, 204);
  const [row] = await testApp.sql.query<{ narration_status: string; posthog_anonymous_status: string; finished_at: string | null }>(
    "select narration_status, posthog_anonymous_status, finished_at from account_deletions where account_id = $1",
    [session.accountId],
  );
  assert.equal(row?.narration_status, "skipped");
  assert.equal(row?.posthog_anonymous_status, "skipped");
  assert.notEqual(row?.finished_at, null);
  assert.deepEqual(testApp.personEraser.erased, [session.accountId]);
  await testApp.close();
});

test("a revert link for an account that was deleted since is refused, and the address is free to start again", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });
  await testApp.app.inject({ method: "POST", url: "/api/session/email-change", headers: session.headers, payload: { email: "next@example.org" } });
  await testApp.app.inject({
    method: "POST",
    url: "/api/session/email-change/confirm",
    headers: session.headers,
    payload: { code: testApp.mailer.lastAccountCode() },
  });
  const revertToken = testApp.mailer.lastRevertToken();

  assert.equal((await deleteAccount(testApp, session)).statusCode, 204);
  const reverted = await testApp.app.inject({
    method: "POST",
    url: "/api/auth/email-change/revert",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { token: revertToken },
  });
  assert.equal(reverted.statusCode, 410);

  const again = await makeSession(testApp.sql, { email: EMAIL, now: testApp.clock.now });
  assert.notEqual(again.accountId, session.accountId);
  await testApp.close();
});
