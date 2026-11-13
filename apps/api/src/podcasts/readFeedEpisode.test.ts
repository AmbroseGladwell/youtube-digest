import test from "node:test";
import assert from "node:assert/strict";
import { feedDurationSeconds, readFeedEpisode, type FeedItem } from "./readFeedEpisode.js";
import { feedOf, FEED_ITEM_NEWEST, FEED_ITEM_OLDER } from "./podcastFeedFixtures.testHelper.js";

async function* inPieces(text: string, size = 7): AsyncGenerator<string> {
  for (let start = 0; start < text.length; start += size) yield text.slice(start, start + size);
}

const byGuid = (guid: string) => (item: FeedItem) => item.guid === guid;

test("the wanted item is read whole, with its transcripts, chapters and notes, from a feed split anywhere", async () => {
  const { show, item } = await readFeedEpisode(inPieces(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)), byGuid("older-guid"));
  assert.deepEqual(show, { title: "A Show & Friends", imageUrl: "https://cdn.example/show.jpg" });
  assert.deepEqual(item, {
    guid: "older-guid",
    title: "Episode 1: The “Start”",
    publishedAt: "2026-11-01T09:00:00.000Z",
    durationSeconds: 3725,
    audioUrl: "https://media.example/ep1.mp3",
    pageUrl: "https://show.example/episodes/1",
    imageUrl: null,
    notes: "We talk about beginnings.\nLinks & more",
    transcripts: [
      { url: "https://show.example/ep1.vtt", type: "text/vtt", language: "en" },
      { url: "https://show.example/ep1.srt", type: "application/srt", language: null },
    ],
    chaptersUrl: "https://show.example/ep1-chapters.json",
  });
});

test("reading stops at the wanted item, so the rest of a long feed is never parsed", async () => {
  const { item, itemsRead } = await readFeedEpisode(
    inPieces(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER) + "<item><title>broken"),
    byGuid("newest-guid"),
  );
  assert.equal(item?.guid, "newest-guid");
  assert.equal(itemsRead, 1);
});

test("an episode's own artwork wins over the show's", async () => {
  const { item } = await readFeedEpisode(inPieces(feedOf(FEED_ITEM_NEWEST)), byGuid("newest-guid"));
  assert.equal(item?.imageUrl, "https://cdn.example/ep2.jpg");
});

test("no wanted item reads to the end and says so", async () => {
  const { item, itemsRead } = await readFeedEpisode(inPieces(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)), byGuid("missing"));
  assert.equal(item, null);
  assert.equal(itemsRead, 2);
});

test("what isn't a feed reads as no show and no items", async () => {
  const feed = await readFeedEpisode(inPieces("<html><body>Not found</body></html>"), () => true);
  assert.deepEqual(feed, { show: { title: null, imageUrl: null }, item: null, itemsRead: 0 });
});

test("durations come as seconds or as clock time, and nonsense is no duration", () => {
  assert.equal(feedDurationSeconds("3725"), 3725);
  assert.equal(feedDurationSeconds("1:02:05"), 3725);
  assert.equal(feedDurationSeconds("62:05"), 3725);
  assert.equal(feedDurationSeconds("3725.4"), 3725);
  assert.equal(feedDurationSeconds("about an hour"), null);
  assert.equal(feedDurationSeconds("0"), null);
});
