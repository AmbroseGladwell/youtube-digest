import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TranscriptSearchResponse, VideoId, youTubeSource, type TranscriptSegment } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp, type TestApp } from "../testing/createTestApp.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";

const at = (seconds: number, text: string): TranscriptSegment => ({ text, startMs: seconds * 1000, endMs: seconds * 1000 + 4000 });

const sleepTalk = [
  at(0, "Welcome to the show."),
  at(5, "Today we talk about sleep and recovery."),
  at(70, "Take 300 milligrams of ashwagandha an hour before bed."),
  at(130, "Then dim the lights and keep the room cool."),
  at(200, "Lights out, and dim screens too."),
];

const setUp = async (t: TestContext, logger?: ReturnType<typeof recordingLogger>["logger"]): Promise<TestApp> => {
  const testApp = await createTestApp({}, logger === undefined ? {} : { logger });
  t.after(() => testApp.close());
  return testApp;
};

const kept = async (account: TestAccount, segments: TranscriptSegment[], videoId = randomUUID().slice(0, 11)) => {
  const transcript = makeStoredTranscript({ videoId: VideoId.parse(videoId), segments });
  const overview = storedOverview({ source: youTubeSource(transcript.video!) });
  assert.equal((await account.inject({ method: "POST", url: "/api/overviews", body: overview })).statusCode, 201);
  assert.equal((await account.inject({ method: "PUT", url: `/api/transcripts/${transcript.videoId}`, body: transcript })).statusCode, 204);
  return { overviewId: overview.id, videoId: transcript.videoId };
};

const search = async (account: TestAccount, query: string): Promise<TranscriptSearchResponse> => {
  const response = await account.inject({ method: "GET", url: `/api/search/transcripts?query=${encodeURIComponent(query)}` });
  assert.equal(response.statusCode, 200, response.body);
  return TranscriptSearchResponse.parse(response.json());
};

const ids = (response: TranscriptSearchResponse) => response.matches.map((match) => match.overviewId);

test("a word only the transcript holds finds its overview, with the sentence it was said in, its moment and the word marked", async (t) => {
  const reader = await makeAccount(await setUp(t));
  const { overviewId } = await kept(reader, sleepTalk);

  const [match, ...rest] = (await search(reader, "Ashwagandha")).matches;

  assert.deepEqual(rest, []);
  assert.equal(match?.overviewId, overviewId);
  assert.equal(match?.mentions, 1);
  const [moment] = match!.moments;
  assert.equal(moment?.startMs, 70_000);
  assert.equal(moment?.text, "Take 300 milligrams of ashwagandha an hour before bed.");
  assert.deepEqual(
    moment?.marks.map(({ start, end }) => moment.text.slice(start, end)),
    ["ashwagandha"],
  );
});

test("a quoted phrase matches only those words in that order, and plain words must all be said within one minute", async (t) => {
  const reader = await makeAccount(await setUp(t));
  await kept(reader, sleepTalk);

  assert.equal((await search(reader, '"dim the lights"')).matches[0]?.moments[0]?.startMs, 130_000);
  assert.deepEqual(ids(await search(reader, '"lights dim"')), []);
  assert.equal(ids(await search(reader, "lights dim")).length, 1);
  assert.deepEqual(ids(await search(reader, "ashwagandha recovery")), []);
});

test("the sources that say it most come first, each with its best few moments", async (t) => {
  const reader = await makeAccount(await setUp(t));
  const once = await kept(reader, [at(0, "Creatine came up once.")]);
  const often = await kept(
    reader,
    Array.from({ length: 5 }, (_, minute) => at(minute * 60, `Creatine again, minute ${minute}.`)),
  );

  const { matches } = await search(reader, "creatine");

  assert.deepEqual(
    matches.map((match) => [match.overviewId, match.mentions, match.moments.length]),
    [
      [often.overviewId, 5, 3],
      [once.overviewId, 1, 1],
    ],
  );
});

test("a search never reaches another reader's transcripts, even of the same video", async (t) => {
  const testApp = await setUp(t);
  const [other, reader] = [await makeAccount(testApp), await makeAccount(testApp)];
  const { videoId } = await kept(other, sleepTalk);
  await reader.inject({
    method: "POST",
    url: "/api/overviews",
    body: storedOverview({ source: youTubeSource(makeStoredTranscript({ videoId: VideoId.parse(videoId) }).video!) }),
  });

  assert.deepEqual(ids(await search(reader, "ashwagandha")), []);
  assert.equal(ids(await search(other, "ashwagandha")).length, 1);
});

test("a deleted overview's transcript is never found", async (t) => {
  const reader = await makeAccount(await setUp(t));
  const { overviewId } = await kept(reader, sleepTalk);
  assert.equal((await reader.inject({ method: "DELETE", url: `/api/overviews/${overviewId}` })).statusCode, 200);

  assert.deepEqual(ids(await search(reader, "ashwagandha")), []);
});

test("a search of only common words finds nothing, and an empty one is refused", async (t) => {
  const reader = await makeAccount(await setUp(t));
  await kept(reader, sleepTalk);

  assert.deepEqual(ids(await search(reader, "the and of")), []);
  assert.equal((await reader.inject({ method: "GET", url: "/api/search/transcripts?query=%20" })).statusCode, 400);
});

test("a search is logged by how many matched, never by its words", async (t) => {
  const { lines, logger } = recordingLogger();
  const reader = await makeAccount(await setUp(t, logger));
  await kept(reader, sleepTalk);

  await search(reader, "ashwagandha");

  const searched = lines.filter((line) => line.msg === "transcripts searched");
  assert.deepEqual(
    searched.map((line) => [line.source, line.matches]),
    [["app", 1]],
  );
  assert.doesNotMatch(JSON.stringify(searched), /ashwagandha/);
});
