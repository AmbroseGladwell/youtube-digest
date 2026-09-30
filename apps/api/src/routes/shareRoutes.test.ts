import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER, SHARE_TOKEN_PATTERN, type Share } from "@overview/domain";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp, TEST_APP_URL } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { MAX_LIVE_SHARES_PER_ACCOUNT } from "./shareRoutes.js";

const share = (account: TestAccount, body: unknown) =>
  account.inject({ method: "POST", url: "/api/shares", body });

const live = async (account: TestAccount): Promise<Share[]> => {
  const response = await account.inject({ method: "GET", url: "/api/shares" });
  return response.json().shares;
};

test("a link is made from an overview, and it is the app's own address", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);

  const response = await share(account, { overview: makeOverview({ video: { ...makeOverview().video, title: "Nuclear Baseload" } }) });

  assert.equal(response.statusCode, 201);
  const made: Share = response.json();
  assert.match(made.token, SHARE_TOKEN_PATTERN);
  assert.equal(made.url, `${TEST_APP_URL}/s/${made.token}`);
  assert.equal(made.title, "Nuclear Baseload");
  assert.equal(made.views, 0);
  await app.close();
});

test("sharing the same overview again replaces the copy behind the same link", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  const overview = makeOverview();

  const first: Share = (await share(account, { overview })).json();
  const response = await share(account, { overview: { ...overview, inOneLine: "A different premise entirely." } });

  assert.equal(response.statusCode, 200);
  const again: Share = response.json();
  assert.equal(again.token, first.token);
  assert.notEqual(again.contentHash, first.contentHash);
  assert.equal(again.sharedAt, first.sharedAt);
  assert.equal((await live(account)).length, 1);
  await app.close();
});

test("stopping a link takes it off the list, and sharing again makes a new one", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  const overview = makeOverview();
  const first: Share = (await share(account, { overview })).json();

  const stopped = await account.inject({ method: "DELETE", url: `/api/shares/${first.token}` });

  assert.equal(stopped.statusCode, 204);
  assert.deepEqual(await live(account), []);

  const second: Share = (await share(account, { overview })).json();
  assert.notEqual(second.token, first.token);
  await app.close();
});

test("a second DELETE of the same link is not found, because there is no live link to stop", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  const made: Share = (await share(account, { overview: makeOverview() })).json();
  await account.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  const again = await account.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  assert.equal(again.statusCode, 404);
  assert.equal(again.json().error.code, "not_found");
  await app.close();
});

test("one account cannot stop another account's link, or see it listed", async () => {
  const app = await createTestApp();
  const owner = await makeAccount(app);
  const stranger = await makeAccount(app);
  const made: Share = (await share(owner, { overview: makeOverview() })).json();

  const attempt = await stranger.inject({ method: "DELETE", url: `/api/shares/${made.token}` });

  assert.equal(attempt.statusCode, 404);
  assert.deepEqual(await live(stranger), []);
  assert.equal((await live(owner)).length, 1);
  await app.close();
});

test("a transcript and a narration key travel with the copy", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  const overview = makeOverview();

  const response = await share(account, {
    overview,
    transcript: makeStoredTranscript(),
    narration: {
      key: "a".repeat(64),
      voice: "bf_emma",
      durationSeconds: 364,
      lineStartsSeconds: [0, 12.5],
    },
  });

  assert.equal(response.statusCode, 201);
  const page = await app.app.inject({ method: "GET", url: `/s/${response.json().token}` });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /Here is the one claim this video makes\./);
  await app.close();
});

test("an account is held to a limit of live links at once", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  for (let made = 0; made < MAX_LIVE_SHARES_PER_ACCOUNT; made += 1) {
    assert.equal((await share(account, { overview: makeOverview() })).statusCode, 201);
  }

  const response = await share(account, { overview: makeOverview() });

  assert.equal(response.statusCode, 429);
  assert.equal(response.json().error.code, "too_many_requests");
  assert.equal(response.json().error.details.limit, MAX_LIVE_SHARES_PER_ACCOUNT);
  await app.close();
});

test("replacing a copy is allowed when the account is already at its limit", async () => {
  const app = await createTestApp();
  const account = await makeAccount(app);
  const overview = makeOverview();
  await share(account, { overview });
  for (let made = 1; made < MAX_LIVE_SHARES_PER_ACCOUNT; made += 1) {
    await share(account, { overview: makeOverview() });
  }

  const response = await share(account, { overview: { ...overview, inOneLine: "Edited after filling up." } });

  assert.equal(response.statusCode, 200);
  await app.close();
});

test("sharing needs an account", async () => {
  const app = await createTestApp();

  const response = await app.app.inject({
    method: "POST",
    url: "/api/shares",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { overview: makeOverview() },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "unauthenticated");
  await app.close();
});
