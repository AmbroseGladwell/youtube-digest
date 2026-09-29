import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS, DEFAULT_SETTINGS, TopicId, UnreadableRecordError } from "@overview/domain";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { makeDevice } from "./SyncedDevice.testHelper.js";

test("what one device writes, another device on the same account reads back exactly", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const overview = makeOverview();
  await laptop.overviews.saveOverview(overview);
  await laptop.overviews.setOverviewState(overview.id, { read: true, userTags: ["later"] });
  const topic = await laptop.overviews.createTopic({ name: "Finance" });
  await laptop.overviews.setOverviewTopics(overview.id, [topic.id]);
  await laptop.overviews.setOverviewCaptureReason(overview.id, "Because");
  await laptop.settings.update({ readerContext: "A cook." });

  const pushed = await laptop.sync();
  const pulled = await phone.sync();

  assert.equal(pushed.phase, "idle");
  assert.equal(pushed.pending, 0);
  assert.equal(pulled.phase, "idle");
  assert.deepEqual(await phone.overviews.getOverview(overview.id), {
    ...overview,
    topicIds: [topic.id],
    captureReason: "Because",
  });
  assert.deepEqual(await phone.overviews.getOverviewState(overview.id), {
    overviewId: overview.id,
    read: true,
    favourite: false,
    userTags: ["later"],
  });
  assert.deepEqual(await phone.overviews.listTopics(), [topic]);
  assert.deepEqual(await phone.settings.get(), { ...DEFAULT_SETTINGS, readerContext: "A cook." });
  assert.deepEqual(await phone.overviews.listUnreadable(), []);
  await testApp.close();
});

test("a library that existed before sync was switched on is pushed whole on the first cycle", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = makeOverview();
  const laptop = await makeDevice(testApp, account, {
    before: async ({ overviews }) => {
      await overviews.saveOverview(overview);
      await overviews.setOverviewState(overview.id, { favourite: true });
    },
  });

  await laptop.sync();

  const change = await account.change("overview", overview.id);
  assert.equal(change.schemaVersion, CURRENT_SCHEMA_VERSIONS.overview);
  assert.equal((await account.change("overviewState", overview.id)).body?.favourite, true);
  await testApp.close();
});

test("two devices editing different fields of one record both end up with both edits", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const overview = makeOverview();
  await laptop.overviews.saveOverview(overview);
  await laptop.sync();
  await phone.sync();

  await laptop.overviews.setOverviewState(overview.id, { read: true });
  await phone.overviews.setOverviewState(overview.id, { favourite: true });
  await laptop.sync();
  await phone.sync();
  await laptop.sync();

  const expected = { overviewId: overview.id, read: true, favourite: true, userTags: [] };
  assert.deepEqual(await laptop.overviews.getOverviewState(overview.id), expected);
  assert.deepEqual(await phone.overviews.getOverviewState(overview.id), expected);
  await testApp.close();
});

test("a device's own unpushed edit stays visible on it while the other device's edit arrives", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const overview = makeOverview();
  await laptop.overviews.saveOverview(overview);
  await laptop.sync();
  await phone.sync();
  await phone.overviews.setOverviewState(overview.id, { favourite: true });
  await phone.sync();

  await laptop.overviews.setOverviewState(overview.id, { read: true });
  await laptop.storage.applyChanges((await account.changes(await laptop.storage.cursor())).changes, 99);

  assert.deepEqual(await laptop.overviews.getOverviewState(overview.id), {
    overviewId: overview.id,
    read: true,
    favourite: true,
    userTags: [],
  });
  await testApp.close();
});

test("deleting on one device removes the overview and its state from the other", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const overview = makeOverview();
  await laptop.overviews.saveOverview(overview);
  await laptop.overviews.setOverviewState(overview.id, { read: true });
  await laptop.sync();
  await phone.sync();

  await laptop.overviews.deleteOverview(overview.id);
  await laptop.sync();
  await phone.sync();

  assert.equal(await phone.overviews.getOverview(overview.id), null);
  assert.deepEqual(await phone.overviews.listOverviews(), []);
  assert.equal((await phone.overviews.getOverviewState(overview.id)).read, false);
  await testApp.close();
});

test("a regeneration on one device replaces the overview on the other, keeping its filing from before", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const overview = makeOverview();
  await laptop.overviews.saveOverview(overview);
  await laptop.sync();
  await phone.sync();

  await laptop.overviews.saveOverview({ ...overview, coreClaim: "A sharper claim." });
  await laptop.sync();
  await phone.sync();

  assert.equal((await phone.overviews.getOverview(overview.id))?.coreClaim, "A sharper claim.");
  assert.equal((await account.change("overview", overview.id)).rev, 2);
  await testApp.close();
});

test("a record from a newer client arrives, is held back and counted, and cannot be written to from here", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const phone = await makeDevice(testApp, account);
  const id = randomUUID();
  await account.seedRaw("overview", id, CURRENT_SCHEMA_VERSIONS.overview + 1, { id, fromTheFuture: true });

  const status = await phone.sync();

  assert.equal(status.phase, "idle");
  const [unreadable] = await phone.overviews.listUnreadable();
  assert.equal(unreadable?.reason, "future-version");
  assert.equal(unreadable?.id, id);
  await assert.rejects(
    () => phone.overviews.setOverviewTopics(id as never, [TopicId.parse(randomUUID())]),
    UnreadableRecordError,
  );
  await testApp.close();
});

test("a write the server refuses is kept and counted as stuck, and the rest of the library still syncs", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const good = makeOverview();
  const bad = makeOverview({ keyPoints: ["only one"] });
  const laptop = await makeDevice(testApp, account, {
    before: async ({ overviews }) => {
      await overviews.saveOverview(bad);
      await overviews.saveOverview(good);
    },
  });

  const status = await laptop.sync();

  assert.equal(status.phase, "idle");
  assert.equal(status.stuck, 1);
  assert.equal(status.pending, 0);
  assert.equal((await account.changes()).changes.map((change) => change.id).includes(good.id), true);
  assert.equal((await account.changes()).changes.map((change) => change.id).includes(bad.id), false);
  const [parked] = (await laptop.storage.listPending()).filter((entry) => entry.stuck !== null);
  assert.equal(parked?.stuck?.code, "invalid_request");
  await testApp.close();
});

test("below the write floor the device pulls but pushes nothing, and says it is unsupported", async () => {
  const testApp = await createTestApp({ minSupportedClientVersion: CLIENT_VERSION + 1 });
  const account = await makeAccount(testApp);
  const other = makeOverview();
  await account.inject({
    method: "POST",
    url: "/api/overviews",
    body: { ...other, schemaVersion: CURRENT_SCHEMA_VERSIONS.overview, updatedAt: "2026-09-26T08:30:00.000Z" },
    clientVersion: CLIENT_VERSION + 1,
  });
  const laptop = await makeDevice(testApp, account);
  await laptop.overviews.saveOverview(makeOverview());

  const status = await laptop.sync();

  assert.equal(status.phase, "unsupported");
  assert.equal(status.handshake?.minSupportedClientVersion, CLIENT_VERSION + 1);
  assert.equal(status.pending, 1);
  assert.deepEqual(await laptop.overviews.getOverview(other.id), other);
  assert.equal((await account.changes()).changes.length, 1);
  await testApp.close();
});

test("a token the server does not know leaves the device signed out with its writes still pending", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account, { token: "not-a-session" });
  await laptop.overviews.saveOverview(makeOverview());

  const status = await laptop.sync();

  assert.equal(status.phase, "signedOut");
  assert.equal((await laptop.storage.listPending()).length, 1);
  await testApp.close();
});

test("the feed is pulled page by page, and the cursor ends where the feed does", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  for (let i = 0; i < 5; i += 1) await laptop.overviews.saveOverview(makeOverview());
  await laptop.sync();
  const phone = await makeDevice(testApp, account, { pageSize: 2 });

  await phone.sync();

  assert.equal((await phone.overviews.listOverviews()).length, 5);
  assert.equal(await phone.storage.cursor(), 5);
  await testApp.close();
});

test("a transcript one device fetched is read on another device, which then holds it without asking again", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  const transcript = makeStoredTranscript();
  await laptop.transcripts.saveTranscript(transcript);

  const pushed = await laptop.sync();
  await phone.sync();

  assert.equal(pushed.pending, 0);
  assert.equal(await phone.transcripts.getTranscript(transcript.videoId), null);
  assert.deepEqual(await phone.engine.fetchTranscript(transcript.videoId), transcript);
  assert.deepEqual(await phone.transcripts.getTranscript(transcript.videoId), transcript);
  assert.deepEqual(await phone.storage.listPending(), []);
  await testApp.close();
});

test("transcripts a device held before sync was switched on reach the account on its first sync", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const laptop = await makeDevice(testApp, account, {
    before: ({ transcripts }) => transcripts.saveTranscript(transcript),
  });
  const phone = await makeDevice(testApp, account);

  await laptop.sync();

  assert.deepEqual(await phone.engine.fetchTranscript(transcript.videoId), transcript);
  await testApp.close();
});

test("a transcript no device on the account has fetched is not found on the server", async () => {
  const testApp = await createTestApp();
  const phone = await makeDevice(testApp, await makeAccount(testApp));

  assert.equal(await phone.engine.fetchTranscript("never-fetched"), null);
  await testApp.close();
});
