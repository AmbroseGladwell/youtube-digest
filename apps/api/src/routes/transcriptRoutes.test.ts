import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER, VideoId, type StoredTranscript } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const LONG_TRANSCRIPT_SEGMENTS = 20_000;

const noteOn = (account: TestAccount, transcript: StoredTranscript) =>
  account.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ video: transcript.video! }) });

test("a transcript one device stores is read back exactly by another device on the same account", async () => {
  const testApp = await createTestApp();
  const email = "two-devices@example.com";
  const laptop = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const phone = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const transcript = makeStoredTranscript();
  await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: laptop.headers,
    payload: storedOverview({ video: transcript.video! }),
  });

  const stored = await testApp.app.inject({
    method: "PUT",
    url: `/api/transcripts/${transcript.videoId}`,
    headers: laptop.headers,
    payload: transcript,
  });
  const read = await testApp.app.inject({
    method: "GET",
    url: `/api/transcripts/${transcript.videoId}`,
    headers: phone.headers,
  });

  assert.equal(stored.statusCode, 204);
  assert.equal(read.statusCode, 200);
  assert.deepEqual(read.json(), transcript);
  await testApp.close();
});

test("a transcript no device has stored is not found", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "GET", url: "/api/transcripts/never-stored" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  await testApp.close();
});

test("another account cannot read a transcript it did not store", async () => {
  const testApp = await createTestApp();
  const owner = await makeAccount(testApp);
  const stranger = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  await owner.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  const response = await stranger.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });

  assert.equal(response.json().error.code, "not_found");
  await testApp.close();
});

test("storing a video's transcript again keeps the first copy when the second is no better", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const first = makeStoredTranscript({ fetchedAt: "2026-09-01T00:00:00.000Z" });
  const second = makeStoredTranscript({ fetchedAt: "2026-09-20T00:00:00.000Z", generated: true });
  await noteOn(account, first);
  await account.inject({ method: "PUT", url: `/api/transcripts/${first.videoId}`, body: first });
  await account.inject({ method: "PUT", url: `/api/transcripts/${second.videoId}`, body: second });

  const response = await account.inject({ method: "GET", url: `/api/transcripts/${first.videoId}` });

  assert.deepEqual(response.json(), first);
  await testApp.close();
});

test("a transcript written by a person replaces a machine-heard one kept before", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const machineHeard = makeStoredTranscript({ generated: true });
  const written = makeStoredTranscript({ generated: false, fetchedAt: "2026-09-20T00:00:00.000Z" });
  await noteOn(account, machineHeard);
  await account.inject({ method: "PUT", url: `/api/transcripts/${machineHeard.videoId}`, body: machineHeard });
  await account.inject({ method: "PUT", url: `/api/transcripts/${written.videoId}`, body: written });

  const response = await account.inject({ method: "GET", url: `/api/transcripts/${written.videoId}` });

  assert.deepEqual(response.json(), written);
  await testApp.close();
});

test("a transcript far longer than the default body limit is still stored", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript({
    segments: Array.from({ length: LONG_TRANSCRIPT_SEGMENTS }, (_, index) => ({
      text: "A sentence of ordinary length spoken somewhere in a very long video.",
      startMs: index * 1000,
      endMs: index * 1000 + 1000,
    })),
  });
  await noteOn(account, transcript);

  const stored = await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  const read = await account.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` });

  assert.equal(stored.statusCode, 204);
  assert.equal(read.json().segments.length, LONG_TRANSCRIPT_SEGMENTS);
  await testApp.close();
});

test("a transcript filed under a different video than the path names is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript({ videoId: VideoId.parse("the-real-video") });

  const response = await account.inject({ method: "PUT", url: "/api/transcripts/another-video", body: transcript });

  assert.equal(response.json().error.code, "invalid_request");
  assert.equal(
    (await account.inject({ method: "GET", url: "/api/transcripts/another-video" })).json().error.code,
    "not_found",
  );
  await testApp.close();
});

test("a body that is not a transcript is refused", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const { segments: _segments, ...withoutSegments } = makeStoredTranscript();

  const response = await account.inject({
    method: "PUT",
    url: `/api/transcripts/${withoutSegments.videoId}`,
    body: withoutSegments,
  });

  assert.equal(response.json().error.code, "invalid_request");
  await testApp.close();
});

test("a client below the write floor cannot store a transcript", async () => {
  const testApp = await createTestApp({ minSupportedClientVersion: 2 });
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();

  const response = await account.inject({
    method: "PUT",
    url: `/api/transcripts/${transcript.videoId}`,
    body: transcript,
    clientVersion: 1,
  });

  assert.equal(response.json().error.code, "client_unsupported");
  await testApp.close();
});

test("transcripts are refused without a session", async () => {
  const testApp = await createTestApp();
  const transcript = makeStoredTranscript();

  const response = await testApp.app.inject({
    method: "PUT",
    url: `/api/transcripts/${transcript.videoId}`,
    headers: { [CLIENT_VERSION_HEADER]: "1" },
    payload: transcript,
  });

  assert.equal(response.json().error.code, "unauthenticated");
  await testApp.close();
});

const keptTranscriptOf = async (account: TestAccount, videoId: string) =>
  (await account.inject({ method: "GET", url: `/api/transcripts/${videoId}` })).statusCode;

test("deleting the last note on a video forgets the account's transcript of it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const note = storedOverview({ video: transcript.video! });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}`, ifMatch: 1 });

  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  await testApp.close();
});

test("deleting one of two notes on a video keeps the transcript the other still uses", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const [first, second] = [storedOverview({ video: transcript.video! }), storedOverview({ video: transcript.video! })];
  await account.inject({ method: "POST", url: "/api/overviews", body: first });
  await account.inject({ method: "POST", url: "/api/overviews", body: second });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  await account.inject({ method: "DELETE", url: `/api/overviews/${first.id}`, ifMatch: 1 });

  assert.equal(await keptTranscriptOf(account, transcript.videoId), 200);
  await testApp.close();
});

test("deleting a note on one account leaves another account's transcript of the same video", async () => {
  const testApp = await createTestApp();
  const [deleter, keeper] = [await makeAccount(testApp), await makeAccount(testApp)];
  const transcript = makeStoredTranscript();
  const note = storedOverview({ video: transcript.video! });
  for (const account of [deleter, keeper]) {
    await account.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ id: note.id, video: transcript.video! }) });
    await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  }

  await deleter.inject({ method: "DELETE", url: `/api/overviews/${note.id}`, ifMatch: 1 });

  assert.equal(await keptTranscriptOf(deleter, transcript.videoId), 404);
  assert.equal(await keptTranscriptOf(keeper, transcript.videoId), 200);
  await testApp.close();
});

test("a transcript for a video no live note on the account uses is answered as done and not kept", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();

  const stored = await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  assert.equal(stored.statusCode, 204);
  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  await testApp.close();
});

test("an upload that arrives after its note was deleted elsewhere is not kept", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const note = storedOverview({ video: transcript.video! });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}`, ifMatch: 1 });

  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  await testApp.close();
});

test("a delete retried after its first attempt left the transcript behind still forgets it", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const note = storedOverview({ video: transcript.video! });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  await testApp.sql.query(
    "update records set deleted = true, body = null where account_id = $1 and kind = 'overview' and id = $2",
    [account.accountId, note.id],
  );

  const retried = await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}` });

  assert.equal(retried.statusCode, 204);
  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  await testApp.close();
});

const readShared = (testApp: TestApp, videoId: string, remoteAddress = "198.51.100.7") =>
  testApp.app.inject({
    method: "GET",
    url: `/api/shared-transcripts/${videoId}`,
    remoteAddress,
    headers: { [CLIENT_VERSION_HEADER]: "1" },
  });

const contribute = async (account: TestAccount, transcript: StoredTranscript) => {
  await noteOn(account, transcript);
  return account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
};

test("a transcript one account stores is read from the shared cache by anyone, signed in or not", async () => {
  const testApp = await createTestApp();
  const contributor = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  await contribute(contributor, transcript);

  const response = await readShared(testApp, transcript.videoId);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), transcript);
  await testApp.close();
});

test("a video nobody has stored a transcript of is not in the shared cache", async () => {
  const testApp = await createTestApp();

  const response = await readShared(testApp, "never-stored");

  assert.equal(response.json().error.code, "not_found");
  await testApp.close();
});

test("the shared copy keeps only the video's own address, not the url a reader pasted", async () => {
  const testApp = await createTestApp();
  const contributor = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const pasted = { ...transcript, video: { ...transcript.video!, url: `https://youtu.be/${transcript.videoId}?si=tracker` } };
  await contribute(contributor, pasted);

  const response = await readShared(testApp, transcript.videoId);

  assert.equal(response.json().video.url, `https://www.youtube.com/watch?v=${transcript.videoId}`);
  await testApp.close();
});

test("a second account storing a cached video keeps the first copy and gets it back as its own", async () => {
  const testApp = await createTestApp();
  const [first, second] = [await makeAccount(testApp), await makeAccount(testApp)];
  const original = makeStoredTranscript({ fetchedAt: "2026-09-01T00:00:00.000Z" });
  const later = makeStoredTranscript({ fetchedAt: "2026-09-20T00:00:00.000Z" });
  await contribute(first, original);
  await contribute(second, later);

  assert.deepEqual((await readShared(testApp, original.videoId)).json(), original);
  assert.deepEqual((await second.inject({ method: "GET", url: `/api/transcripts/${original.videoId}` })).json(), original);
  await testApp.close();
});

test("a machine-heard transcript never replaces one written by a person in the shared cache", async () => {
  const testApp = await createTestApp();
  const [first, second] = [await makeAccount(testApp), await makeAccount(testApp)];
  const written = makeStoredTranscript({ generated: false });
  await contribute(first, written);
  await contribute(second, makeStoredTranscript({ generated: true }));

  assert.equal((await readShared(testApp, written.videoId)).json().generated, false);
  await testApp.close();
});

test("a transcript with no segments is answered as done and kept nowhere", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const empty = makeStoredTranscript({ segments: [] });

  const stored = await contribute(account, empty);

  assert.equal(stored.statusCode, 204);
  assert.equal((await readShared(testApp, empty.videoId)).statusCode, 404);
  assert.equal(await keptTranscriptOf(account, empty.videoId), 404);
  await testApp.close();
});

test("a transcript whose times run backwards is kept out of the shared cache", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const backwards = makeStoredTranscript({
    segments: [
      { text: "Second thing said.", startMs: 5000, endMs: 6000 },
      { text: "First thing said.", startMs: 0, endMs: 1000 },
    ],
  });

  await contribute(account, backwards);

  assert.equal((await readShared(testApp, backwards.videoId)).statusCode, 404);
  await testApp.close();
});

test("a transcript for a video no live note uses is not added to the shared cache", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();

  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  assert.equal((await readShared(testApp, transcript.videoId)).statusCode, 404);
  await testApp.close();
});

test("deleting the last note on a video leaves its transcript in the shared cache", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const transcript = makeStoredTranscript();
  const note = storedOverview({ video: transcript.video! });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}`, ifMatch: 1 });

  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  assert.equal((await readShared(testApp, transcript.videoId)).statusCode, 200);
  await testApp.close();
});

test("reading the shared cache is limited per address", async () => {
  const testApp = await createTestApp();
  for (let read = 0; read < rateLimits.sharedTranscriptPerAddress.limit; read++) {
    await readShared(testApp, "some-video", "203.0.113.9");
  }

  assert.equal((await readShared(testApp, "some-video", "203.0.113.9")).json().error.code, "too_many_requests");
  assert.equal((await readShared(testApp, "some-video", "203.0.113.10")).json().error.code, "not_found");
  await testApp.close();
});

test("forgetting a shared transcript takes it from the cache and from every account linked to it", async () => {
  const testApp = await createTestApp();
  const [first, second] = [await makeAccount(testApp), await makeAccount(testApp)];
  const transcript = makeStoredTranscript();
  await contribute(first, transcript);
  await contribute(second, transcript);
  const transcripts = new TranscriptsRepository(testApp.sql, () => testApp.clock.now);

  await transcripts.forgetShared(transcript.videoId);

  assert.equal((await readShared(testApp, transcript.videoId)).statusCode, 404);
  assert.equal(await keptTranscriptOf(second, transcript.videoId), 404);
  await testApp.close();
});

test("forgetting an account's contributions takes every transcript it added and nothing else", async () => {
  const testApp = await createTestApp();
  const [poisoner, honest] = [await makeAccount(testApp), await makeAccount(testApp)];
  const [bad, worse, fine] = ["bad-one", "worse-one", "fine-one"].map((id) =>
    makeStoredTranscript({ videoId: VideoId.parse(id), video: { ...makeStoredTranscript().video!, id: VideoId.parse(id) } }),
  );
  await contribute(poisoner, bad!);
  await contribute(poisoner, worse!);
  await contribute(honest, fine!);
  const transcripts = new TranscriptsRepository(testApp.sql, () => testApp.clock.now);

  const forgotten = await transcripts.forgetContributionsOf((await transcripts.contributorOf(bad!.videoId))!);

  assert.equal(forgotten, 2);
  assert.equal((await readShared(testApp, worse!.videoId)).statusCode, 404);
  assert.equal((await readShared(testApp, fine!.videoId)).statusCode, 200);
  await testApp.close();
});
