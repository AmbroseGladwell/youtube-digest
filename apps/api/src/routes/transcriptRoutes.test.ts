import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER, VideoId, type StoredTranscript, youTubeSource } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { letInOverview, makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

const LONG_TRANSCRIPT_SEGMENTS = 20_000;

const noteOn = (account: TestAccount, transcript: StoredTranscript) =>
  account.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ source: youTubeSource(transcript.video!) }) });

test("a transcript one device stores is read back exactly by another device on the same account", async () => {
  const testApp = await createTestApp();
  const email = "two-devices@example.com";
  const laptop = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const phone = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const transcript = makeStoredTranscript();
  const overview = storedOverview({ source: youTubeSource(transcript.video!) });
  await letInOverview(testApp, laptop.accountId, overview);
  await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: laptop.headers,
    payload: overview,
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

test("storing a video's transcript again replaces the one the account kept before", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const first = makeStoredTranscript({ fetchedAt: "2026-09-01T00:00:00.000Z" });
  const second = makeStoredTranscript({ fetchedAt: "2026-09-20T00:00:00.000Z", generated: true });
  await noteOn(account, first);
  await account.inject({ method: "PUT", url: `/api/transcripts/${first.videoId}`, body: first });
  await account.inject({ method: "PUT", url: `/api/transcripts/${second.videoId}`, body: second });

  const response = await account.inject({ method: "GET", url: `/api/transcripts/${first.videoId}` });

  assert.deepEqual(response.json(), second);
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
  assert.equal((await account.inject({ method: "GET", url: "/api/transcripts/another-video" })).json().error.code, "not_found");
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
  const note = storedOverview({ source: youTubeSource(transcript.video!) });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });

  await account.inject({ method: "DELETE", url: `/api/overviews/${note.id}`, ifMatch: 1 });

  assert.equal(await keptTranscriptOf(account, transcript.videoId), 404);
  await testApp.close();
});

test("deleting a note on one account leaves another account's transcript of the same video", async () => {
  const testApp = await createTestApp();
  const [deleter, keeper] = [await makeAccount(testApp), await makeAccount(testApp)];
  const transcript = makeStoredTranscript();
  const note = storedOverview({ source: youTubeSource(transcript.video!) });
  for (const account of [deleter, keeper]) {
    await account.inject({
      method: "POST",
      url: "/api/overviews",
      body: storedOverview({ id: note.id, source: youTubeSource(transcript.video!) }),
    });
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
  const note = storedOverview({ source: youTubeSource(transcript.video!) });
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
  const note = storedOverview({ source: youTubeSource(transcript.video!) });
  await account.inject({ method: "POST", url: "/api/overviews", body: note });
  await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript });
  await testApp.sql.query("update records set deleted = true, body = null where account_id = $1 and kind = 'overview' and id = $2", [
    account.accountId,
    note.id,
  ]);

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

const saying = (text: string, overrides: Partial<StoredTranscript> = {}) =>
  makeStoredTranscript({ segments: [{ text, startMs: 0, endMs: 1000 }], ...overrides });

test("a transcript one account keeps is never read by another account, nor by anyone without one", async () => {
  const testApp = await createTestApp();
  const [only, other] = [await makeAccount(testApp), await makeAccount(testApp)];
  const transcript = makeStoredTranscript();
  await contribute(only, transcript);

  assert.equal((await readShared(testApp, transcript.videoId)).json().error.code, "not_found");
  assert.equal((await other.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` })).statusCode, 404);
  assert.deepEqual((await only.inject({ method: "GET", url: `/api/transcripts/${transcript.videoId}` })).json(), transcript);
  await testApp.close();
});

test("two accounts that fetched the same video each read back their own copy, and nothing is kept for everyone", async () => {
  const testApp = await createTestApp();
  const [first, second] = [await makeAccount(testApp), await makeAccount(testApp)];
  const mine = saying("As first heard.", { fetchedAt: "2026-09-01T00:00:00.000Z" });
  const theirs = saying("As second heard.", { fetchedAt: "2026-09-20T00:00:00.000Z" });
  await contribute(first, mine);
  await contribute(second, theirs);

  assert.deepEqual((await first.inject({ method: "GET", url: `/api/transcripts/${mine.videoId}` })).json(), mine);
  assert.deepEqual((await second.inject({ method: "GET", url: `/api/transcripts/${theirs.videoId}` })).json(), theirs);
  assert.equal((await readShared(testApp, mine.videoId)).statusCode, 404);
  await testApp.close();
});

test("a transcript with no segments is answered as done and kept nowhere", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const empty = makeStoredTranscript({ segments: [] });

  const stored = await contribute(account, empty);

  assert.equal(stored.statusCode, 204);
  assert.equal(await keptTranscriptOf(account, empty.videoId), 404);
  await testApp.close();
});

test("a transcript whose times run backwards is kept nowhere", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const backwards = makeStoredTranscript({
    segments: [
      { text: "Second thing said.", startMs: 5000, endMs: 6000 },
      { text: "First thing said.", startMs: 0, endMs: 1000 },
    ],
  });

  assert.equal((await contribute(account, backwards)).statusCode, 204);
  assert.equal(await keptTranscriptOf(account, backwards.videoId), 404);
  await testApp.close();
});

test("an episode's transcript is kept as the account's own copy, for its other devices", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const id = VideoId.parse("0123456789abcdef0123456789abcdef");
  const key = VideoId.parse(`podcast:${id}`);
  const { video: _video, ...transcript } = makeStoredTranscript({ videoId: key });
  const source = {
    kind: "podcast" as const,
    id,
    feedUrl: "https://feeds.example/show.xml",
    guid: "episode-guid",
    title: "An episode",
    showName: "A Show",
    publishedAt: null,
    durationMs: 3_600_000,
    audioUrl: "https://media.example/episode.mp3",
    pageUrl: null,
    imageUrl: null,
    sharedFrom: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
  };
  assert.equal((await account.inject({ method: "POST", url: "/api/overviews", body: storedOverview({ source }) })).statusCode, 201);

  const response = await account.inject({ method: "PUT", url: `/api/transcripts/${encodeURIComponent(key)}`, body: transcript });

  assert.equal(response.statusCode, 204);
  assert.deepEqual((await account.inject({ method: "GET", url: `/api/transcripts/${encodeURIComponent(key)}` })).json(), transcript);
  await testApp.close();
});
