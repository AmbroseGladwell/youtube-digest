import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION_HEADER, VideoId } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { makeSession } from "../auth/SessionFactory.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const LONG_TRANSCRIPT_SEGMENTS = 20_000;

test("a transcript one device stores is read back exactly by another device on the same account", async () => {
  const testApp = await createTestApp();
  const email = "two-devices@example.com";
  const laptop = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const phone = await makeSession(testApp.sql, { email, now: testApp.clock.now });
  const transcript = makeStoredTranscript();

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

test("storing a video's transcript again replaces the one kept before", async () => {
  const testApp = await createTestApp();
  const account = await makeAccount(testApp);
  const first = makeStoredTranscript({ fetchedAt: "2026-09-01T00:00:00.000Z" });
  const second = makeStoredTranscript({ fetchedAt: "2026-09-20T00:00:00.000Z", generated: true });
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
