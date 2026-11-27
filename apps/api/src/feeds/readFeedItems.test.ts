import test from "node:test";
import assert from "node:assert/strict";
import { MOST_DESCRIPTION_CHARACTERS, readFeedItems, type FeedItemsRead, type FeedListing } from "./readFeedItems.js";
import {
  atomOf,
  BLOG_ENTRY,
  datedItem,
  NEWSLETTER_EPISODE,
  NEWSLETTER_POST,
  rssOf,
  youTubeChannelFeedOf,
  youTubeEntry,
} from "./feedFixtures.testHelper.js";

const inPieces = async function* (text: string, size = 7): AsyncGenerator<string> {
  for (let start = 0; start < text.length; start += size) {
    yield text.slice(start, start + size);
  }
};

interface ReadOptions {
  feedUrl?: string;
  mostEntries?: number;
  known?: string[];
  newestKnownAt?: string;
}

const read = (text: string, options: ReadOptions = {}): Promise<FeedItemsRead> =>
  readFeedItems(inPieces(text), {
    feedUrl: options.feedUrl ?? "https://letter.example/feed",
    mostEntries: options.mostEntries ?? 50,
    isKnown: (id) => (options.known ?? []).includes(id),
    newestKnownAt: options.newestKnownAt ?? null,
  });

const listingOf = (result: FeedItemsRead): FeedListing => {
  assert.equal(result.status, "feed");
  return (result as { feed: FeedListing }).feed;
};

const dayOf = (day: number): string => new Date(Date.UTC(2026, 10, day, 9)).toUTCString();
const isoDayOf = (day: number): string => new Date(Date.UTC(2026, 10, day, 9)).toISOString();

test("an RSS newsletter's post and episode are read whole, each with its own kind, from a feed split anywhere", async () => {
  const feed = listingOf(await read(rssOf(NEWSLETTER_POST, NEWSLETTER_EPISODE)));
  assert.deepEqual(
    { format: feed.format, title: feed.title, siteUrl: feed.siteUrl, imageUrl: feed.imageUrl },
    { format: "rss", title: "A Letter & More", siteUrl: "https://letter.example/", imageUrl: "https://letter.example/logo.png" },
  );
  assert.deepEqual(feed.entries, [
    {
      id: "https://letter.example/p/why-the-middle-matters",
      kind: "article",
      title: "Why the “middle” matters",
      pageUrl: "https://letter.example/p/why-the-middle-matters",
      publishedAt: "2026-11-26T12:00:00.000Z",
      durationSeconds: null,
      audioUrl: null,
      youTubeVideoId: null,
      imageUrl: "https://cdn.letter.example/header.jpg",
      description: "A short teaser for the post.",
    },
    {
      id: "episode-12",
      kind: "episode",
      title: "Episode 12: an interview",
      pageUrl: "https://letter.example/p/episode-12",
      publishedAt: "2026-11-24T08:00:00.000Z",
      durationSeconds: 2710,
      audioUrl: "https://cdn.letter.example/ep12.mp3",
      youTubeVideoId: null,
      imageUrl: "https://cdn.letter.example/ep12.jpg",
      description: "We talk.",
    },
  ]);
});

test("an image enclosure never makes a post an episode", async () => {
  const [entry] = listingOf(await read(rssOf(NEWSLETTER_POST))).entries;
  assert.equal(entry?.kind, "article");
  assert.equal(entry?.audioUrl, null);
});

test("an Atom blog entry takes its alternate link against the feed's address, and its xhtml content as text when there's no summary", async () => {
  const feed = listingOf(await read(atomOf(BLOG_ENTRY), { feedUrl: "https://blog.example/atom.xml" }));
  assert.deepEqual(
    { format: feed.format, title: feed.title, siteUrl: feed.siteUrl, imageUrl: feed.imageUrl },
    { format: "atom", title: "Some Blog", siteUrl: "https://blog.example/", imageUrl: "https://blog.example/favicon.png" },
  );
  assert.deepEqual(feed.entries, [
    {
      id: "tag:blog.example,2026:tidying",
      kind: "article",
      title: "Notes on <em>tidying</em>",
      pageUrl: "https://blog.example/2026/11/tidying",
      publishedAt: "2026-11-25T09:30:00.000Z",
      durationSeconds: null,
      audioUrl: null,
      youTubeVideoId: null,
      imageUrl: null,
      description: "First paragraph.\nSecond.",
    },
  ]);
});

test("a YouTube channel's entries are videos, with the thumbnail and description from their media group", async () => {
  const feed = listingOf(
    await read(youTubeChannelFeedOf(youTubeEntry("vid1", "2026-11-26T15:00:00+00:00")), {
      feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCabc",
    }),
  );
  assert.equal(feed.title, "A Channel");
  assert.deepEqual(feed.entries, [
    {
      id: "yt:video:vid1",
      kind: "video",
      title: "Video vid1",
      pageUrl: "https://www.youtube.com/watch?v=vid1",
      publishedAt: "2026-11-26T15:00:00.000Z",
      durationSeconds: null,
      audioUrl: null,
      youTubeVideoId: "vid1",
      imageUrl: "https://i1.ytimg.com/vi/vid1/hqdefault.jpg",
      description: "What video vid1 is about.",
    },
  ]);
});

test("a newest-first feed stops at the newest entry already held, and the rest is never parsed", async () => {
  const items = [10, 9, 8, 7, 6].map((day) => datedItem(day, dayOf(day)));
  const feed = listingOf(await read(rssOf(...items) + "<item><title>broken", { known: ["p8", "p7"], newestKnownAt: isoDayOf(8) }));
  assert.deepEqual(
    feed.entries.map((entry) => entry.id),
    ["p10", "p9"],
  );
  assert.equal(feed.entriesRead, 3);
  assert.equal(feed.reachedKnown, true);
});

test("a newest-first feed stops once it holds the most entries asked for", async () => {
  const items = [10, 9, 8, 7, 6].map((day) => datedItem(day, dayOf(day)));
  const feed = listingOf(await read(rssOf(...items), { mostEntries: 2 }));
  assert.deepEqual(
    feed.entries.map((entry) => entry.id),
    ["p10", "p9"],
  );
  assert.equal(feed.entriesRead, 2);
});

test("an oldest-first feed is read to the end, so its newest entries are the ones kept", async () => {
  const items = [1, 2, 3, 4, 5, 6, 7].map((day) => datedItem(day, dayOf(day)));
  const feed = listingOf(await read(rssOf(...items), { mostEntries: 2, known: ["p1", "p2", "p3"], newestKnownAt: isoDayOf(3) }));
  assert.deepEqual(
    feed.entries.map((entry) => entry.id),
    ["p7", "p6"],
  );
  assert.equal(feed.entriesRead, 7);
});

test("a known entry older than the newest held doesn't stop reading, since the feed may have been reordered", async () => {
  const items = [datedItem(4, dayOf(4)), datedItem(9, dayOf(9)), datedItem(5, dayOf(5))];
  const feed = listingOf(await read(rssOf(...items), { known: ["p5", "p4"], newestKnownAt: isoDayOf(5) }));
  assert.deepEqual(
    feed.entries.map((entry) => entry.id),
    ["p9"],
  );
  assert.equal(feed.entriesRead, 3);
});

test("an entry with nothing to open is left out", async () => {
  const feed = listingOf(await read(rssOf("<item><title>Just a title</title><guid>g</guid></item>", NEWSLETTER_EPISODE)));
  assert.deepEqual(
    feed.entries.map((entry) => entry.id),
    ["episode-12"],
  );
  assert.equal(feed.entriesRead, 2);
});

test("a description is cut at a word, under its limit, and a long post's text is never kept whole", async () => {
  const long = Array.from({ length: 1_000 }, (_, index) => `word${index}`).join(" ");
  const item = `<item><title>Long</title><link>https://letter.example/p/long</link><content:encoded><![CDATA[<p>${long}</p>]]></content:encoded></item>`;
  const [entry] = listingOf(await read(rssOf(item))).entries;
  assert.ok((entry?.description.length ?? 0) <= MOST_DESCRIPTION_CHARACTERS);
  assert.match(entry?.description ?? "", /word\d+…$/);
});

test("a web page is not a feed", async () => {
  assert.deepEqual(await read("<!doctype html><html><head><title>Hi</title></head><body><p>Hello</p></body></html>"), {
    status: "notAFeed",
  });
});

test("an RSS 1.0 feed is read too", async () => {
  const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel><title>Old School</title><link>https://old.example/</link></channel>
    <item><title>A post</title><link>https://old.example/a</link><dc:date>2026-11-20T10:00:00Z</dc:date></item>
  </rdf:RDF>`;
  const feed = listingOf(await read(rdf));
  assert.equal(feed.title, "Old School");
  assert.deepEqual(
    feed.entries.map((entry) => [entry.id, entry.publishedAt]),
    [["https://old.example/a", "2026-11-20T10:00:00.000Z"]],
  );
});
