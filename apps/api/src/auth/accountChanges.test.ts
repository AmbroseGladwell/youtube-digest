import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, TEST_APP_URL, TEST_SUPPORT_EMAIL, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeSession, type TestSession } from "./SessionFactory.testHelper.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const OLD = "reader@example.com";
const NEW = "reader.ward@example.org";

const whoAmI = (testApp: TestApp, session: TestSession) =>
  testApp.app.inject({ method: "GET", url: "/api/session", headers: session.headers });

const saveName = (testApp: TestApp, session: TestSession, firstName: string | null) =>
  testApp.app.inject({ method: "PUT", url: "/api/session/account", headers: session.headers, payload: { firstName } });

const askToVerify = (testApp: TestApp, session: TestSession) =>
  testApp.app.inject({ method: "POST", url: "/api/session/verification", headers: session.headers });

const confirmVerification = (testApp: TestApp, session: TestSession, code: string) =>
  testApp.app.inject({ method: "POST", url: "/api/session/verification/confirm", headers: session.headers, payload: { code } });

const askToChange = (testApp: TestApp, session: TestSession, email = NEW) =>
  testApp.app.inject({ method: "POST", url: "/api/session/email-change", headers: session.headers, payload: { email } });

const confirmChange = (testApp: TestApp, session: TestSession, code: string) =>
  testApp.app.inject({ method: "POST", url: "/api/session/email-change/confirm", headers: session.headers, payload: { code } });

const revert = (testApp: TestApp, token: string) =>
  testApp.app.inject({
    method: "POST",
    url: "/api/auth/email-change/revert",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { token },
  });

// A session made now is fresh, so the step-up is skipped; one made a while ago is not.
const staleSession = async (testApp: TestApp, email = OLD): Promise<TestSession> => {
  const session = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  testApp.clock.advance(16 * MINUTE_MS);
  return session;
};

const changeEmail = async (testApp: TestApp, session: TestSession): Promise<string> => {
  assert.equal((await askToChange(testApp, session)).statusCode, 202);
  const confirmed = await confirmChange(testApp, session, testApp.mailer.lastAccountCode());
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  return testApp.mailer.lastRevertToken();
};

test("a reader sets, changes and clears their name, and the session says so", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  const set = await saveName(testApp, session, "Ada");
  assert.equal(set.statusCode, 200);
  assert.equal(set.json().firstName, "Ada");
  assert.equal((await whoAmI(testApp, session)).json().firstName, "Ada");

  const cleared = await saveName(testApp, session, null);
  assert.equal(cleared.json().firstName, null);
  assert.equal((await whoAmI(testApp, session)).json().firstName, null);

  assert.equal((await saveName(testApp, session, "   ")).statusCode, 400);
  assert.equal((await saveName(testApp, session, "x".repeat(81))).statusCode, 400);
  await testApp.close();
});

test("a fresh session needs no code before changing its email; a stale one gets a code at its own address", async () => {
  const testApp = await createTestApp();
  const fresh = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  assert.deepEqual((await askToVerify(testApp, fresh)).json(), { required: false });
  assert.equal(testApp.mailer.accountMails.length, 0);
  assert.equal((await askToChange(testApp, fresh)).statusCode, 202);

  const stale = await staleSession(testApp, "other@example.com");
  const refused = await askToChange(testApp, stale);
  assert.equal(refused.statusCode, 403);
  assert.equal(refused.json().error.code, "verification_required");

  const asked = await askToVerify(testApp, stale);
  assert.equal(asked.statusCode, 200);
  assert.equal(asked.json().required, true);
  assert.equal(asked.json().email, "other@example.com");
  const mail = testApp.mailer.accountMails.at(-1)!;
  assert.equal(mail.kind, "verificationCode");
  assert.equal(mail.to, "other@example.com");
  assert.ok("supportEmail" in mail && mail.supportEmail === TEST_SUPPORT_EMAIL);

  const wrong = await confirmVerification(testApp, stale, "AAAA-AAAA");
  assert.equal(wrong.statusCode, 410);
  assert.equal((await askToChange(testApp, stale)).statusCode, 403);

  assert.equal((await confirmVerification(testApp, stale, testApp.mailer.lastAccountCode())).statusCode, 204);
  assert.equal((await askToChange(testApp, stale)).statusCode, 202);
  await testApp.close();
});

test("a second step-up code inside the minute is held back, and a verified session lapses after fifteen minutes", async () => {
  const testApp = await createTestApp();
  const session = await staleSession(testApp);

  const first = await askToVerify(testApp, session);
  const again = await askToVerify(testApp, session);
  assert.equal(testApp.mailer.accountMails.length, 1);
  assert.equal(again.json().expiresAt, first.json().expiresAt);

  assert.equal((await confirmVerification(testApp, session, testApp.mailer.lastAccountCode())).statusCode, 204);
  testApp.clock.advance(16 * MINUTE_MS);
  assert.equal((await askToChange(testApp, session)).statusCode, 403);
  await testApp.close();
});

test("a step-up code only works for the session it was made for, and only once", async () => {
  const testApp = await createTestApp();
  const theirs = await staleSession(testApp, "theirs@example.com");
  const mine = await staleSession(testApp, OLD);

  await askToVerify(testApp, theirs);
  const theirCode = testApp.mailer.lastAccountCode();
  assert.equal((await confirmVerification(testApp, mine, theirCode)).statusCode, 410);
  assert.equal((await confirmVerification(testApp, theirs, theirCode)).statusCode, 204);
  assert.equal((await confirmVerification(testApp, theirs, theirCode)).statusCode, 410);
  await testApp.close();
});

test("asking for the account's own address is refused in place, with no mail", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  const same = await askToChange(testApp, session, " Reader@Example.com ");
  assert.equal(same.statusCode, 400);
  assert.equal(testApp.mailer.accountMails.length, 0);
  assert.equal((await askToChange(testApp, session, "not an address")).statusCode, 400);
  await testApp.close();
});

test("an address that already has an account is told so by mail, and the answer does not differ", async () => {
  const testApp = await createTestApp();
  await makeSession(testApp.sql, { email: NEW, now: testApp.clock.now });
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  const asked = await askToChange(testApp, session);
  assert.equal(asked.statusCode, 202);
  assert.equal(asked.json().accepted, true);
  const mail = testApp.mailer.accountMails.at(-1)!;
  assert.deepEqual(mail, { kind: "emailTaken", to: NEW });
  assert.throws(() => testApp.mailer.lastAccountCode());
  await testApp.close();
});

test("the code from the new address moves the account, keeps every session, and tells the old address with a way back", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const extension = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  const asked = await askToChange(testApp, session, " Reader.Ward@Example.org ");
  assert.equal(asked.statusCode, 202);
  const codeMail = testApp.mailer.accountMails.at(-1)!;
  assert.equal(codeMail.kind, "emailChangeCode");
  assert.equal(codeMail.to, NEW);

  assert.equal((await confirmChange(testApp, session, "AAAA-AAAA")).statusCode, 410);

  const code = testApp.mailer.lastAccountCode();
  const confirmed = await confirmChange(testApp, session, code);
  assert.equal(confirmed.statusCode, 200);
  assert.equal(confirmed.json().email, NEW);
  assert.equal(confirmed.json().accountId, session.accountId);
  assert.equal((await whoAmI(testApp, session)).json().email, NEW);
  assert.equal((await whoAmI(testApp, extension)).json().email, NEW);

  const notice = testApp.mailer.accountMails.at(-1)!;
  assert.equal(notice.kind, "emailChanged");
  assert.equal(notice.to, OLD);
  assert.ok(notice.kind === "emailChanged" && notice.newEmail === NEW);
  assert.ok(notice.kind === "emailChanged" && notice.revertLink.startsWith(`${TEST_APP_URL}/account/revert#token=`));
  assert.ok(notice.kind === "emailChanged" && notice.changedAt === testApp.clock.now.toISOString());

  assert.equal((await confirmChange(testApp, session, code)).statusCode, 410);
  await testApp.close();
});

test("a code expires after fifteen minutes, and a code from another account's change is refused", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const other = await makeSession(testApp.sql, { email: "other@example.com", now: testApp.clock.now });

  await askToChange(testApp, session);
  const code = testApp.mailer.lastAccountCode();
  assert.equal((await confirmChange(testApp, other, code)).statusCode, 410);
  testApp.clock.advance(16 * MINUTE_MS);
  assert.equal((await confirmChange(testApp, session, code)).statusCode, 410);
  await testApp.close();
});

test("an address taken between the ask and the confirm leaves the account where it was", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  await askToChange(testApp, session);
  await makeSession(testApp.sql, { email: NEW, now: testApp.clock.now });

  const confirmed = await confirmChange(testApp, session, testApp.mailer.lastAccountCode());
  assert.equal(confirmed.statusCode, 409);
  assert.equal(confirmed.json().error.code, "already_exists");
  assert.equal((await whoAmI(testApp, session)).json().email, OLD);
  await testApp.close();
});

test("a second code for the same address inside the minute is held back", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  const first = await askToChange(testApp, session);
  const again = await askToChange(testApp, session);
  assert.equal(testApp.mailer.accountMails.length, 1);
  assert.equal(again.json().expiresAt, first.json().expiresAt);
  await testApp.close();
});

test("the old address moves the account back, which ends every session, and the link works once", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const extension = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const token = await changeEmail(testApp, session);

  const reverted = await revert(testApp, token);
  assert.equal(reverted.statusCode, 200);
  assert.deepEqual(reverted.json(), { email: OLD });
  assert.equal((await whoAmI(testApp, session)).statusCode, 401);
  assert.equal((await whoAmI(testApp, extension)).statusCode, 401);
  const [account] = await testApp.sql.query<{ email: string }>("select email from accounts where id = $1", [session.accountId]);
  assert.equal(account!.email, OLD);

  const again = await revert(testApp, token);
  assert.equal(again.statusCode, 410);
  assert.equal(again.json().error.details.reason, "spent");
  await testApp.close();
});

test("a revert link lapses after seven days, says so, and an unknown token reads as spent", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const token = await changeEmail(testApp, session);

  testApp.clock.advance(8 * DAY_MS);
  const late = await revert(testApp, token);
  assert.equal(late.statusCode, 410);
  assert.equal(late.json().error.details.reason, "expired");
  assert.equal((await whoAmI(testApp, session)).json().email, NEW);

  const unknown = await revert(testApp, "not-a-token");
  assert.equal(unknown.json().error.details.reason, "spent");
  await testApp.close();
});

test("a revert is refused when the account moved again since, or the old address became someone else's", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });
  const firstToken = await changeEmail(testApp, session);

  assert.equal((await askToChange(testApp, session, "third@example.com")).statusCode, 202);
  assert.equal((await confirmChange(testApp, session, testApp.mailer.lastAccountCode())).statusCode, 200);
  const superseded = await revert(testApp, firstToken);
  assert.equal(superseded.statusCode, 410);
  assert.equal(superseded.json().error.details.reason, "spent");

  const secondToken = testApp.mailer.lastRevertToken();
  await makeSession(testApp.sql, { email: NEW, now: testApp.clock.now });
  const taken = await revert(testApp, secondToken);
  assert.equal(taken.statusCode, 410);
  assert.equal(taken.json().error.details.reason, "taken");
  assert.equal((await whoAmI(testApp, session)).json().email, "third@example.com");
  await testApp.close();
});

test("a sixth ask in an hour is refused with how long to wait", async () => {
  const testApp = await createTestApp();
  const session = await makeSession(testApp.sql, { email: OLD, now: testApp.clock.now });

  for (let i = 0; i < 5; i++) {
    assert.equal((await askToChange(testApp, session, `new${i}@example.com`)).statusCode, 202);
  }
  const sixth = await askToChange(testApp, session, "new5@example.com");
  assert.equal(sixth.statusCode, 429);
  assert.ok(sixth.json().error.details.retryAfterSeconds > 0);
  await testApp.close();
});

test("no line about an account's changes carries an address, a code or a token", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const session = await staleSession(testApp);

  await askToVerify(testApp, session);
  await confirmVerification(testApp, session, testApp.mailer.lastAccountCode());
  const token = await changeEmail(testApp, session);
  await revert(testApp, token);

  const said = lines.map((line) => line.msg);
  for (const msg of [
    "verification asked",
    "verification confirmed",
    "email change asked",
    "email change confirmed",
    "email change reverted",
  ]) {
    assert.ok(said.includes(msg), msg);
  }
  const logged = JSON.stringify(lines);
  assert.doesNotMatch(logged, /reader@example\.com|reader\.ward@example\.org/);
  assert.doesNotMatch(logged, new RegExp(token));
  await testApp.close();
});
