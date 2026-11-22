import test from "node:test";
import assert from "node:assert/strict";
import { parseTikTokLink } from "./parseTikTokLink.js";

const VIDEO = { kind: "video", videoId: "7710770990711672086" };

test("a video's own link carries its id, with or without the handle, the app's mobile host or sharer parameters", () => {
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@bbcnews/video/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@bbcnews/video/7710770990711672086?is_from_webapp=1&sender_device=pc"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://m.tiktok.com/@bbcnews/video/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@/video/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://tiktok.com/@bbcnews/video/7710770990711672086"), VIDEO);
});

test("embed, player and older share addresses name the video too", () => {
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/embed/v2/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/embed/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/player/v1/7710770990711672086"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://m.tiktok.com/v/7710770990711672086.html"), VIDEO);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/share/video/7710770990711672086"), VIDEO);
});

test("share short links are followed later, since only the redirect says which video", () => {
  assert.deepEqual(parseTikTokLink("https://vm.tiktok.com/ZMhAbCdEf/"), { kind: "short", url: "https://vm.tiktok.com/ZMhAbCdEf/" });
  assert.deepEqual(parseTikTokLink("https://vt.tiktok.com/ZSAbCdEf/"), { kind: "short", url: "https://vt.tiktok.com/ZSAbCdEf/" });
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/t/ZTAbCdEf/"), { kind: "short", url: "https://www.tiktok.com/t/ZTAbCdEf/" });
});

test("profiles, photo posts, sounds, tags and malformed ids are TikTok but not a video", () => {
  const notAVideo = { kind: "not-a-video" };
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@bbcnews"), notAVideo);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@bbcnews/photo/7710770990711672086"), notAVideo);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/music/original-sound-7710770990711672086"), notAVideo);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/tag/cooking"), notAVideo);
  assert.deepEqual(parseTikTokLink("https://www.tiktok.com/@bbcnews/video/not-a-number"), notAVideo);
  assert.deepEqual(parseTikTokLink("https://vm.tiktok.com/"), notAVideo);
});

test("any other address, or what isn't one, is not a TikTok link", () => {
  assert.equal(parseTikTokLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseTikTokLink("https://tiktok.com.example/@a/video/7710770990711672086"), null);
  assert.equal(parseTikTokLink("not a link"), null);
  assert.equal(parseTikTokLink("ftp://www.tiktok.com/@a/video/7710770990711672086"), null);
});
