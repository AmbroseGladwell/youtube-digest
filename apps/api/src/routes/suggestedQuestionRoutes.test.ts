import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
  CURRENT_SCHEMA_VERSIONS,
  suggestedQuestionId,
  type SuggestedQuestionScope,
} from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { connectMcpClient } from "../mcp/McpClient.testHelper.js";
import { writeSuggestedQuestions, type NewSuggestedQuestion } from "../questions/writeSuggestedQuestions.js";
import { saveSmallLibrary, setUpRefresh } from "../questions/SuggestedQuestionRefresher.testHelper.js";
import { RecordsRepository } from "../records/RecordsRepository.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

const LIBRARY: SuggestedQuestionScope = { kind: "library" };
const TEXT = "Does the routine in one survive the warning in the other?";
const AT = "2026-11-23T10:00:00.000Z";
const LATER = "2026-11-23T11:00:00.000Z";

interface Setting {
  testApp: TestApp;
  account: TestAccount;
  write: (questions: NewSuggestedQuestion[]) => ReturnType<typeof writeSuggestedQuestions>;
}

const setUp = async (t: { after: (fn: () => Promise<void>) => void }): Promise<Setting> => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  const account = await makeAccount(testApp);
  const records = new RecordsRepository(testApp.sql, () => testApp.clock.now);
  return { testApp, account, write: (questions) => writeSuggestedQuestions(records, account.accountId, questions, testApp.clock.now) };
};

const withOverview = async (account: TestAccount) => {
  const overview = storedOverview();
  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  assert.equal(response.statusCode, 201);
  return overview.id;
};

const withProject = async (account: TestAccount, members: string[]) => {
  const project = { ...makeProject(), schemaVersion: CURRENT_SCHEMA_VERSIONS.project, updatedAt: UPDATED_AT };
  assert.equal((await account.inject({ method: "POST", url: "/api/projects", body: project })).statusCode, 201);
  for (const overviewId of members) {
    const added = await account.inject({
      method: "PUT",
      url: `/api/projects/${project.id}/members/${overviewId}`,
      body: { addedAt: UPDATED_AT, updatedAt: UPDATED_AT },
    });
    assert.equal(added.statusCode, 200);
  }
  return project.id;
};

const inProject = (projectId: string): SuggestedQuestionScope => ({ kind: "project", projectId: projectId as never });

const change = (account: TestAccount, id: string, body: Record<string, unknown>) =>
  account.inject({ method: "PUT", url: `/api/suggested-questions/${id.split(":").join("/")}`, body: { updatedAt: AT, ...body } });

const isDeleted = async (account: TestAccount, id: string) => (await account.change("suggestedQuestion", id)).deleted;

test("the server writes a batch of questions, each under a fresh id naming its scope and both overviews, and the feed carries them", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second, third] = [await withOverview(account), await withOverview(account), await withOverview(account)];

  const written = await write([
    { scope: LIBRARY, overviewIds: [second, first], text: TEXT },
    { scope: LIBRARY, overviewIds: [first, third], text: "What would the third one say to the first?" },
  ]);

  assert.equal(written.length, 2);
  const [id] = [written[0]!.id];
  const [low, high] = [first, second].sort();
  assert.match(id, new RegExp(`^library:${low}:${high}:[0-9a-f-]{36}$`));
  assert.notEqual(written[0]!.id, written[1]!.id);
  const fed = await account.change("suggestedQuestion", id);
  assert.equal(fed.schemaVersion, CURRENT_SCHEMA_VERSIONS.suggestedQuestion);
  assert.deepEqual(fed.body, {
    id,
    scope: LIBRARY,
    overviewIds: [low, high],
    text: TEXT,
    madeAt: fed.body!.madeAt,
    shownAt: null,
    askedAt: null,
    dismissedAt: null,
    feedback: null,
  });
});

test("a question on a missing or deleted overview, or a project's on one not in it, is skipped and the rest of the batch written", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second, outside, doomed] = [
    await withOverview(account),
    await withOverview(account),
    await withOverview(account),
    await withOverview(account),
  ];
  const projectId = await withProject(account, [first, second]);
  assert.equal((await account.inject({ method: "DELETE", url: `/api/overviews/${doomed}` })).statusCode, 200);

  const written = await write([
    { scope: LIBRARY, overviewIds: [first, randomUUID()], text: TEXT },
    { scope: LIBRARY, overviewIds: [first, doomed], text: TEXT },
    { scope: inProject(projectId), overviewIds: [first, outside], text: TEXT },
    { scope: inProject(randomUUID()), overviewIds: [first, second], text: TEXT },
    { scope: LIBRARY, overviewIds: [first, second], text: "x ".repeat(30) },
    { scope: inProject(projectId), overviewIds: [first, second], text: TEXT },
  ]);

  assert.deepEqual(
    written.map((outcome) => outcome !== null),
    [false, false, false, false, false, true],
  );
  assert.match(written[5]!.id, new RegExp(`^project:${projectId}:`));
});

test("a device's change merges and commutes: shown and dismissed keep the earliest, feedback the latest", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const [written] = await write([{ scope: LIBRARY, overviewIds: [first, second], text: TEXT }]);
  const id = written!.id;

  for (const body of [
    { shownAt: LATER },
    { feedback: { verdict: "obvious", at: LATER } },
    { shownAt: AT, dismissedAt: LATER },
    { feedback: { verdict: "glad", at: AT } },
  ]) {
    const response = await change(account, id, body);
    assert.equal(response.statusCode, 200, response.body);
  }

  const body = (await account.change("suggestedQuestion", id)).body!;
  assert.equal(body.shownAt, AT);
  assert.equal(body.dismissedAt, LATER);
  assert.deepEqual(body.feedback, { verdict: "obvious", at: LATER });
  assert.equal(body.text, TEXT);
});

test("a project's question takes a device's change at its own path", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const projectId = await withProject(account, [first, second]);
  const [written] = await write([{ scope: inProject(projectId), overviewIds: [first, second], text: TEXT }]);

  const response = await change(account, written!.id, { askedAt: AT });

  assert.equal(response.statusCode, 200, response.body);
  assert.equal((await account.change("suggestedQuestion", written!.id)).body!.askedAt, AT);
});

test("a device can't change a question's words, scope, overviews or when it was made, nor make one", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const [written] = await write([{ scope: LIBRARY, overviewIds: [first, second], text: TEXT }]);

  assert.equal((await change(account, written!.id, { text: "Something else?" })).statusCode, 400);
  assert.equal((await change(account, written!.id, { madeAt: AT })).statusCode, 400);
  assert.equal((await change(account, written!.id, {})).statusCode, 400);
  const unknown = suggestedQuestionId(LIBRARY, [first, second], randomUUID());
  const response = await change(account, unknown, { shownAt: AT });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
});

test("a question that was swept is not_found to a device's change", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const [written] = await write([{ scope: LIBRARY, overviewIds: [first, second], text: TEXT }]);
  assert.equal((await account.inject({ method: "DELETE", url: `/api/overviews/${second}` })).statusCode, 200);

  const response = await change(account, written!.id, { dismissedAt: AT });

  assert.equal(response.statusCode, 404);
});

test("deleting an overview tombstones every question naming it, first or second, and leaves the rest", async (t) => {
  const { account, write } = await setUp(t);
  const [doomed, kept, other] = [await withOverview(account), await withOverview(account), await withOverview(account)];
  const projectId = await withProject(account, [doomed, kept, other]);
  const written = await write([
    { scope: LIBRARY, overviewIds: [doomed, kept], text: TEXT },
    { scope: LIBRARY, overviewIds: [other, doomed], text: TEXT },
    { scope: inProject(projectId), overviewIds: [kept, doomed], text: TEXT },
    { scope: LIBRARY, overviewIds: [kept, other], text: TEXT },
  ]);

  assert.equal((await account.inject({ method: "DELETE", url: `/api/overviews/${doomed}` })).statusCode, 200);

  const deleted = await Promise.all(written.map((outcome) => isDeleted(account, outcome!.id)));
  assert.deepEqual(deleted, [true, true, true, false]);
});

test("deleting a project tombstones its questions, and the library's on the same overviews stay", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const [doomed, kept] = [await withProject(account, [first, second]), await withProject(account, [first, second])];
  const written = await write([
    { scope: inProject(doomed), overviewIds: [first, second], text: TEXT },
    { scope: inProject(kept), overviewIds: [first, second], text: TEXT },
    { scope: LIBRARY, overviewIds: [first, second], text: TEXT },
  ]);

  assert.equal((await account.inject({ method: "DELETE", url: `/api/projects/${doomed}` })).statusCode, 200);

  const deleted = await Promise.all(written.map((outcome) => isDeleted(account, outcome!.id)));
  assert.deepEqual(deleted, [true, false, false]);
});

test("an overview taken out of a project, in the app or by an assistant, takes that project's questions on it", async (t) => {
  const { testApp, account, write } = await setUp(t);
  const [first, second, third, fourth] = [
    await withOverview(account),
    await withOverview(account),
    await withOverview(account),
    await withOverview(account),
  ];
  const projectId = await withProject(account, [first, second, third, fourth]);
  const other = await withProject(account, [first, second]);
  const written = await write([
    { scope: inProject(projectId), overviewIds: [first, second], text: TEXT },
    { scope: inProject(projectId), overviewIds: [second, third], text: TEXT },
    { scope: inProject(projectId), overviewIds: [third, fourth], text: TEXT },
    { scope: inProject(other), overviewIds: [first, second], text: TEXT },
    { scope: LIBRARY, overviewIds: [first, second], text: TEXT },
  ]);

  const removed = await account.inject({
    method: "PUT",
    url: `/api/projects/${projectId}/members/${first}`,
    body: { removedAt: LATER, updatedAt: LATER },
  });
  assert.equal(removed.statusCode, 200);
  const client = await connectMcpClient(testApp, account);
  await client.callTool("change_project_members", { project: projectId, remove: [fourth] });

  const deleted = await Promise.all(written.map((outcome) => isDeleted(account, outcome!.id)));
  assert.deepEqual(deleted, [true, false, true, false, false]);
  const refused = await write([{ scope: inProject(projectId), overviewIds: [first, third], text: TEXT }]);
  assert.deepEqual(refused, [null]);
});

test("a removal that loses to a later add leaves the project's questions alone", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  const projectId = await withProject(account, [first, second]);
  const url = `/api/projects/${projectId}/members/${first}`;
  assert.equal((await account.inject({ method: "PUT", url, body: { addedAt: LATER, updatedAt: LATER } })).statusCode, 200);
  const [written] = await write([{ scope: inProject(projectId), overviewIds: [first, second], text: TEXT }]);

  assert.equal((await account.inject({ method: "PUT", url, body: { removedAt: AT, updatedAt: AT } })).statusCode, 200);

  assert.equal(await isDeleted(account, written!.id), false);
});

test("a client built before suggested questions is never sent one", async (t) => {
  const { account, write } = await setUp(t);
  const [first, second] = [await withOverview(account), await withOverview(account)];
  await write([{ scope: LIBRARY, overviewIds: [first, second], text: TEXT }]);

  const response = await account.inject({ method: "GET", url: "/api/changes?since=0&limit=200", clientVersion: CLIENT_VERSION - 1 });

  const kinds = (response.json() as { changes: Array<{ kind: string }> }).changes.map((change) => change.kind);
  assert.ok(kinds.includes("overview"));
  assert.ok(!kinds.includes("suggestedQuestion"));
});

test("asking for a refresh answers 202 at once with what happened: free, started, not due, or capped", async (t) => {
  const setting = await setUpRefresh(t, { plan: "free" });
  await saveSmallLibrary(setting);

  assert.deepEqual(await setting.refresh(LIBRARY), { status: "free" });
  await setting.setPlan("byo-plus");
  assert.deepEqual(await setting.refresh(LIBRARY), { status: "started" });
  await setting.testApp.drainQuestions();
  assert.deepEqual(await setting.refresh(LIBRARY), { status: "not-due" });
  await setting.testApp.sql.query(
    "insert into account_costs (day, account_id, area, detail, calls, quantity, dollars) values ('2026-09-01', $1, 'questions', 'write', 1, 100, 1)",
    [setting.account.accountId],
  );
  assert.deepEqual(await setting.refresh(LIBRARY), { status: "capped" });
});

test("a server without our key or meaning search answers that refreshing is unavailable, and a bad scope is refused", async (t) => {
  const { account } = await setUp(t);
  const refresh = (body: unknown) => account.inject({ method: "POST", url: "/api/suggested-questions/refresh", body: body as object });

  const unavailable = await refresh({ scope: LIBRARY });
  assert.equal(unavailable.statusCode, 202);
  assert.deepEqual(unavailable.json(), { status: "unavailable" });
  assert.equal((await refresh({ scope: { kind: "project", projectId: "not-a-uuid" } })).statusCode, 400);
  assert.equal((await refresh({})).statusCode, 400);
});

test("refreshing needs a signed-in reader", async (t) => {
  const { testApp } = await setUp(t);
  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/suggested-questions/refresh",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { scope: LIBRARY },
  });
  assert.equal(response.statusCode, 401);
});
