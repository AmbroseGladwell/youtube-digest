import test from "node:test";
import assert from "node:assert/strict";
import { createScrapeCreatorsTikTok } from "./createScrapeCreatorsTikTok.js";
import { CAPTIONS_VTT, makeAwemeDetail, makeVendorAnswer, VIDEO_ID, VIDEO_URL } from "./ScrapeCreatorsAnswerFactory.testHelper.js";

const vendorAnswering = (status: number, body: unknown) => {
  const asked: { url: URL; key: string | null }[] = [];
  const fetch = (async (input: URL, init?: RequestInit) => {
    asked.push({ url: input, key: new Headers(init?.headers).get("x-api-key") });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { vendor: createScrapeCreatorsTikTok({ apiKey: "test-key", fetch }), asked };
};

test("a video comes back with its author, length, cover, date and caption tracks, for one credit", async () => {
  const { vendor, asked } = vendorAnswering(200, makeVendorAnswer());

  const answer = await vendor.video(VIDEO_URL, { withTranscript: false });

  assert.deepEqual(answer, {
    status: "found",
    video: {
      id: VIDEO_ID,
      url: VIDEO_URL,
      handle: "anewsroom",
      authorName: "A Newsroom",
      description: "Three things to know about the summit #news",
      durationSeconds: 80,
      coverUrl: "https://covers.tiktok.example/cover.jpeg",
      postedAt: "2026-11-21T23:29:40.000Z",
      captions: [{ language: "eng-US", source: "ASR" }],
    },
    vtt: null,
    credits: 1,
  });
  assert.equal(asked[0]?.key, "test-key");
  assert.equal(asked[0]?.url.pathname, "/v2/tiktok/video");
  assert.equal(asked[0]?.url.searchParams.get("url"), VIDEO_URL);
  assert.equal(asked[0]?.url.searchParams.get("get_transcript"), null);
});

test("asked for the words, it asks for TikTok's own captions and hands back their WebVTT", async () => {
  const { vendor, asked } = vendorAnswering(200, makeVendorAnswer({ transcript: CAPTIONS_VTT }));

  const answer = await vendor.video(VIDEO_URL, { withTranscript: true });

  assert.equal(asked[0]?.url.searchParams.get("get_transcript"), "true");
  assert.equal(answer.status === "found" ? answer.vtt : null, CAPTIONS_VTT);
});

test("captions a creator added are told apart from TikTok's machine ones", async () => {
  const { vendor } = vendorAnswering(
    200,
    makeVendorAnswer({ detail: makeAwemeDetail({}, { cla_info: { caption_infos: [{ language_code: "en", is_auto_generated: false }] } }) }),
  );

  const answer = await vendor.video(VIDEO_URL, { withTranscript: false });

  assert.deepEqual(answer.status === "found" ? answer.video.captions : null, [{ language: "en", source: "creator" }]);
});

test("a photo post is not a video", async () => {
  const { vendor } = vendorAnswering(200, makeVendorAnswer({ detail: makeAwemeDetail({ image_post_info: { images: [] } }) }));

  assert.deepEqual(await vendor.video(VIDEO_URL, { withTranscript: false }), {
    status: "failed",
    reason: "not-a-video",
    credits: 1,
    vendorStatus: 200,
  });
});

test("the vendor's refusals each say why, with what they cost and its status", async () => {
  const failure = async (status: number, body: unknown = { success: false }) => {
    const answer = await vendorAnswering(status, body).vendor.video(VIDEO_URL, { withTranscript: false });
    return answer.status === "failed" ? [answer.reason, answer.vendorStatus, answer.credits] : null;
  };
  assert.deepEqual(await failure(404), ["unavailable", 404, 0]);
  assert.deepEqual(await failure(403), ["blocked", 403, 0]);
  assert.deepEqual(await failure(400), ["not-a-video", 400, 0]);
  assert.deepEqual(await failure(401), ["no-answer", 401, 0]);
  assert.deepEqual(await failure(402), ["no-answer", 402, 0]);
  assert.deepEqual(await failure(500), ["no-answer", 500, 0]);
  assert.deepEqual(await failure(200, { success: false, credits_charged: 1 }), ["unreadable", 200, 1]);
  assert.deepEqual(await failure(200, makeVendorAnswer({ detail: { aweme_id: VIDEO_ID } })), ["unreadable", 200, 1]);
});

test("a vendor that doesn't answer is no answer, and costs nothing", async () => {
  const fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof globalThis.fetch;
  const vendor = createScrapeCreatorsTikTok({ apiKey: "test-key", fetch });

  assert.deepEqual(await vendor.video(VIDEO_URL, { withTranscript: false }), {
    status: "failed",
    reason: "no-answer",
    credits: 0,
    vendorStatus: null,
  });
});
