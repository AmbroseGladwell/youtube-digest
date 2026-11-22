import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { VideoId, youTubeSource, type TranscriptSegment } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { keywordTermsOf, TranscriptPassagesRepository } from "./TranscriptPassagesRepository.js";

const minute = (index: number, text: string): TranscriptSegment => ({ text, startMs: index * 60_000, endMs: index * 60_000 + 50_000 });

const setUp = async (t: TestContext): Promise<{ testApp: TestApp; account: TestAccount; repository: TranscriptPassagesRepository }> => {
  const testApp = await createTestApp();
  t.after(() => testApp.close());
  return { testApp, account: await makeAccount(testApp), repository: new TranscriptPassagesRepository(testApp.sql) };
};

const kept = async (account: TestAccount, segments: TranscriptSegment[]): Promise<{ overviewId: string; videoId: string }> => {
  const transcript = makeStoredTranscript({ videoId: VideoId.parse(randomUUID().slice(0, 11)), segments });
  const overview = storedOverview({ source: youTubeSource(transcript.video!) });
  assert.equal((await account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  assert.equal((await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript })).statusCode, 204);
  return { overviewId: overview.id, videoId: transcript.videoId };
};

const sleepTalk = [
  minute(0, "Welcome to the show, today we talk about sleep and recovery."),
  minute(1, "Sleep matters for recovery, and recovery matters for sleep."),
  minute(2, "Take 300 milligrams of ashwagandha an hour before bed."),
  minute(3, "Then dim the lights and keep the room cool for sleep."),
  minute(4, "That's all on sleep for today."),
];

test("a kept transcript is searchable at once, the rare word finds its minute, and each hit carries the minute either side", async (t) => {
  const { account, repository } = await setUp(t);
  const { videoId } = await kept(account, sleepTalk);

  const [best, ...rest] = await repository.search(account.accountId, "How much ashwagandha for sleep?", { limit: 3 });

  assert.equal(best?.videoId, videoId);
  assert.equal(best?.passage.id, "p3");
  assert.equal(best?.passage.startMs, 120_000);
  assert.deepEqual(
    best?.around.map((passage) => passage.id),
    ["p2", "p3", "p4"],
  );
  assert.ok(rest.every((hit) => hit.score < best!.score));
});

test("a search keeps to the transcripts it's given, never the ones it's told to leave out, and finds nothing for words no one said", async (t) => {
  const { account, repository } = await setUp(t);
  const first = await kept(account, sleepTalk);
  const second = await kept(account, [minute(0, "Ashwagandha is an adaptogen from India.")]);

  assert.deepEqual(
    (await repository.search(account.accountId, "ashwagandha", { limit: 5, except: [first.videoId] })).map((hit) => hit.videoId),
    [second.videoId],
  );
  assert.deepEqual(
    [
      ...new Set(
        (await repository.search(account.accountId, "ashwagandha", { limit: 5, within: [first.videoId] })).map((hit) => hit.videoId),
      ),
    ],
    [first.videoId],
  );
  assert.deepEqual(await repository.search(account.accountId, "quantum chromodynamics", { limit: 5 }), []);
  assert.deepEqual(await repository.search(account.accountId, "what is the", { limit: 5 }), []);
});

test("a transcript kept again is indexed again, and its index goes with the overview's transcript", async (t) => {
  const { testApp, account, repository } = await setUp(t);
  const { overviewId, videoId } = await kept(account, sleepTalk);
  const replaced = makeStoredTranscript({ videoId: VideoId.parse(videoId), segments: [minute(0, "Magnesium glycinate before bed.")] });
  await account.inject({ method: "PUT", url: `/api/transcripts/${videoId}`, body: replaced });

  assert.deepEqual(await repository.search(account.accountId, "ashwagandha", { limit: 5 }), []);
  assert.equal((await repository.search(account.accountId, "magnesium", { limit: 5 }))[0]?.videoId, videoId);

  assert.ok((await account.inject({ method: "DELETE", url: `/api/overviews/${overviewId}` })).statusCode < 300);
  const left = await testApp.sql.query("select 1 from transcript_passages where account_id = $1", [account.accountId]);
  assert.equal(left.length, 0);
});

test("a transcript kept before the index existed is indexed on the first search", async (t) => {
  const { testApp, account, repository } = await setUp(t);
  const { videoId } = await kept(account, sleepTalk);
  await testApp.sql.query("delete from transcript_passages where account_id = $1", [account.accountId]);

  assert.equal(await repository.backfill(account.accountId), 1);
  assert.equal((await repository.search(account.accountId, "ashwagandha", { limit: 1 }))[0]?.videoId, videoId);
  assert.equal(await repository.backfill(account.accountId), 0);
});

test("a question's search words leave out the words every question has", () => {
  assert.deepEqual(keywordTermsOf("What does the video say about Ashwagandha's dose?"), ["ashwagandha", "dose"]);
});
