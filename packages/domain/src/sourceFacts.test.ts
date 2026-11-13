import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview, makeRecipeOverview } from "./OverviewFactory.testHelper.js";
import { SourceKey } from "./Brands.js";
import { articleSourceId, type PodcastSource, type WebSource } from "./Source.js";
import { articleReadMinutes, kindChip, openPodcastLabel, sourceImage, sourceLength, sourceName, sourceUrl } from "./sourceFacts.js";

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
  assert.equal(openPodcastLabel(episode.sharedFrom), "Open in Spotify");
  assert.equal(openPodcastLabel("https://spotify.link/abc123"), "Open in Spotify");
  assert.equal(openPodcastLabel("https://podcasts.apple.com/gb/podcast/x/id1291423644?i=1000735123456"), "Open in Apple Podcasts");
  assert.equal(openPodcastLabel("https://www.thediary.example/episodes/241"), "Open the show’s page");
});
