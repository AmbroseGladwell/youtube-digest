import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { createTikTokReader, type Spend } from "./createTikTokReader.js";
import { VIDEO_ID, VIDEO_URL } from "./ScrapeCreatorsAnswerFactory.testHelper.js";
import { found, scriptedTikTokVendor, TIKTOK_VIDEO } from "./ScriptedTikTokVendor.testHelper.js";

const NOW = new Date("2026-11-22T10:00:00.000Z");

const recordingSpend = () => {
  const spent: [number, number | null][] = [];
  const spend: Spend = async (credits, vendorStatus) => {
    spent.push([credits, vendorStatus]);
  };
  return { spend, spent };
};

const transcriptFailure = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "no failure";
  } catch (error) {
    assert.ok(error instanceof TranscriptFetchError);
    return error.failure;
  }
};

test("a video link goes to the vendor without its sharer's parameters, and what it cost is spent", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const { spend, spent } = recordingSpend();

  const read = await createTikTokReader({ vendor }).read(`${VIDEO_URL}?is_from_webapp=1&sender_device=pc`, spend);

  assert.deepEqual(read, { status: "read", video: TIKTOK_VIDEO });
  assert.deepEqual(asked, [{ url: VIDEO_URL, withTranscript: false }]);
  assert.deepEqual(spent, [[1, null]]);
});

test("a link with no handle, or an embed's, goes to the vendor as the video's own address", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const reader = createTikTokReader({ vendor });

  await reader.read(`https://www.tiktok.com/embed/v2/${VIDEO_ID}`, recordingSpend().spend);
  await reader.read(`https://m.tiktok.com/v/${VIDEO_ID}.html`, recordingSpend().spend);

  assert.deepEqual(
    asked.map(({ url }) => url),
    [`https://www.tiktok.com/@/video/${VIDEO_ID}`, `https://www.tiktok.com/@/video/${VIDEO_ID}`],
  );
});

test("a short link goes to the vendor as it came, for it to follow", async () => {
  const { vendor, asked } = scriptedTikTokVendor();

  await createTikTokReader({ vendor }).read("https://vm.tiktok.com/ZMhAbCdEf/", recordingSpend().spend);

  assert.deepEqual(asked, [{ url: "https://vm.tiktok.com/ZMhAbCdEf/", withTranscript: false }]);
});

test("a link that isn't a TikTok video is refused without asking the vendor or spending anything", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const { spend, spent } = recordingSpend();
  const reader = createTikTokReader({ vendor });

  assert.deepEqual(await reader.read("https://www.tiktok.com/@anewsroom", spend), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(await reader.read("https://example.com/video", spend), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(asked, []);
  assert.deepEqual(spent, []);
});

test("the vendor's failure is the read's, and its status goes with what it cost", async () => {
  const { vendor } = scriptedTikTokVendor({ status: "failed", reason: "unavailable", credits: 0, vendorStatus: 404 });
  const { spend, spent } = recordingSpend();

  assert.deepEqual(await createTikTokReader({ vendor }).read(VIDEO_URL, spend), { status: "failed", reason: "unavailable" });
  assert.deepEqual(spent, [[0, 404]]);
});

test("a video's words are its captions, keyed as a TikTok and marked machine-heard", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const { spend, spent } = recordingSpend();

  const { transcript, source } = await createTikTokReader({ vendor, clock: () => NOW }).transcript(VIDEO_URL, spend);

  assert.deepEqual(asked, [{ url: VIDEO_URL, withTranscript: true }]);
  assert.deepEqual(spent, [[1, null]]);
  assert.equal(source, "ASR");
  assert.equal(transcript.videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(transcript.generated, true);
  assert.equal(transcript.fetchedAt, NOW.toISOString());
  assert.match(transcript.segments.map(({ text }) => text).join(" "), /^There is now a real chance that the talks end/);
});

test("captions a creator wrote are not marked machine-heard", async () => {
  const { vendor } = scriptedTikTokVendor(found({ ...TIKTOK_VIDEO, captions: [{ language: "en", source: "creator" }] }));

  const { transcript } = await createTikTokReader({ vendor }).transcript(VIDEO_URL, recordingSpend().spend);

  assert.equal(transcript.generated, false);
});

test("a video without captions, or with empty ones, has no transcript to give", async () => {
  const bare = scriptedTikTokVendor(found(TIKTOK_VIDEO, null)).vendor;
  const empty = scriptedTikTokVendor(found(TIKTOK_VIDEO, "WEBVTT\n\n")).vendor;

  assert.equal(
    await transcriptFailure(createTikTokReader({ vendor: bare }).transcript(VIDEO_URL, recordingSpend().spend)),
    TranscriptFetchFailure.NO_CAPTIONS,
  );
  assert.equal(
    await transcriptFailure(createTikTokReader({ vendor: empty }).transcript(VIDEO_URL, recordingSpend().spend)),
    TranscriptFetchFailure.NO_CAPTIONS,
  );
});

test("a transcript the vendor can't give says why in transcript terms", async () => {
  const failing = (reason: "blocked" | "unavailable" | "no-answer") =>
    createTikTokReader({ vendor: scriptedTikTokVendor({ status: "failed", reason, credits: 0, vendorStatus: 500 }).vendor }).transcript(
      VIDEO_URL,
      recordingSpend().spend,
    );

  assert.equal(await transcriptFailure(failing("blocked")), TranscriptFetchFailure.SOURCE_BLOCKED);
  assert.equal(await transcriptFailure(failing("unavailable")), TranscriptFetchFailure.VIDEO_UNAVAILABLE);
  assert.equal(await transcriptFailure(failing("no-answer")), TranscriptFetchFailure.SOURCE_UNAVAILABLE);
});
