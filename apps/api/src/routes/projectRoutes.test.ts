import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_SCHEMA_VERSIONS, projectMemberId } from "@overview/domain";
import { makeProject } from "@overview/store-conformance";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

const storedProject = (overrides: Record<string, unknown> = {}) => ({
  ...makeProject(),
  schemaVersion: CURRENT_SCHEMA_VERSIONS.project,
  updatedAt: UPDATED_AT,
  ...overrides,
});

async function withProject(account: TestAccount) {
  const project = storedProject();
  const response = await account.inject({ method: "POST", url: "/api/projects", body: project });
  assert.equal(response.statusCode, 201);
  return project;
}

async function withOverview(account: TestAccount) {
  const overview = storedOverview();
  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  assert.equal(response.statusCode, 201);
  return overview;
}

const member = (account: TestAccount, projectId: string, overviewId: string, body: Record<string, unknown>) =>
  account.inject({ method: "PUT", url: `/api/projects/${projectId}/members/${overviewId}`, body: { updatedAt: UPDATED_AT, ...body } });

test("making a project answers 201 and the feed carries it to every device", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const project = await withProject(account);

  assert.equal((await account.change("project", project.id)).body!.name, "Kitchen renovation");
  await testApp.close();
});

test("a project made in the app that claims an assistant made it is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/projects",
    body: storedProject({ createdBy: { by: "assistant", connectionId: "conn-1", name: "Claude" } }),
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("a rename on one device and an archive on another both land", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);

  const rename = await account.inject({
    method: "PUT",
    url: `/api/projects/${project.id}`,
    body: { name: "Kitchen", updatedAt: UPDATED_AT },
  });
  const archive = await account.inject({
    method: "PUT",
    url: `/api/projects/${project.id}`,
    body: { archivedAt: "2026-11-12T10:00:00.000Z", updatedAt: UPDATED_AT },
  });

  assert.equal(rename.statusCode, 200);
  assert.equal(archive.statusCode, 200);
  const { body } = await account.change("project", project.id);
  assert.equal(body!.name, "Kitchen");
  assert.equal(body!.archivedAt, "2026-11-12T10:00:00.000Z");
  await testApp.close();
});

test("the reader's purpose is marked as theirs, and a patch that says an assistant wrote it is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);

  const claimed = await account.inject({
    method: "PUT",
    url: `/api/projects/${project.id}`,
    body: { purpose: "Theirs", purposeBy: { by: "assistant", connectionId: "conn-1", name: "Claude" }, updatedAt: UPDATED_AT },
  });
  const edited = await account.inject({
    method: "PUT",
    url: `/api/projects/${project.id}`,
    body: { purpose: "Mine now", purposeBy: { by: "reader" }, updatedAt: UPDATED_AT },
  });

  assert.equal(claimed.statusCode, 400);
  assert.equal(edited.statusCode, 200);
  const { body } = await account.change("project", project.id);
  assert.equal(body!.purpose, "Mine now");
  assert.deepEqual(body!.purposeBy, { by: "reader" });
  await testApp.close();
});

test("changing a project that isn't there is a 404", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "PUT",
    url: `/api/projects/${makeProject().id}`,
    body: { name: "Nothing", updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("adding an overview makes one membership record, marked as the reader's whatever the client says", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);
  const overview = await withOverview(account);

  const response = await member(account, project.id, overview.id, { addedAt: "2026-11-12T09:00:00.000Z" });
  const claimed = await member(account, project.id, overview.id, {
    addedAt: "2026-11-12T09:30:00.000Z",
    addedBy: { by: "assistant", connectionId: "conn-1", name: "Claude" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(claimed.statusCode, 400);
  const { body } = await account.change("projectMember", projectMemberId(project.id, overview.id));
  assert.deepEqual(body, {
    id: projectMemberId(project.id, overview.id),
    projectId: project.id,
    overviewId: overview.id,
    addedAt: "2026-11-12T09:00:00.000Z",
    addedBy: { by: "reader" },
    removedAt: null,
  });
  await testApp.close();
});

test("a removal made before an add but arriving after it does not take the overview out", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);
  const overview = await withOverview(account);
  await member(account, project.id, overview.id, { addedAt: "2026-11-12T09:00:00.000Z" });
  await member(account, project.id, overview.id, { addedAt: "2026-11-12T11:00:00.000Z" });

  await member(account, project.id, overview.id, { removedAt: "2026-11-12T10:00:00.000Z" });

  const { body } = await account.change("projectMember", projectMemberId(project.id, overview.id));
  assert.equal(body!.addedAt, "2026-11-12T11:00:00.000Z");
  assert.equal(body!.removedAt, "2026-11-12T10:00:00.000Z");
  await testApp.close();
});

test("adding to two projects at once from two devices makes two membership records, and both survive", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const [first, second] = [await withProject(account), await withProject(account)];
  const overview = await withOverview(account);

  await Promise.all([
    member(account, first.id, overview.id, { addedAt: "2026-11-12T09:00:00.000Z" }),
    member(account, second.id, overview.id, { addedAt: "2026-11-12T09:00:00.000Z" }),
  ]);

  const memberships = (await account.changes()).changes.filter((change) => change.kind === "projectMember" && !change.deleted);
  assert.equal(memberships.length, 2);
  await testApp.close();
});

test("an overview can't be added to a project that isn't there, nor for an overview that was deleted", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);
  const overview = await withOverview(account);
  await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` });

  const noProject = await member(account, makeProject().id, storedOverview().id, { addedAt: UPDATED_AT });
  const deletedOverview = await member(account, project.id, overview.id, { addedAt: UPDATED_AT });

  assert.equal(noProject.statusCode, 404);
  assert.equal(deletedOverview.statusCode, 404);
  await testApp.close();
});

test("an overview can be added to a project the server hasn't seen yet, since it may still be on its way", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);

  const response = await member(account, project.id, storedOverview().id, { addedAt: UPDATED_AT });

  assert.equal(response.statusCode, 200);
  await testApp.close();
});

test("removing an overview that was never in the project is a 404", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);

  const response = await member(account, project.id, storedOverview().id, { removedAt: UPDATED_AT });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("deleting a project tombstones it and every membership record in it, and no overview can be added after", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const [doomed, kept] = [await withProject(account), await withProject(account)];
  const overview = await withOverview(account);
  await member(account, doomed.id, overview.id, { addedAt: UPDATED_AT });
  await member(account, kept.id, overview.id, { addedAt: UPDATED_AT });

  const first = await account.inject({ method: "DELETE", url: `/api/projects/${doomed.id}` });
  const again = await account.inject({ method: "DELETE", url: `/api/projects/${doomed.id}` });
  const late = await member(account, doomed.id, overview.id, { addedAt: "2026-11-12T12:00:00.000Z" });

  assert.equal(first.statusCode, 200);
  assert.equal(again.statusCode, 204);
  assert.equal(late.statusCode, 404);
  assert.equal((await account.change("project", doomed.id)).deleted, true);
  assert.equal((await account.change("projectMember", projectMemberId(doomed.id, overview.id))).deleted, true);
  assert.equal((await account.change("projectMember", projectMemberId(kept.id, overview.id))).deleted, false);
  await testApp.close();
});

test("deleting an overview takes it out of every project", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const [first, second] = [await withProject(account), await withProject(account)];
  const [doomed, kept] = [await withOverview(account), await withOverview(account)];
  for (const project of [first, second]) await member(account, project.id, doomed.id, { addedAt: UPDATED_AT });
  await member(account, first.id, kept.id, { addedAt: UPDATED_AT });

  await account.inject({ method: "DELETE", url: `/api/overviews/${doomed.id}` });

  const live = (await account.changes()).changes.filter((change) => change.kind === "projectMember" && !change.deleted);
  assert.deepEqual(
    live.map((change) => change.id),
    [projectMemberId(first.id, kept.id)],
  );
  await testApp.close();
});

test("a client built before projects is never sent one, and its feed still moves past them", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const project = await withProject(account);
  await member(account, project.id, storedOverview().id, { addedAt: UPDATED_AT });

  const response = await account.inject({ method: "GET", url: "/api/changes?since=0", clientVersion: 19 });

  assert.deepEqual(response.json().changes, []);
  assert.equal(response.json().next, 0);
  await testApp.close();
});
