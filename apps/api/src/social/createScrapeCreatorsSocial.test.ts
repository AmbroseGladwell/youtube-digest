import test from "node:test";
import assert from "node:assert/strict";
import { createScrapeCreatorsSocial } from "./createScrapeCreatorsSocial.js";
import {
  CAPTIONS_SRT,
  FACEBOOK_LINK,
  FACEBOOK_SD_URL,
  FACEBOOK_VIDEO_ID,
  INSTAGRAM_PHOTO,
  INSTAGRAM_VIDEO_URL,
  LONG_DESCRIPTION,
  makeFacebookAnswer,
  makeInstagramAnswer,
  SHORTCODE,
} from "./SocialAnswerFactory.testHelper.js";

const vendorAnswering = (status: number, body: unknown) => {
  const asked: { url: URL; key: string | null }[] = [];
  const fetch = (async (input: URL, init?: RequestInit) => {
    asked.push({ url: input, key: new Headers(init?.headers).get("x-api-key") });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { vendor: createScrapeCreatorsSocial({ apiKey: "test-key", fetch }), asked };
};

test("an Instagram reel comes back with its whole description, author, length and file, for one credit", async () => {
  const { vendor, asked } = vendorAnswering(200, makeInstagramAnswer());

  const answer = await vendor.post("instagram", `https://www.instagram.com/reel/${SHORTCODE}/`, { withTranscript: true });

  assert.deepEqual(answer, {
    status: "found",
    post: {
      platform: "instagram",
      id: SHORTCODE,
      url: `https://www.instagram.com/reel/${SHORTCODE}/`,
      handle: "windowsillgarden",
      authorName: "Windowsill Garden",
      description: LONG_DESCRIPTION,
      media: "video",
      durationSeconds: 59,
      coverUrl: "https://scontent.cdninstagram.example/thumb.jpg",
      postedAt: "2026-11-21T23:29:40.000Z",
    },
    srt: null,
    mediaUrl: INSTAGRAM_VIDEO_URL,
    credits: 1,
  });
  assert.equal(asked[0]?.url.pathname, "/v1/instagram/post");
  assert.equal(asked[0]?.url.searchParams.get("get_transcript"), null);
  assert.equal(asked[0]?.key, "test-key");
});

test("an Instagram answer's comments are never kept", async () => {
  const { vendor } = vendorAnswering(200, makeInstagramAnswer());

  const answer = await vendor.post("instagram", `https://www.instagram.com/reel/${SHORTCODE}/`, { withTranscript: true });

  assert.ok(!JSON.stringify(answer).includes("commenter"));
});

test("an Instagram photo or carousel is a photo post, kept for its description, with no file", async () => {
  const { vendor: photo } = vendorAnswering(200, makeInstagramAnswer(INSTAGRAM_PHOTO));
  const { vendor: carousel } = vendorAnswering(200, makeInstagramAnswer({ ...INSTAGRAM_PHOTO, __typename: "XDTGraphSidecar" }));

  const photoAnswer = await photo.post("instagram", `https://www.instagram.com/p/${SHORTCODE}/`, { withTranscript: true });
  const carouselAnswer = await carousel.post("instagram", `https://www.instagram.com/p/${SHORTCODE}/`, { withTranscript: true });

  assert.equal(photoAnswer.status === "found" && photoAnswer.post.media, "photo");
  assert.equal(photoAnswer.status === "found" && photoAnswer.post.url, `https://www.instagram.com/p/${SHORTCODE}/`);
  assert.equal(photoAnswer.status === "found" && photoAnswer.post.durationSeconds, null);
  assert.equal(photoAnswer.status === "found" && photoAnswer.mediaUrl, null);
  assert.equal(carouselAnswer.status === "found" && carouselAnswer.post.media, "photo");
});

test("a Facebook video comes back with its captions in the same credit, and its smaller file", async () => {
  const { vendor, asked } = vendorAnswering(200, makeFacebookAnswer({ transcript: CAPTIONS_SRT }));

  const answer = await vendor.post("facebook", FACEBOOK_LINK, { withTranscript: true });

  assert.deepEqual(answer, {
    status: "found",
    post: {
      platform: "facebook",
      id: FACEBOOK_VIDEO_ID,
      url: FACEBOOK_LINK,
      handle: "windowsill.garden",
      authorName: "Windowsill Garden",
      description: LONG_DESCRIPTION,
      media: "video",
      durationSeconds: 23,
      coverUrl: "https://scontent.fbcdn.example/thumb.jpg",
      postedAt: "2026-11-18T06:30:18.000Z",
    },
    srt: CAPTIONS_SRT,
    mediaUrl: FACEBOOK_SD_URL,
    credits: 1,
  });
  assert.equal(asked[0]?.url.pathname, "/v1/facebook/post");
  assert.equal(asked[0]?.url.searchParams.get("get_transcript"), "true");
});

test("a Facebook photo or text post is kept for its description, under the post's own id", async () => {
  const { vendor: photo } = vendorAnswering(200, makeFacebookAnswer({ image_url: "https://scontent.fbcdn.example/photo.jpg" }, null));
  const { vendor: text } = vendorAnswering(200, makeFacebookAnswer({ author: { name: "A Page" } }, null));

  const photoAnswer = await photo.post("facebook", FACEBOOK_LINK, { withTranscript: true });
  const textAnswer = await text.post("facebook", FACEBOOK_LINK, { withTranscript: true });

  assert.equal(photoAnswer.status === "found" && photoAnswer.post.media, "photo");
  assert.equal(photoAnswer.status === "found" && photoAnswer.post.id, "25118300000000001");
  assert.equal(photoAnswer.status === "found" && photoAnswer.post.coverUrl, "https://scontent.fbcdn.example/photo.jpg");
  assert.equal(textAnswer.status === "found" && textAnswer.post.media, "text");
  assert.equal(textAnswer.status === "found" && textAnswer.post.handle, null);
});

test("failures are named by the vendor's answer, and a missing post costs nothing", async () => {
  const { vendor: missing } = vendorAnswering(404, { success: false, credits_charged: 0, error: "not_found", message: "Post not found" });
  const { vendor: refused } = vendorAnswering(403, { success: false });
  const { vendor: down } = vendorAnswering(500, { success: false });
  const { vendor: strange } = vendorAnswering(200, { success: true, credits_charged: 1, data: { nothing: true } });
  const { vendor: missingOk } = vendorAnswering(200, { success: false, credits_charged: 0, error: "not_found" });

  assert.deepEqual(await missing.post("instagram", "https://www.instagram.com/reel/x/", { withTranscript: true }), {
    status: "failed",
    reason: "unavailable",
    credits: 0,
    vendorStatus: 404,
  });
  assert.equal((await refused.post("facebook", FACEBOOK_LINK, { withTranscript: true })).status === "failed" && "blocked", "blocked");
  const downAnswer = await down.post("facebook", FACEBOOK_LINK, { withTranscript: true });
  assert.equal(downAnswer.status === "failed" && downAnswer.reason, "no-answer");
  const strangeAnswer = await strange.post("instagram", FACEBOOK_LINK, { withTranscript: true });
  assert.deepEqual(strangeAnswer, { status: "failed", reason: "unreadable", credits: 1, vendorStatus: 200 });
  const missingOkAnswer = await missingOk.post("instagram", FACEBOOK_LINK, { withTranscript: true });
  assert.equal(missingOkAnswer.status === "failed" && missingOkAnswer.reason, "unavailable");
});

test("no answer at all is no-answer, at no cost", async () => {
  const fetch = (async () => {
    throw new Error("socket hang up");
  }) as typeof globalThis.fetch;
  const vendor = createScrapeCreatorsSocial({ apiKey: "test-key", fetch });

  assert.deepEqual(await vendor.post("facebook", FACEBOOK_LINK, { withTranscript: true }), {
    status: "failed",
    reason: "no-answer",
    credits: 0,
    vendorStatus: null,
  });
});
