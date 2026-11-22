import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview, makeRecipeOverview } from "./OverviewFactory.testHelper.js";
import { SourceKey } from "./Brands.js";
import { Source, articleSourceId, keptSharedLink, tiktokSource, type PodcastSource, type TikTokSource, type WebSource } from "./Source.js";
import {
  articleReadMinutes,
  kindChip,
  openPodcastLabel,
  recipeFrom,
  sourceImage,
  sourceLength,
  sourceName,
  sourceUrl,
} from "./sourceFacts.js";
import { sourceKey } from "./sourceKey.js";
import type { TikTokVideo } from "./TikTokVideo.js";

const article: WebSource = {
  kind: "web",
  id: "abc" as WebSource["id"],
  url: "https://www.harbour.example/a",
  title: "A",
  siteName: "The Harbour Post",
  author: null,
  publishedAt: null,
  language: null,
  imageUrl: "https://cdn.example/a.jpg",
  wordCount: 3220,
};

test("a piece is from its channel, its site, or failing that its address", () => {
  assert.equal(sourceName(makeOverview().source), "Example Channel");
  assert.equal(sourceName(article), "The Harbour Post");
  assert.equal(sourceName({ ...article, siteName: null }), "harbour.example");
});

test("the length line names the kind", () => {
  assert.equal(sourceLength(article), "14 min article");
  assert.equal(sourceLength({ ...makeOverview().source, durationMs: 698_000 }), "11:38 video");
});

test("a video whose length is not known still says it is a video, and no length is guessed", () => {
  assert.equal(sourceLength(makeOverview().source), "Video");
});

test("reading time is 230 words a minute, and never zero", () => {
  assert.equal(articleReadMinutes(230), 1);
  assert.equal(articleReadMinutes(10), 1);
  assert.equal(articleReadMinutes(3220), 14);
});

test("the image is the page's share image", () => {
  assert.equal(sourceImage(article), "https://cdn.example/a.jpg");
  assert.equal(sourceImage({ ...article, imageUrl: null }), null);
});

test("an article's id is the same for the same address, short, and safe in a path", async () => {
  const id = await articleSourceId("https://a.example/post");
  assert.equal(id, await articleSourceId("https://a.example/post"));
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.notEqual(id, await articleSourceId("https://a.example/other"));
});

test("every kind but a video leads its row with a chip, and a recipe keeps its yield", () => {
  assert.equal(kindChip(makeOverview()), null);
  assert.equal(kindChip({ source: article, recipe: null }), "Article");
  assert.equal(kindChip(makeRecipeOverview()), "Recipe · 4 servings");
  assert.equal(kindChip(makeRecipeOverview({ yield: null })), "Recipe");
});

test("a recipe video's chip is a recipe's, not nothing", () => {
  assert.equal(kindChip(makeRecipeOverview({}, { source: makeOverview().source })), "Recipe · 4 servings");
});

const episode: PodcastSource = {
  kind: "podcast",
  id: SourceKey.parse("fedcba9876543210fedcba9876543210"),
  feedUrl: "https://feeds.example/diary.xml",
  guid: "episode-guid",
  title: "Why your parents’ decline is a preview",
  showName: "The Diary Of A CEO",
  publishedAt: "2026-11-10T06:00:00.000Z",
  durationMs: 6_948_000,
  audioUrl: "https://media.example/episode.mp3",
  pageUrl: null,
  imageUrl: "https://cdn.example/art.jpg",
  sharedFrom: "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
};

test("an episode is named by its show, a Podcast chip and its length in hours and minutes", () => {
  assert.equal(sourceName(episode), "The Diary Of A CEO");
  assert.equal(kindChip({ source: episode, recipe: null }), "Podcast");
  assert.equal(sourceLength(episode), "1 hr 56 min episode");
  assert.equal(sourceLength({ ...episode, durationMs: null }), "Episode");
  assert.equal(sourceImage(episode), "https://cdn.example/art.jpg");
});

test("an episode's way out is the link the reader shared, never the feed's audio", () => {
  assert.equal(sourceUrl(episode), "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk");
  assert.equal(openPodcastLabel(episode.sharedFrom), "Listen on Spotify");
  assert.equal(openPodcastLabel("https://spotify.link/abc123"), "Listen on Spotify");
  assert.equal(openPodcastLabel("https://podcasts.apple.com/gb/podcast/x/id1291423644?i=1000735123456"), "Listen on Apple Podcasts");
  assert.equal(openPodcastLabel("https://www.thediary.example/episodes/241"), "Open the show’s page");
});

test("the link kept for the way back drops who shared it and the campaign, and keeps what names the episode", () => {
  assert.equal(
    keptSharedLink("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=a1b2c3d4e5f6&utm_source=copy-link"),
    "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
  );
  assert.equal(
    keptSharedLink("https://podcasts.apple.com/gb/podcast/x/id1291423644?i=1000735123456&utm_medium=share"),
    "https://podcasts.apple.com/gb/podcast/x/id1291423644?i=1000735123456",
  );
  assert.equal(keptSharedLink("spotify:episode:4rOoJ6Egrf8K2IrywzwOMk"), "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk");
});

const clip: TikTokSource = {
  kind: "tiktok",
  id: SourceKey.parse("7301234567890123456"),
  url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
  title: "The one-pan jollof I make every Sunday #jollof",
  handle: "kitchenwithada",
  authorName: "Kitchen with Ada",
  durationMs: 42_000,
  publishedAt: null,
  imageUrl: "https://p16-sign.tiktokcdn.example/cover.jpeg",
};

test("a TikTok is named by its creator, a TikTok chip and its length as a clock", () => {
  assert.equal(sourceName(clip), "Kitchen with Ada");
  assert.equal(sourceName({ ...clip, authorName: " " }), "@kitchenwithada");
  assert.equal(kindChip({ source: clip, recipe: null }), "TikTok");
  assert.equal(sourceLength(clip), "0:42 TikTok");
  assert.equal(sourceLength({ ...clip, durationMs: null }), "TikTok");
  assert.equal(sourceImage(clip), "https://p16-sign.tiktokcdn.example/cover.jpeg");
  assert.equal(sourceUrl(clip), clip.url);
  assert.equal(recipeFrom(clip), "Kitchen with Ada on TikTok");
});

const read: TikTokVideo = {
  id: "7301234567890123456",
  url: "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456",
  handle: "kitchenwithada",
  authorName: "Kitchen with Ada",
  description: "  The one-pan jollof I make every Sunday #jollof ",
  durationSeconds: 42,
  coverUrl: null,
  postedAt: "2026-11-12T18:30:00.000Z",
  captions: [],
};

test("a TikTok read becomes a source keyed by its id, its caption the title, and the creator when there's none", () => {
  const source = tiktokSource(read);
  assert.equal(sourceKey(source), "tiktok:7301234567890123456");
  assert.equal(source.title, "The one-pan jollof I make every Sunday #jollof");
  assert.equal(source.durationMs, 42_000);
  assert.equal(source.publishedAt, "2026-11-12T18:30:00.000Z");
  assert.equal(tiktokSource({ ...read, description: "" }).title, "@kitchenwithada");
  assert.ok(Source.safeParse(source).success);
});
