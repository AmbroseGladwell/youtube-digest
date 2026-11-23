import test from "node:test";
import assert from "node:assert/strict";
import { parseSocialPostLink } from "./parseSocialPostLink.js";

const REEL = { platform: "instagram", kind: "post", id: "DHsD6HGqJhp", url: "https://www.instagram.com/reel/DHsD6HGqJhp/" };
const PHOTO = { platform: "instagram", kind: "post", id: "C9xYz12AbCd", url: "https://www.instagram.com/p/C9xYz12AbCd/" };
const FACEBOOK_VIDEO = {
  platform: "facebook",
  kind: "post",
  id: "1535656380759655",
  url: "https://www.facebook.com/reel/1535656380759655",
};

test("an Instagram reel, post or older TV link carries its shortcode, with or without the account or sharer parameters", () => {
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/reel/DHsD6HGqJhp/"), REEL);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/reel/DHsD6HGqJhp/?igsh=MWQ1ZGUxMzBkMA=="), REEL);
  assert.deepEqual(parseSocialPostLink("https://instagram.com/reels/DHsD6HGqJhp"), REEL);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/tv/DHsD6HGqJhp/"), REEL);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/qqquang/reel/DHsD6HGqJhp/"), REEL);
  assert.deepEqual(parseSocialPostLink("https://m.instagram.com/reel/DHsD6HGqJhp/"), REEL);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/p/C9xYz12AbCd/?img_index=2"), PHOTO);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/someone/p/C9xYz12AbCd/"), PHOTO);
});

test("Instagram share links are followed by the vendor, since only the redirect says which post", () => {
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/share/reel/BAbCdEfGh1/"), {
    platform: "instagram",
    kind: "share",
    url: "https://www.instagram.com/share/reel/BAbCdEfGh1/",
  });
});

test("Instagram profiles, stories, explore pages and malformed shortcodes are Instagram but not a post", () => {
  const notAPost = { platform: "instagram", kind: "not-a-post" };
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/qqquang/"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/stories/qqquang/3597267389859272809/"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/explore/tags/cooking/"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/reel/a!b/"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.instagram.com/"), notAPost);
});

test("a Facebook reel, watch, video page or old video.php link carries the video's id", () => {
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/reel/1535656380759655"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/reel/1535656380759655/?mibextid=rS40aB7S9Ucbxw6v"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/watch/?v=1535656380759655"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://m.facebook.com/watch?v=1535656380759655"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/matt.west.184/videos/1535656380759655/"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/somepage/videos/air-fryer-cake/1535656380759655/"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/video.php?v=1535656380759655"), FACEBOOK_VIDEO);
  assert.deepEqual(parseSocialPostLink("https://web.facebook.com/reel/1535656380759655"), FACEBOOK_VIDEO);
});

test("Facebook share links, fb.watch and a page's posts are followed by the vendor", () => {
  for (const link of [
    "https://www.facebook.com/share/r/1AbCdEfGhJ/",
    "https://www.facebook.com/share/v/1AbCdEfGhJ/",
    "https://www.facebook.com/share/p/1AbCdEfGhJ/",
    "https://fb.watch/vAbCdEfG1h/",
    "https://www.facebook.com/somepage/posts/pfbid02AbCdEf",
    "https://www.facebook.com/permalink.php?story_fbid=123&id=456",
  ]) {
    assert.deepEqual(parseSocialPostLink(link), { platform: "facebook", kind: "share", url: link }, link);
  }
});

test("Facebook profiles, groups, the feed and malformed ids are Facebook but not a post", () => {
  const notAPost = { platform: "facebook", kind: "not-a-post" };
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/matt.west.184"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/groups/123456789"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://www.facebook.com/reel/abc"), notAPost);
  assert.deepEqual(parseSocialPostLink("https://fb.watch/"), notAPost);
});

test("other sites, other schemes and text that isn't a link are not social posts at all", () => {
  assert.equal(parseSocialPostLink("https://www.tiktok.com/@bbcnews/video/7710770990711672086"), null);
  assert.equal(parseSocialPostLink("https://notinstagram.com/reel/DHsD6HGqJhp/"), null);
  assert.equal(parseSocialPostLink("ftp://www.instagram.com/reel/DHsD6HGqJhp/"), null);
  assert.equal(parseSocialPostLink("a reel I liked"), null);
});
