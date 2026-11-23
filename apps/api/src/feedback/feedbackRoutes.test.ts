import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, MAX_ERROR_TRAIL } from "@overview/domain";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";

const FAKE_KEY = ["sk", "ant", "x", "abcDEF123456ghiJKL789"].join("-");

const AT = "2026-11-23T10:00:00.000Z";

interface StoredFeedback {
  account_id: string;
  surface: string;
  client_version: number;
  overview_id: string | null;
  kind: string | null;
  text: string;
  trail: string[];
  triaged_at: Date | null;
}

const setUp = async (t: { after: (fn: () => Promise<void>) => void }): Promise<{ testApp: TestApp; account: TestAccount }> => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  return { testApp, account: await makeAccount(testApp) };
};

const send = (account: TestAccount, body: Record<string, unknown>) => account.inject({ method: "POST", url: "/api/feedback", body });

const stored = (testApp: TestApp) =>
  testApp.sql.query<StoredFeedback>(
    "select account_id, surface, client_version, overview_id, kind, text, trail, triaged_at from feedback order by created_at",
  );

test("feedback from Settings is stored with its account, surface and version, untriaged", async (t) => {
  const { testApp, account } = await setUp(t);

  const response = await send(account, { text: "Could the library sort by length?", surface: "web", kind: "idea" });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(await stored(testApp), [
    {
      account_id: account.accountId,
      surface: "web",
      client_version: CLIENT_VERSION,
      overview_id: null,
      kind: "idea",
      text: "Could the library sort by length?",
      trail: [],
      triaged_at: null,
    },
  ]);
});

test("the overview's id travels with feedback sent from an overview, and no kind is kept as none", async (t) => {
  const { testApp, account } = await setUp(t);
  const overviewId = randomUUID();

  assert.equal((await send(account, { text: "This missed the point", surface: "extension", overviewId })).statusCode, 204);

  const [row] = await stored(testApp);
  assert.equal(row!.overview_id, overviewId);
  assert.equal(row!.kind, null);
  assert.equal(row!.surface, "extension");
});

test("the text is redacted before it is stored", async (t) => {
  const { testApp, account } = await setUp(t);

  await send(account, { text: `Reply to reader@example.com, my key ${FAKE_KEY} failed`, surface: "web" });

  const [row] = await stored(testApp);
  assert.equal(row!.text, "Reply to <email>, my key <key> failed");
});

test("recent actions are kept only with something that's wrong, and only names from the catalogue", async (t) => {
  const { testApp, account } = await setUp(t);
  const trail = [
    { name: "mcp.consentScreen.shown", at: AT },
    { name: "notAnEvent", at: AT },
  ];

  await send(account, { text: "The player stopped", surface: "web", kind: "wrong", trail });
  await send(account, { text: "A dark theme please", surface: "web", kind: "idea", trail });

  const rows = await stored(testApp);
  assert.deepEqual(
    rows.map((row) => row.trail),
    [["mcp.consentScreen.shown"], []],
  );
});

test("signed out, feedback is refused and nothing is stored", async (t) => {
  const { testApp } = await setUp(t);

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/feedback",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { text: "Hello", surface: "web" },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(await stored(testApp), []);
});

test("empty, oversized or unknown-field feedback is refused", async (t) => {
  const { testApp, account } = await setUp(t);

  for (const body of [
    { text: "   ", surface: "web" },
    { text: "x".repeat(4001), surface: "web" },
    { text: "Hello", surface: "phone" },
    { text: "Hello", surface: "web", email: "reader@example.com" },
    {
      text: "Hello",
      surface: "web",
      trail: Array.from({ length: MAX_ERROR_TRAIL + 1 }, () => ({ name: "mcp.consentScreen.shown", at: AT })),
    },
  ]) {
    assert.equal((await send(account, body)).statusCode, 400, JSON.stringify(body).slice(0, 80));
  }
  assert.deepEqual(await stored(testApp), []);
});

test("an account sending more than twenty an hour is told to wait", async (t) => {
  const { account } = await setUp(t);

  for (let sent = 0; sent < 20; sent += 1) {
    assert.equal((await send(account, { text: `Note ${sent}`, surface: "web" })).statusCode, 204);
  }
  const refused = await send(account, { text: "One more", surface: "web" });

  assert.equal(refused.statusCode, 429);
  assert.ok(refused.headers["retry-after"]);
});

test("deleting the account deletes its feedback", async (t) => {
  const { testApp, account } = await setUp(t);
  await send(account, { text: "An idea", surface: "web" });

  await testApp.sql.query("delete from accounts where id = $1", [account.accountId]);

  assert.deepEqual(await stored(testApp), []);
});
