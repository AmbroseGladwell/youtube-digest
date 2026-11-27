import test from "node:test";
import assert from "node:assert/strict";
import { feedKindOf, youTubeChannelIdOfFeed } from "./feedKindOf.js";
import type { FeedEntry, FeedEntryKind } from "./readFeedItems.js";

const entriesOf = (...kinds: FeedEntryKind[]): FeedEntry[] =>
  kinds.map((kind, index) => ({
    id: `e${index}`,
    kind,
    title: null,
    pageUrl: null,
    publishedAt: null,
    durationSeconds: null,
    audioUrl: null,
    youTubeVideoId: null,
    imageUrl: null,
    description: "",
  }));

test("a YouTube channel's feed is a channel, whatever its entries", () => {
  assert.equal(feedKindOf("https://www.youtube.com/feeds/videos.xml?channel_id=UCabc", entriesOf("video")), "youTubeChannel");
  assert.equal(youTubeChannelIdOfFeed("https://www.youtube.com/feeds/videos.xml?channel_id=UCabc"), "UCabc");
  assert.equal(youTubeChannelIdOfFeed("https://www.youtube.com/feeds/videos.xml?playlist_id=PLabc"), null);
});

test("a feed that is mostly episodes is a podcast, and one that is mostly posts is a blog", () => {
  assert.equal(feedKindOf("https://show.example/rss", entriesOf("episode", "episode", "article")), "podcast");
  assert.equal(feedKindOf("https://letter.example/feed", entriesOf("episode", "article")), "podcast");
  assert.equal(feedKindOf("https://letter.example/feed", entriesOf("episode", "article", "article")), "blog");
  assert.equal(feedKindOf("https://letter.example/feed", []), "blog");
});
