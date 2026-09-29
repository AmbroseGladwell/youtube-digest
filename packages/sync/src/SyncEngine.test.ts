import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_VERSION, VideoId, type RecordChange, type StoredTranscript } from "@overview/domain";
import { InMemorySyncStorage } from "./InMemorySyncStorage.testHelper.js";
import { ScriptedSyncApi } from "./ScriptedSyncApi.testHelper.js";
import { SyncEngine } from "./SyncEngine.js";

const AT = "2026-09-26T10:00:00.000Z";
const NOW = new Date("2026-09-26T12:00:00.000Z");

const change = (overrides: Partial<RecordChange> & Pick<RecordChange, "id" | "seq">): RecordChange => ({
  kind: "overview",
  schemaVersion: 4,
  rev: 1,
  updatedAt: AT,
  deleted: false,
  body: { id: overrides.id },
  ...overrides,
});

const engineOver = (api: ScriptedSyncApi, storage: InMemorySyncStorage, applied: RecordChange[][] = []) =>
  new SyncEngine({ api, storage, now: () => NOW, onApplied: (changes) => applied.push(changes) });

test("the first cycle enrols the library, so everything it already held is pushed", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.libraryOnEnrol = [
    { kind: "overview", id: "a", updatedAt: AT, change: { op: "replace", record: { id: "a" } } },
    { kind: "overviewState", id: "a", updatedAt: AT, change: { op: "state", patch: { read: true, favourite: false, userTags: [] } } },
  ];

  const status = await engineOver(api, storage).sync();

  assert.equal(storage.enrolled, true);
  assert.deepEqual(api.calls.map((call) => call.method), ["handshake", "createOverview", "setOverviewState", "changes"]);
  assert.deepEqual(storage.outbox, []);
  assert.equal(status.phase, "idle");
  assert.equal(status.lastSyncedAt, NOW.toISOString());
  assert.equal(storage.revisions.get("overview/a"), 1);
});

test("pushes go in the order they were journaled, and the feed is pulled after them to its end", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  storage.journal({ kind: "overview", id: "a", updatedAt: AT, change: { op: "replace", record: { id: "a" } } });
  storage.journal({ kind: "overview", id: "a", updatedAt: AT, change: { op: "topics", topicIds: ["t"] } });
  api.queuePage([change({ id: "b", seq: 3 })], true);
  api.queuePage([change({ id: "c", seq: 4 })], false);
  const applied: RecordChange[][] = [];

  await engineOver(api, storage, applied).sync();

  assert.deepEqual(api.calls.map((call) => call.method), ["handshake", "createOverview", "setOverviewTopics", "changes", "changes"]);
  assert.deepEqual(api.callsTo("changes").map((call) => call.args[0]), [0, 3]);
  assert.equal(storage.cursorValue, 4);
  assert.deepEqual(applied.map((page) => page.map((c) => c.id)), [["b"], ["c"]]);
  assert.ok(storage.records.has("overview/b") && storage.records.has("overview/c"));
});

test("the next cycle asks the feed from where the last one stopped", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  storage.cursorValue = 41;

  await engineOver(api, storage).sync();

  assert.deepEqual(api.callsTo("changes")[0]?.args[0], 41);
});

test("a write the server refuses is parked, later writes to that record wait behind it, and other records still go", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  api.failAlways("createOverview", { code: "invalid_request" });
  storage.journal({ kind: "overview", id: "a", updatedAt: AT, change: { op: "replace", record: { id: "a" } } });
  storage.journal({ kind: "overview", id: "a", updatedAt: AT, change: { op: "topics", topicIds: ["t"] } });
  storage.journal({ kind: "overviewState", id: "b", updatedAt: AT, change: { op: "state", patch: { read: true } } });

  const status = await engineOver(api, storage).sync();

  assert.deepEqual(api.calls.map((call) => call.method), ["handshake", "createOverview", "setOverviewState", "changes"]);
  assert.equal(storage.outbox.length, 2);
  assert.equal(storage.outbox[0]?.stuck?.code, "invalid_request");
  assert.equal(storage.outbox[1]?.stuck, null);
  assert.equal(status.phase, "idle");
  assert.equal(status.stuck, 1);
  assert.equal(status.pending, 1);
});

test("a parked write is not retried on the next cycle", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  api.failAlways("createOverview", { code: "invalid_request" });
  storage.journal({ kind: "overview", id: "a", updatedAt: AT, change: { op: "replace", record: { id: "a" } } });
  const engine = engineOver(api, storage);

  await engine.sync();
  await engine.sync();

  assert.equal(api.callsTo("createOverview").length, 1);
});

test("losing the network stops the cycle where it was and reports offline, with everything still pending", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  api.failOnce("setOverviewState", "transport");
  storage.journal({ kind: "overviewState", id: "a", updatedAt: AT, change: { op: "state", patch: { read: true } } });
  storage.journal({ kind: "overviewState", id: "b", updatedAt: AT, change: { op: "state", patch: { read: true } } });
  const engine = engineOver(api, storage);

  const stopped = await engine.sync();
  assert.equal(stopped.phase, "offline");
  assert.equal(stopped.pending, 2);
  assert.equal(api.callsTo("changes").length, 0);

  const resumed = await engine.sync();
  assert.equal(resumed.phase, "idle");
  assert.equal(resumed.pending, 0);
});

test("a rejected session stops the cycle as signed out and pushes nothing further", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  api.failAlways("handshake", { code: "unauthenticated" });

  const status = await engineOver(api, storage).sync();

  assert.equal(status.phase, "signedOut");
});

test("below the write floor nothing is pushed, the feed is still pulled, and the status is the wall", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  api.handshakeAnswer = { minSupportedClientVersion: CLIENT_VERSION + 1, currentClientVersion: CLIENT_VERSION + 1 };
  storage.journal({ kind: "overviewState", id: "a", updatedAt: AT, change: { op: "state", patch: { read: true } } });
  api.queuePage([change({ id: "b", seq: 1 })]);

  const status = await engineOver(api, storage).sync();

  assert.equal(status.phase, "unsupported");
  assert.deepEqual(api.calls.map((call) => call.method), ["handshake", "changes"]);
  assert.equal(status.pending, 1);
  assert.ok(storage.records.has("overview/b"));
  assert.deepEqual(status.handshake, api.handshakeAnswer);
});

test("a cycle asked for while one is running runs once afterwards, not once per ask", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  const engine = engineOver(api, storage);

  const first = engine.sync();
  const second = engine.sync();
  const third = engine.sync();
  await Promise.all([first, second, third]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  while (engine.status.phase === "syncing") await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(api.callsTo("handshake").length, 2);
});

test("status listeners see syncing and then the outcome", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  const engine = engineOver(api, storage);
  const phases: string[] = [];
  engine.subscribe((status) => phases.push(status.phase));

  await engine.sync();

  assert.deepEqual(phases.at(0), "syncing");
  assert.deepEqual(phases.at(-1), "idle");
});

test("a journaled write starts a cycle without being asked", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  const engine = engineOver(api, storage);
  const stop = engine.start({ intervalMs: 60_000, journalDebounceMs: 1 });
  await engine.sync();

  storage.journal({ kind: "overviewState", id: "a", updatedAt: AT, change: { op: "state", patch: { read: true } } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(api.callsTo("setOverviewState").length, 1);
});

const transcriptFor = (videoId: string): StoredTranscript => ({
  videoId: VideoId.parse(videoId),
  segments: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
  generated: false,
  fetchedAt: AT,
});

test("a journaled transcript is sent in the cycle and leaves the outbox without a revision", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  const transcript = transcriptFor("v1");
  await storage.keepTranscript(transcript);
  storage.notedVideoIds.add("v1");
  storage.journal({ kind: "transcript", id: "v1", updatedAt: AT, change: { op: "transcript", overviewId: "a" } });

  const status = await engineOver(api, storage).sync();

  assert.deepEqual(api.callsTo("saveTranscript").map((call) => call.args), [[transcript]]);
  assert.deepEqual(storage.outbox, []);
  assert.equal(storage.revisions.has("transcript/v1"), false);
  assert.equal(status.pending, 0);
});

test("a transcript fetched from the server is kept on this device", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  const transcript = transcriptFor("v2");
  api.transcripts.set("v2", transcript);

  const fetched = await engineOver(api, storage).fetchTranscript("v2");

  assert.deepEqual(fetched, transcript);
  assert.deepEqual(storage.transcripts.get("v2"), transcript);
  assert.deepEqual(storage.outbox, []);
});

test("a transcript the server does not keep is null, and nothing is kept", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();

  assert.equal(await engineOver(api, storage).fetchTranscript("v3"), null);
  assert.equal(storage.transcripts.size, 0);
});

test("a transcript that cannot be fetched fails loudly rather than reading as never kept", async () => {
  const api = new ScriptedSyncApi();
  api.failOnce("getTranscript", "transport");

  await assert.rejects(engineOver(api, new InMemorySyncStorage()).fetchTranscript("v4"));
});

test("a note's transcript waits behind the note when the server refuses the note, instead of being sent and dropped", async () => {
  const api = new ScriptedSyncApi();
  api.failAlways("createOverview", { code: "invalid_request" });
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  await storage.keepTranscript(transcriptFor("v5"));
  storage.notedVideoIds.add("v5");
  storage.journal({ kind: "overview", id: "n5", updatedAt: AT, change: { op: "replace", record: { id: "n5" } } });
  storage.journal({ kind: "transcript", id: "v5", updatedAt: AT, change: { op: "transcript", overviewId: "n5" } });

  const status = await engineOver(api, storage).sync();

  assert.deepEqual(api.callsTo("saveTranscript"), []);
  assert.deepEqual(
    storage.outbox.map((entry) => [entry.kind, entry.stuck === null]),
    [
      ["overview", false],
      ["transcript", true],
    ],
  );
  assert.equal(status.stuck, 1);
  assert.equal(status.pending, 1);
});

test("a transcript whose note was parked in an earlier cycle still waits behind it", async () => {
  const api = new ScriptedSyncApi();
  const storage = new InMemorySyncStorage();
  storage.enrolled = true;
  await storage.keepTranscript(transcriptFor("v6"));
  storage.notedVideoIds.add("v6");
  const note = storage.journal({ kind: "overview", id: "n6", updatedAt: AT, change: { op: "replace", record: { id: "n6" } } });
  await storage.park(note.key, { code: "invalid_request", message: "no" });
  storage.journal({ kind: "transcript", id: "v6", updatedAt: AT, change: { op: "transcript", overviewId: "n6" } });

  await engineOver(api, storage).sync();

  assert.deepEqual(api.callsTo("saveTranscript"), []);
  assert.equal(storage.outbox.length, 2);
});
