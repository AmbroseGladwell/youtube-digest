import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  CLIENT_VERSION,
  CURRENT_SCHEMA_VERSIONS,
  DEFAULT_SETTINGS,
  TopicId,
  UnreadableRecordError,
  VideoId,
} from "@overview/domain";
import { makeOverview, makeStoredTranscript } from "@overview/store-conformance";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { distinctVideo, storedOverview } from "../testing/storedRecords.testHelper.js";
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
  const good = makeOverview({ video: distinctVideo() });
  const bad = makeOverview({ video: distinctVideo(), keyPoints: [{ text: "only one", range: null }] });
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
  for (let i = 0; i < 5; i += 1) await laptop.overviews.saveOverview(makeOverview({ video: distinctVideo() }));
  await laptop.sync();
  const phone = await makeDevice(testApp, account, { pageSize: 2 });

  await phone.sync();

  assert.equal((await phone.overviews.listOverviews()).length, 5);
  assert.equal(await phone.storage.cursor(), 5);
  await testApp.close();
});

test("a note's transcript made on one device is read on another, which then holds it without asking again", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  const transcript = makeStoredTranscript();
  await laptop.transcripts.saveTranscript(transcript);
  await laptop.overviews.saveOverview(makeOverview({ video: transcript.video! }));

  const pushed = await laptop.sync();
  await phone.sync();

  assert.equal(pushed.pending, 0);
  assert.equal(await phone.transcripts.getTranscript(transcript.videoId), null);
  assert.deepEqual(await phone.engine.fetchTranscript(transcript.videoId), transcript);
  assert.deepEqual(await phone.transcripts.getTranscript(transcript.videoId), transcript);
  assert.deepEqual(await phone.storage.listPending(), []);
  await testApp.close();
});

test("the transcripts behind the notes a device held before sync was switched on reach the account on its first sync", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const laptop = await makeDevice(testApp, account, {
    before: async ({ transcripts, overviews }) => {
      await transcripts.saveTranscript(transcript);
      await overviews.saveOverview(makeOverview({ video: transcript.video! }));
    },
  });
  const phone = await makeDevice(testApp, account);

  await laptop.sync();

  assert.deepEqual(await phone.engine.fetchTranscript(transcript.videoId), transcript);
  await testApp.close();
});

test("captions kept only because a video was open never leave the device, before or after sync is switched on", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const watchedBefore = makeStoredTranscript({ videoId: VideoId.parse("watched-before") });
  const watchedAfter = makeStoredTranscript({ videoId: VideoId.parse("watched-after") });
  const laptop = await makeDevice(testApp, account, {
    before: ({ transcripts }) => transcripts.saveTranscript(watchedBefore),
  });
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  await laptop.transcripts.saveTranscript(watchedAfter);

  const status = await laptop.sync();

  assert.equal(status.pending, 0);
  assert.equal(await phone.engine.fetchTranscript(watchedBefore.videoId), null);
  assert.equal(await phone.engine.fetchTranscript(watchedAfter.videoId), null);
  await testApp.close();
});

test("a transcript no device on the account has fetched is not found on the server", async () => {
  const testApp = await createTestApp();
  const phone = await makeDevice(testApp, await makeAccount(testApp));

  assert.equal(await phone.engine.fetchTranscript("never-fetched"), null);
  await testApp.close();
});

test("a note deleted before it was ever synced sends no transcript, and the account keeps none", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  const transcript = makeStoredTranscript();
  const note = makeOverview({ video: transcript.video! });
  await laptop.transcripts.saveTranscript(transcript);
  await laptop.overviews.saveOverview(note);
  await laptop.overviews.deleteOverview(note.id);

  const status = await laptop.sync();

  assert.equal(status.pending, 0);
  assert.equal(status.stuck, 0);
  assert.equal(await phone.engine.fetchTranscript(transcript.videoId), null);
  await testApp.close();
});

test("deleting a synced note on one device leaves the account no transcript for another device to fetch", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  const transcript = makeStoredTranscript();
  const note = makeOverview({ video: transcript.video! });
  await laptop.transcripts.saveTranscript(transcript);
  await laptop.overviews.saveOverview(note);
  await laptop.sync();

  await laptop.overviews.deleteOverview(note.id);
  await laptop.sync();

  assert.equal(await phone.engine.fetchTranscript(transcript.videoId), null);
  await testApp.close();
});

test("two devices that generate the same video offline end with one overview carrying both devices' read, favourite and topic state", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  await phone.sync();
  const video = distinctVideo();
  const onLaptop = makeOverview({ video, tags: ["one", "two"] });
  const onPhone = makeOverview({ video, tags: ["two", "three"], captureReason: "Because" });
  const laptopTopic = await laptop.overviews.createTopic({ name: "Finance" });
  const phoneTopic = await phone.overviews.createTopic({ name: "Cooking" });
  await laptop.overviews.saveOverview({ ...onLaptop, topicIds: [laptopTopic.id] });
  await laptop.overviews.setOverviewState(onLaptop.id, { read: true });
  await phone.overviews.saveOverview({ ...onPhone, topicIds: [phoneTopic.id] });
  await phone.overviews.setOverviewState(onPhone.id, { favourite: true, userTags: ["later"] });

  const laptopStatus = await laptop.sync();
  const phoneStatus = await phone.sync();
  await laptop.sync();

  assert.equal(laptopStatus.phase, "idle");
  assert.deepEqual({ phase: phoneStatus.phase, pending: phoneStatus.pending, stuck: phoneStatus.stuck }, { phase: "idle", pending: 0, stuck: 0 });
  for (const device of [laptop, phone]) {
    const held = await device.overviews.listOverviews();
    assert.deepEqual(held.map((overview) => overview.id), [onLaptop.id]);
    assert.deepEqual(held[0]!.topicIds, [laptopTopic.id, phoneTopic.id]);
    assert.deepEqual(held[0]!.tags, ["one", "two", "three"]);
    assert.equal(held[0]!.captureReason, "Because");
    assert.deepEqual(await device.overviews.getOverviewState(onLaptop.id), {
      overviewId: onLaptop.id,
      read: true,
      favourite: true,
      userTags: ["later"],
    });
    assert.equal(await device.overviews.getOverview(onPhone.id), null);
    assert.deepEqual(await device.storage.listPending(), []);
  }
  assert.equal((await account.changes()).changes.filter((change) => change.kind === "overview" && !change.deleted).length, 1);
  await testApp.close();
});

test("a device that generates a video the account already holds, before pulling it, folds its copy into the account's and tells the shell", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  const video = distinctVideo();
  const theirs = makeOverview({ video });
  await laptop.overviews.saveOverview(theirs);
  await laptop.sync();
  const mine = makeOverview({ video });
  const folds: unknown[] = [];
  const telling = await makeDevice(testApp, account, { onFolded: (fold) => folds.push(fold) });
  await telling.overviews.saveOverview(mine);
  await telling.overviews.setOverviewState(mine.id, { read: true });

  await telling.sync();
  await phone.sync();

  assert.deepEqual(folds, [{ from: mine.id, into: theirs.id }]);
  assert.deepEqual((await telling.overviews.listOverviews()).map((overview) => overview.id), [theirs.id]);
  assert.equal((await telling.overviews.getOverviewState(theirs.id)).read, true);
  assert.equal((await phone.overviews.getOverviewState(theirs.id)).read, true);
  assert.equal(await phone.overviews.getOverview(mine.id), null);
  await testApp.close();
});

test("an account that already held duplicates ends with one overview per video, state merged, and every device drops the others", async () => {
  const testApp = await createTestApp({}, { migrationsUpTo: 17 });
  const account = await makeAccount(testApp);
  const video = distinctVideo();
  const earlier = makeOverview({ video, savedAt: "2026-09-01T00:00:00.000Z", tags: ["one"] });
  const later = makeOverview({ video, savedAt: "2026-09-02T00:00:00.000Z", tags: ["two"] });
  const { schemaVersion: _v, updatedAt: _u, ...stored } = storedOverview();
  for (const overview of [later, earlier]) {
    await account.seedRaw("overview", overview.id, CURRENT_SCHEMA_VERSIONS.overview, { ...stored, ...overview });
  }
  await account.seedRaw("overviewState", later.id, CURRENT_SCHEMA_VERSIONS.overviewState, { overviewId: later.id, read: true, favourite: false, userTags: [] });
  const laptop = await makeDevice(testApp, account);
  const phone = await makeDevice(testApp, account);
  await laptop.sync();
  await phone.sync();
  assert.equal((await laptop.overviews.listOverviews()).length, 2);

  await runMigrations(testApp.sql, { before: migrationSteps() });
  await laptop.sync();
  await phone.sync();

  for (const device of [laptop, phone]) {
    const held = await device.overviews.listOverviews();
    assert.deepEqual(held.map((overview) => overview.id), [earlier.id]);
    assert.deepEqual(held[0]!.tags, ["one", "two"]);
    assert.equal((await device.overviews.getOverviewState(earlier.id)).read, true);
    assert.equal(await device.overviews.getOverview(later.id), null);
  }
  await testApp.close();
});
