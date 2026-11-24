import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, youTubeSource } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { distinctVideo, storedOverview, UPDATED_AT } from "../testing/storedRecords.testHelper.js";

const keptCapture = (overrides: Record<string, unknown> = {}) => {
  const source = distinctVideo();
  return {
    id: randomUUID(),
    sourceKey: source.id,
    url: source.url,
    keptAt: UPDATED_AT,
    keptFrom: "phone",
    captureReason: null,
    stage: "kept",
    source: null,
    waitingFor: "server",
    resumesAt: "2026-09-27T00:00:00.000Z",
    schemaVersion: CURRENT_SCHEMA_VERSIONS.capture,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
};

const savedCapture = (overrides: Record<string, unknown> = {}) => {
  const source = distinctVideo();
  return keptCapture({
    sourceKey: source.id,
    url: source.url,
    stage: "saved",
    source,
    savedAt: UPDATED_AT,
    waitingFor: undefined,
    resumesAt: undefined,
    ...overrides,
  });
};

const usedSaves = async (account: TestAccount) => {
  const usage = await account.inject({ method: "GET", url: "/api/overview-usage" });
  return usage.json<{ saves: { used: number; limit: number } }>().saves;
};

test("a kept link answers 201 and the feed carries it to every device", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const capture = keptCapture();

  const response = await account.inject({ method: "POST", url: "/api/captures", body: capture });

  assert.equal(response.statusCode, 201);
  assert.equal((await account.change("capture", capture.id)).body!.waitingFor, "server");
  await testApp.close();
});

test("keeping a link counts nothing, and saving one counts once against the month's saves", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const capture = keptCapture();
  await account.inject({ method: "POST", url: "/api/captures", body: capture });
  const kept = await usedSaves(account);

  const source = { ...distinctVideo(), id: capture.sourceKey, url: capture.url };
  const saved = savedCapture({ id: capture.id, sourceKey: capture.sourceKey, url: capture.url, source });
  await account.inject({ method: "POST", url: "/api/captures", body: saved, ifMatch: 1 });
  await account.inject({ method: "POST", url: "/api/captures", body: { ...saved, captureReason: "for later" }, ifMatch: 2 });

  assert.deepEqual(kept, { used: 0, limit: 50 });
  assert.deepEqual(await usedSaves(account), { used: 1, limit: 50 });
  await testApp.close();
});

test("a save past the month's limit is refused with the quota and the reset, and nothing is counted", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await testApp.sql.query("insert into capture_saves (month, account_id, saves) values ('2026-09-01', $1, 50)", [account.accountId]);

  const response = await account.inject({ method: "POST", url: "/api/captures", body: savedCapture() });

  assert.equal(response.statusCode, 429);
  assert.equal(response.json().error.details.quota, "saves");
  assert.deepEqual(await usedSaves(account), { used: 50, limit: 50 });
  await testApp.close();
});

test("a refused save gives its count back", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const first = savedCapture();
  await account.inject({ method: "POST", url: "/api/captures", body: first });

  const second = await account.inject({
    method: "POST",
    url: "/api/captures",
    body: savedCapture({ sourceKey: first.sourceKey, url: first.url, source: first.source }),
  });

  assert.equal(second.statusCode, 409);
  assert.deepEqual(await usedSaves(account), { used: 1, limit: 50 });
  await testApp.close();
});

test("a second capture of a kept source is refused and names the first", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const first = keptCapture();
  await account.inject({ method: "POST", url: "/api/captures", body: first });

  const second = await account.inject({ method: "POST", url: "/api/captures", body: keptCapture({ sourceKey: first.sourceKey }) });

  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, "capture_already_held");
  assert.equal(second.json().error.details.captureId, first.id);
  await testApp.close();
});

test("a capture of a source the account holds an overview of is refused and names the overview", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const overview = storedOverview();
  await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  const response = await account.inject({
    method: "POST",
    url: "/api/captures",
    body: keptCapture({ sourceKey: overview.source.id, url: overview.source.url }),
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "video_already_held");
  assert.equal(response.json().error.details.overviewId, overview.id);
  await testApp.close();
});

test("an overview under a capture's id takes its place, and a capture of the same source goes too", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const capture = savedCapture();
  await account.inject({ method: "POST", url: "/api/captures", body: capture });

  const overview = storedOverview({ id: capture.id as never, source: capture.source as never });
  const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });

  assert.equal(response.statusCode, 201);
  assert.equal((await account.change("capture", capture.id)).deleted, true);
  assert.equal((await account.change("overview", capture.id)).deleted, false);
  await testApp.close();
});

test("a saved capture keeps its transcript on the server, and removing it forgets the transcript", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const source = youTubeSource(transcript.video!);
  const capture = savedCapture({ sourceKey: source.id, url: source.url, source });
  await account.inject({ method: "POST", url: "/api/captures", body: capture });

  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  const kept = await account.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });
  await account.inject({ method: "DELETE", url: `/api/captures/${capture.id}` });
  const forgotten = await account.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });

  assert.equal(kept.statusCode, 200);
  assert.equal(forgotten.statusCode, 404);
  await testApp.close();
});

test("a kept link holds no transcript: one sent for it is not kept", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const source = youTubeSource(transcript.video!);
  await account.inject({ method: "POST", url: "/api/captures", body: keptCapture({ sourceKey: source.id, url: source.url }) });

  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  const read = await account.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });

  assert.equal(read.statusCode, 404);
  await testApp.close();
});

test("removing a capture leaves a tombstone, and removing it again is a quiet no-op", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const capture = keptCapture();
  await account.inject({ method: "POST", url: "/api/captures", body: capture });

  const first = await account.inject({ method: "DELETE", url: `/api/captures/${capture.id}` });
  const again = await account.inject({ method: "DELETE", url: `/api/captures/${capture.id}` });

  assert.equal(first.statusCode, 200);
  assert.equal(again.statusCode, 204);
  assert.equal((await account.change("capture", capture.id)).deleted, true);
  await testApp.close();
});

test("a client built before captures is never sent one", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await account.inject({ method: "POST", url: "/api/captures", body: keptCapture() });

  const feed = await account.inject({ method: "GET", url: "/api/changes?since=0", clientVersion: 30 });

  assert.equal(
    feed.json<{ changes: Array<{ kind: string }> }>().changes.some((change) => change.kind === "capture"),
    false,
  );
  await testApp.close();
});

const claim = (account: TestAccount, sourceKey: string, holder: string) =>
  account.inject({ method: "POST", url: `/api/capture-claims/${sourceKey}`, body: { holder } });

test("one device claims a queued source; another is told when the claim runs out, and the first may claim again", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const laptop = await claim(account, "dQw4w9WgXcQ", "laptop-tab-1");
  const phone = await claim(account, "dQw4w9WgXcQ", "phone-tab-1");
  const laptopAgain = await claim(account, "dQw4w9WgXcQ", "laptop-tab-1");

  assert.equal(laptop.statusCode, 200);
  assert.equal(phone.statusCode, 409);
  assert.equal(phone.json().error.code, "claimed_elsewhere");
  assert.equal(phone.json().error.details.until, laptop.json().until);
  assert.equal(laptopAgain.statusCode, 200);
  await testApp.close();
});

test("a claim left by a closed tab runs out, and another device takes it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await claim(account, "dQw4w9WgXcQ", "laptop-tab-1");

  testApp.clock.advance(10 * 60 * 1000);
  const phone = await claim(account, "dQw4w9WgXcQ", "phone-tab-1");

  assert.equal(phone.statusCode, 200);
  await testApp.close();
});

test("a released claim frees the source at once, and only its holder can release it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  await claim(account, "dQw4w9WgXcQ", "laptop-tab-1");

  await account.inject({ method: "DELETE", url: "/api/capture-claims/dQw4w9WgXcQ", body: { holder: "phone-tab-1" } });
  const stillHeld = await claim(account, "dQw4w9WgXcQ", "phone-tab-1");
  await account.inject({ method: "DELETE", url: "/api/capture-claims/dQw4w9WgXcQ", body: { holder: "laptop-tab-1" } });
  const freed = await claim(account, "dQw4w9WgXcQ", "phone-tab-1");

  assert.equal(stillHeld.statusCode, 409);
  assert.equal(freed.statusCode, 200);
  await testApp.close();
});

test("claims are each account's own", async () => {
  const testApp = await createTestApp();
  const first = await makeAccount(testApp);
  const second = await makeAccount(testApp);
  await claim(first, "dQw4w9WgXcQ", "laptop-tab-1");

  const other = await claim(second, "dQw4w9WgXcQ", "phone-tab-1");

  assert.equal(other.statusCode, 200);
  await testApp.close();
});
