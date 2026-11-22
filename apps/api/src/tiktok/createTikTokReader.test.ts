import test from "node:test";
import assert from "node:assert/strict";
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

test("a video link goes to the vendor without its sharer's parameters, and what it cost is spent", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const { spend, spent } = recordingSpend();

  const read = await createTikTokReader({ vendor }).read(`${VIDEO_URL}?is_from_webapp=1&sender_device=pc`, spend);

  assert.equal(read.status === "read" && read.video, TIKTOK_VIDEO);
  assert.deepEqual(asked, [{ url: VIDEO_URL, withTranscript: true }]);
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

  assert.deepEqual(asked, [{ url: "https://vm.tiktok.com/ZMhAbCdEf/", withTranscript: true }]);
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

const readOf = async (reader: ReturnType<typeof createTikTokReader>) => {
  const read = await reader.read(VIDEO_URL, recordingSpend().spend);
  assert.equal(read.status, "read");
  return read;
};

test("the words come in the same call, for the same credit: its captions, keyed as a TikTok and marked machine-heard", async () => {
  const { vendor, asked } = scriptedTikTokVendor();
  const { spend, spent } = recordingSpend();

  const read = await createTikTokReader({ vendor, clock: () => NOW }).read(VIDEO_URL, spend);

  assert.equal(read.status, "read");
  assert.deepEqual(asked, [{ url: VIDEO_URL, withTranscript: true }]);
  assert.deepEqual(spent, [[1, null]]);
  const { transcript } = read;
  assert.equal(transcript?.videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(transcript?.generated, true);
  assert.equal(transcript?.fetchedAt, NOW.toISOString());
  assert.match(transcript?.segments.map(({ text }) => text).join(" ") ?? "", /^There is now a real chance that the talks end/);
});

test("captions a creator wrote are not marked machine-heard", async () => {
  const { vendor } = scriptedTikTokVendor(found({ ...TIKTOK_VIDEO, captions: [{ language: "en", source: "creator" }] }));

  const read = await readOf(createTikTokReader({ vendor }));

  assert.equal(read.status === "read" && read.transcript?.generated, false);
});

test("a video without captions, or with empty ones, is still read, with no words", async () => {
  for (const vtt of [null, "WEBVTT\n\n"]) {
    const read = await readOf(createTikTokReader({ vendor: scriptedTikTokVendor(found(TIKTOK_VIDEO, vtt)).vendor }));
    assert.deepEqual(read, { status: "read", video: TIKTOK_VIDEO, transcript: null });
  }
});
