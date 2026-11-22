import test from "node:test";
import assert from "node:assert/strict";
import { readTikTokPage } from "./readTikTokPage.js";
import { CAPTIONS_URL, makeTikTokItem, makeTikTokPage, pageWithItem, VIDEO_ID } from "./TikTokPageFactory.testHelper.js";

test("a video page gives the video, its author and its caption tracks", () => {
  assert.deepEqual(readTikTokPage(makeTikTokPage()), {
    status: "video",
    video: {
      id: VIDEO_ID,
      url: `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}`,
      handle: "anewsroom",
      authorName: "A Newsroom",
      description: "Three things to know about the summit #news",
      durationSeconds: 80,
      coverUrl: "https://covers.tiktok.example/cover.jpeg",
      postedAt: "2026-11-21T23:29:40.000Z",
      captions: [{ language: "eng-US", source: "ASR" }],
    },
    captionLinks: [{ language: "eng-US", source: "ASR", url: CAPTIONS_URL }],
  });
});

test("a video with no caption tracks is still a video, with none listed", () => {
  const page = readTikTokPage(pageWithItem(makeTikTokItem({}, { subtitleInfos: [] })));
  assert.equal(page.status, "video");
  assert.deepEqual(page.status === "video" ? page.video.captions : null, []);
});

test("only WebVTT tracks with an address are kept", () => {
  const page = readTikTokPage(
    pageWithItem(
      makeTikTokItem(
        {},
        {
          subtitleInfos: [
            { LanguageCodeName: "eng-US", Source: "ASR", Format: "json", Url: CAPTIONS_URL },
            { LanguageCodeName: "fra-FR", Source: "MT", Format: "webvtt" },
            { LanguageCodeName: "deu-DE", Source: "MT", Format: "webvtt", Url: CAPTIONS_URL },
          ],
        },
      ),
    ),
  );
  assert.deepEqual(page.status === "video" ? page.captionLinks.map(({ language }) => language) : null, ["deu-DE"]);
});

test("missing length, cover or date are unknown rather than a failure", () => {
  const page = readTikTokPage(pageWithItem(makeTikTokItem({ createTime: undefined }, { duration: 0, cover: "" })));
  assert.equal(page.status, "video");
  if (page.status !== "video") return;
  assert.equal(page.video.durationSeconds, null);
  assert.equal(page.video.coverUrl, null);
  assert.equal(page.video.postedAt, null);
});

test("a photo post is not a video", () => {
  assert.deepEqual(readTikTokPage(pageWithItem(makeTikTokItem({ imagePost: { images: [] } }))), { status: "not-a-video" });
});

test("a removed or private video's page says so with a status and no item", () => {
  assert.deepEqual(readTikTokPage(makeTikTokPage({ statusCode: 10204, statusMsg: "item doesn't exist" })), { status: "unavailable" });
});

test("a page without the data, or with data in a shape we don't know, is unreadable rather than guessed at", () => {
  assert.deepEqual(readTikTokPage("<html><body>Verify you are human</body></html>"), { status: "unreadable" });
  assert.deepEqual(readTikTokPage(makeTikTokPage({ statusCode: 0 })), { status: "unreadable" });
  assert.deepEqual(readTikTokPage(pageWithItem({ id: VIDEO_ID })), { status: "unreadable" });
  assert.deepEqual(readTikTokPage('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{not json</script>'), {
    status: "unreadable",
  });
});
