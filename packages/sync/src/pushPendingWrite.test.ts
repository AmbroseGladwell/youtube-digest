import assert from "node:assert/strict";
import test from "node:test";
import type { OutboxEntry } from "@overview/domain";
import { pushPendingWrite } from "./pushPendingWrite.js";
import { ScriptedSyncApi } from "./ScriptedSyncApi.testHelper.js";

const AT = "2026-09-26T10:00:00.000Z";
const entry = (partial: Partial<OutboxEntry> & Pick<OutboxEntry, "change">): OutboxEntry => ({
  key: 1,
  kind: "overview",
  id: "a",
  updatedAt: AT,
  stuck: null,
  ...partial,
});

test("a whole-record overview write goes to POST /overviews with the revision this device knows", async () => {
  const api = new ScriptedSyncApi();
  const record = { id: "a", schemaVersion: 4, updatedAt: AT };

  const outcome = await pushPendingWrite(api, entry({ change: { op: "replace", record } }), 5);

  assert.deepEqual(outcome, { result: "written", rev: 1 });
  assert.deepEqual(api.calls, [{ method: "createOverview", args: [record, 5] }]);
});

test("a whole-record write the server already holds is retried once with the revision it names", async () => {
  const api = new ScriptedSyncApi();
  api.failOnce("createOverview", { code: "already_exists", details: { rev: 7 } });

  const outcome = await pushPendingWrite(api, entry({ change: { op: "replace", record: { id: "a" } } }), null);

  assert.equal(outcome.result, "written");
  assert.deepEqual(api.callsTo("createOverview").map((call) => call.args[1]), [null, 7]);
});

test("a whole-record write that keeps losing the revision race is parked rather than retried forever", async () => {
  const api = new ScriptedSyncApi();
  api.failAlways("createOverview", { code: "revision_mismatch", details: { rev: 9 } });

  const outcome = await pushPendingWrite(api, entry({ change: { op: "replace", record: { id: "a" } } }), 1);

  assert.equal(outcome.result, "stuck");
  assert.equal(api.callsTo("createOverview").length, 3);
});

test("each field write goes to its own route with the date of the local write", async () => {
  const api = new ScriptedSyncApi();

  await pushPendingWrite(api, entry({ change: { op: "topics", topicIds: ["t"] } }), null);
  await pushPendingWrite(api, entry({ change: { op: "captureReason", captureReason: "why" } }), null);
  await pushPendingWrite(api, entry({ kind: "overviewState", change: { op: "state", patch: { read: true } } }), null);
  await pushPendingWrite(api, entry({ kind: "settings", id: "settings", change: { op: "settings", patch: { readerContext: "me" } } }), null);

  assert.deepEqual(api.calls, [
    { method: "setOverviewTopics", args: ["a", ["t"], AT] },
    { method: "setOverviewCaptureReason", args: ["a", "why", AT] },
    { method: "setOverviewState", args: ["a", { read: true }, AT] },
    { method: "updateSettings", args: [{ readerContext: "me" }, AT] },
  ]);
});

test("a delete is done with whether or not the server still had the record", async () => {
  const api = new ScriptedSyncApi();
  assert.deepEqual(await pushPendingWrite(api, entry({ change: { op: "delete" } }), null), { result: "gone" });
});

test("a field write to a record the server no longer has is done with, since the tombstone is on its way", async () => {
  const api = new ScriptedSyncApi();
  api.failAlways("setOverviewTopics", { code: "not_found" });

  const outcome = await pushPendingWrite(api, entry({ change: { op: "topics", topicIds: [] } }), null);

  assert.deepEqual(outcome, { result: "gone" });
});

test("a topic the server already holds under this id counts as created", async () => {
  const api = new ScriptedSyncApi();
  api.failAlways("createTopic", { code: "already_exists", details: { rev: 2 } });

  const outcome = await pushPendingWrite(api, entry({ kind: "topic", change: { op: "replace", record: { id: "a" } } }), null);

  assert.deepEqual(outcome, { result: "written", rev: 2 });
});

test("a write the server refuses for what it is gets parked with the server's reason", async () => {
  const api = new ScriptedSyncApi();
  api.failAlways("setOverviewState", { code: "record_newer_than_client" });

  const outcome = await pushPendingWrite(api, entry({ kind: "overviewState", change: { op: "state", patch: { read: true } } }), null);

  assert.equal(outcome.result, "stuck");
  assert.equal(outcome.result === "stuck" && outcome.failure.code, "record_newer_than_client");
});

test("no network, no session, an unsupported client and a server failure each stop the push instead of parking the write", async () => {
  const cases = [
    ["transport", "offline"],
    [{ code: "unauthenticated" }, "signedOut"],
    [{ code: "client_unsupported" }, "unsupported"],
    [{ code: "internal_error" }, "failed"],
  ] as const;
  for (const [failure, reason] of cases) {
    const api = new ScriptedSyncApi();
    api.failAlways("setOverviewState", failure);
    const outcome = await pushPendingWrite(api, entry({ kind: "overviewState", change: { op: "state", patch: { read: true } } }), null);
    assert.equal(outcome.result, "stopped");
    assert.equal(outcome.result === "stopped" && outcome.reason, reason);
  }
});
