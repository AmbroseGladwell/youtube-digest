import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, DEFAULT_OVERVIEW_STATE } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { rawOverviewAtVersion2, storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

const CURRENT = CURRENT_SCHEMA_VERSIONS.overview;

test("creating an overview answers 201 with its revision, and the feed carries it verbatim", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();

  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  assert.equal(response.statusCode, 201);
  assert.equal(response.headers.etag, '"1"');
  assert.deepEqual(response.json(), { id: overview.id, rev: 1, seq: 1 });
  const { schemaVersion: _v, updatedAt: _u, ...body } = overview;
  const change = await account.change("overview", overview.id);
  assert.deepEqual(change, {
    kind: "overview",
    id: overview.id,
    schemaVersion: CURRENT,
    rev: 1,
    seq: 1,
    updatedAt: UPDATED_AT,
    deleted: false,
    body,
  });
  await testApp.close();
});

test("posting an overview that already exists without If-Match is refused rather than clobbered", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "already_exists");
  await testApp.close();
});

test("replacing with a matching If-Match moves the revision on, and the feed carries it once at its latest seq", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  const response = await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { ...overview, coreClaim: "A different claim." },
    ifMatch: 1,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { id: overview.id, rev: 2, seq: 2 });
  const { changes } = await account.changes();
  assert.equal(changes.length, 1);
  assert.equal(changes[0]!.body!.coreClaim, "A different claim.");
  await testApp.close();
});

test("a stale If-Match is a revision mismatch that names the current revision", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  await account.inject({ method: "POST", url: "/api/overviews", body: overview, ifMatch: 1 });

  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview, ifMatch: 1 });

  assert.equal(response.statusCode, 412);
  assert.equal(response.json().error.code, "revision_mismatch");
  assert.deepEqual(response.json().error.details, { rev: 2 });
  await testApp.close();
});

test("If-Match on an overview nobody has saved is not found", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/overviews", body: storedOverview(), ifMatch: 1 });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("an overview that fails the domain schema is refused with the reason", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: storedOverview({ keyPoints: ["only one"] }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");
  assert.match(response.json().error.details.detail, /keyPoints/);
  await testApp.close();
});

test("a body written at a version other than the client's own is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { ...storedOverview(), schemaVersion: CURRENT - 1 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.details.bodySchemaVersion, CURRENT - 1);
  await testApp.close();
});

test("a client newer than the server has its record stored as given and fed back at that version", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = randomUUID();

  const response = await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { id, aFieldThisServerHasNeverHeardOf: true, schemaVersion: CURRENT + 5, updatedAt: UPDATED_AT },
    clientVersion: 99,
  });

  assert.equal(response.statusCode, 201);
  const change = await account.change("overview", id);
  assert.equal(change.schemaVersion, CURRENT + 5);
  assert.deepEqual(change.body, { id, aFieldThisServerHasNeverHeardOf: true });
  await testApp.close();
});

test("filing a stored version-2 overview migrates it before the merge, so captureReason survives migration 3", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = randomUUID();
  const topicId = randomUUID();
  await account.seedRaw("overview", id, 2, rawOverviewAtVersion2(id));

  const response = await account.inject({
    method: "PUT",
    url: `/api/overviews/${id}/topics`,
    body: { topicIds: [topicId], updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 200);
  const change = await account.change("overview", id);
  assert.equal(change.schemaVersion, CURRENT);
  assert.deepEqual(change.body!.topicIds, [topicId]);
  assert.equal(change.body!.captureReason, "Watch again before the next session.");
  assert.equal("savedNote" in change.body!, false);
  assert.equal(change.body!.chapters, null);
  await testApp.close();
});

test("a field write to a record from a newer client is refused, naming both versions", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = randomUUID();
  await account.seedRaw("overview", id, CURRENT + 1, { id, fromTheFuture: true });

  const response = await account.inject({
    method: "PUT",
    url: `/api/overviews/${id}/capture-reason`,
    body: { captureReason: "Because", updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "record_newer_than_client");
  assert.deepEqual(response.json().error.details, {
    kind: "overview",
    storedSchemaVersion: CURRENT + 1,
    clientSchemaVersion: CURRENT,
  });
  await testApp.close();
});

test("filing an overview nobody has saved is not found rather than a creation", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "PUT",
    url: `/api/overviews/${randomUUID()}/topics`,
    body: { topicIds: [], updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual((await account.changes()).changes, []);
  await testApp.close();
});

test("the capture reason is set and taken back off without touching the rest", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  await account.inject({
    method: "PUT",
    url: `/api/overviews/${overview.id}/capture-reason`,
    body: { captureReason: "Why mammals get a billion heartbeats", updatedAt: UPDATED_AT },
  });
  assert.equal((await account.change("overview", overview.id)).body!.captureReason, "Why mammals get a billion heartbeats");

  await account.inject({
    method: "PUT",
    url: `/api/overviews/${overview.id}/capture-reason`,
    body: { captureReason: null, updatedAt: UPDATED_AT },
  });
  const change = await account.change("overview", overview.id);
  assert.equal(change.body!.captureReason, null);
  assert.equal(change.body!.coreClaim, overview.coreClaim);
  assert.equal(change.rev, 3);
  await testApp.close();
});

test("state is made from the defaults on first touch, and a later patch keeps a newer client's fields", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = randomUUID();

  const first = await account.inject({
    method: "PUT",
    url: `/api/overviews/${id}/state`,
    body: { read: true, updatedAt: UPDATED_AT },
  });
  assert.equal(first.statusCode, 200);
  assert.deepEqual((await account.change("overviewState", id)).body, {
    ...DEFAULT_OVERVIEW_STATE,
    overviewId: id,
    read: true,
  });

  const other = randomUUID();
  await account.seedRaw("overviewState", other, 1, { overviewId: other, read: false, favourite: false, userTags: [], rating: 5 });
  await account.inject({
    method: "PUT",
    url: `/api/overviews/${other}/state`,
    body: { favourite: true, updatedAt: UPDATED_AT },
  });
  const change = await account.change("overviewState", other);
  assert.equal(change.body!.favourite, true);
  assert.equal(change.body!.rating, 5);
  await testApp.close();
});

test("a state patch that changes nothing is refused rather than moving the revision for no reason", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({
    method: "PUT",
    url: `/api/overviews/${randomUUID()}/state`,
    body: { updatedAt: UPDATED_AT },
  });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("deleting tombstones the overview and its state, a second delete is a no-op, and recreating continues the revision", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  await account.inject({
    method: "PUT",
    url: `/api/overviews/${overview.id}/state`,
    body: { read: true, updatedAt: UPDATED_AT },
  });

  const deleted = await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` });
  assert.equal(deleted.statusCode, 200);
  assert.deepEqual(deleted.json(), { id: overview.id, rev: 2, seq: 3 });

  const { changes } = await account.changes();
  assert.deepEqual(
    changes.map((change) => [change.kind, change.deleted, change.updatedAt, "body" in change]),
    [
      ["overview", true, null, false],
      ["overviewState", true, null, false],
    ],
  );

  const again = await account.inject({ method: "DELETE", url: `/api/overviews/${overview.id}` });
  assert.equal(again.statusCode, 204);

  const recreated = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
  assert.equal(recreated.statusCode, 201);
  assert.equal(recreated.json().rev, 3);
  await testApp.close();
});

test("a body that is not JSON is a 400 invalid_request, not a crash", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: { ...account.headers, "content-type": "application/json" },
    payload: "{not json",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "invalid_request");
  await testApp.close();
});
