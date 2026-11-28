import type { ShowFeed } from "../podcasts/createPodcastReader.js";
import test from "node:test";
import assert from "node:assert/strict";
import type { FeedRead, FeedSnapshot } from "@overview/domain";
import { createPgliteSqlClient } from "../db/createPgliteSqlClient.js";
import type { SqlClient } from "../db/SqlClient.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createMigratedTestPglite } from "../testing/createMigratedTestPglite.testHelper.js";
import { createFeedReader, FEED_LIMITS, type FeedLimits } from "./createFeedReader.js";
import { makeFakeFeedWeb, type FakeFeedWeb } from "./FakeFeedWeb.testHelper.js";
import { datedItem, rssOf, youTubeChannelFeedOf, youTubeEntry } from "./feedFixtures.testHelper.js";
import { FeedsRepository } from "./FeedsRepository.js";

const FEED = "https://letter.example/feed";
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const dayOf = (day: number): string => new Date(Date.UTC(2026, 10, day, 9)).toUTCString();
const feedWith = (...days: number[]): string => rssOf(...days.map((day) => datedItem(day, dayOf(day))));

interface Setup {
  web: FakeFeedWeb;
  sql: SqlClient;
  clock: { now: Date; advance(ms: number): void };
  reader: ReturnType<typeof createFeedReader>;
  log: ReturnType<typeof recordingLogger>;
}

const setUp = async (limits: Partial<FeedLimits> = {}, showFeedOf?: (link: string) => Promise<ShowFeed | null>): Promise<Setup> => {
  const sql = createPgliteSqlClient(await createMigratedTestPglite());
  const web = makeFakeFeedWeb();
  const clock = {
    now: new Date("2026-11-27T12:00:00.000Z"),
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const reader = createFeedReader({
    feeds: new FeedsRepository(sql),
    fetchPublicWeb: web.fetch,
    clock: () => clock.now,
    limits: { ...FEED_LIMITS, ...limits },
    sleep: async (ms) => {
      clock.advance(ms);
      await new Promise((resolve) => setImmediate(resolve));
    },
    ...(showFeedOf === undefined ? {} : { showFeedOf }),
  });
  return { web, sql, clock, reader, log: recordingLogger() };
};

const feedOf = (read: FeedRead): FeedSnapshot => {
  assert.equal(read.status, "read");
  return (read as { feed: FeedSnapshot }).feed;
};

const idsOf = (read: FeedRead): string[] => feedOf(read).entries.map((entry) => entry.id);

test("a feed is fetched once, stored, and answered from the stored copy for 30 minutes", async () => {
  const { web, reader, clock, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10, 9) });

  const first = feedOf(await reader.read(FEED, log.logger));
  clock.advance(29 * MINUTE_MS);
  const second = feedOf(await reader.read(FEED, log.logger));

  assert.equal(web.calls.length, 1);
  assert.deepEqual(
    [first.freshness, first.kind, first.title, first.entries.map((entry) => entry.id)],
    ["read", "blog", "A Letter & More", ["p10", "p9"]],
  );
  assert.equal(second.freshness, "stored");
  assert.deepEqual(second.entries, first.entries);
});

test("after 30 minutes it asks only for what changed, and a 304 keeps the entries", async () => {
  const { web, reader, clock, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10), etag: '"v1"', lastModified: "Wed, 26 Nov 2026 09:00:00 GMT" });
  await reader.read(FEED, log.logger);
  web.answers.set(FEED, { notModified: true });
  clock.advance(31 * MINUTE_MS);

  const read = feedOf(await reader.read(FEED, log.logger));

  assert.deepEqual(web.calls[1]?.headers, { "if-none-match": '"v1"', "if-modified-since": "Wed, 26 Nov 2026 09:00:00 GMT" });
  assert.deepEqual([read.freshness, read.fetchedAt, idsOf({ status: "read", feed: read })], ["read", clock.now.toISOString(), ["p10"]]);
});

test("new entries go on top of the stored ones, held to the most entries", async () => {
  const { web, reader, clock, log } = await setUp({ mostEntries: 3 });
  web.answers.set(FEED, { body: feedWith(8, 7, 6) });
  await reader.read(FEED, log.logger);
  web.answers.set(FEED, { body: feedWith(10, 9, 8, 7, 6) });
  clock.advance(31 * MINUTE_MS);

  assert.deepEqual(idsOf(await reader.read(FEED, log.logger)), ["p10", "p9", "p8"]);
});

test("many followers asking at once cause one fetch", async () => {
  const { web, reader, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  const release = web.hold();

  const reads = Array.from({ length: 25 }, () => reader.read(FEED, log.logger));
  await new Promise((resolve) => setImmediate(resolve));
  release();
  const answers = await Promise.all(reads);

  assert.equal(web.calls.length, 1);
  assert.ok(answers.every((answer) => answer.status === "read"));
});

test("past the hourly fetch budget the stored copy answers, and a feed never stored is busy", async () => {
  const { web, reader, clock, log } = await setUp({ mostPerHour: 1 });
  web.answers.set(FEED, { body: feedWith(10) });
  web.answers.set("https://other.example/feed", { body: feedWith(9) });
  await reader.read(FEED, log.logger);
  clock.advance(31 * MINUTE_MS);

  const stored = feedOf(await reader.read(FEED, log.logger));
  const never = await reader.read("https://other.example/feed", log.logger);

  assert.equal(web.calls.length, 1);
  assert.equal(stored.freshness, "stored");
  assert.deepEqual(never, { status: "failed", reason: "busy" });
});

test("a feed that fails waits longer each time, and a Retry-After longer than that is honoured", async () => {
  const { web, reader, clock, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  await reader.read(FEED, log.logger);
  web.answers.set(FEED, { failed: "no-answer", httpStatus: 503 });

  clock.advance(31 * MINUTE_MS);
  assert.equal(feedOf(await reader.read(FEED, log.logger)).freshness, "failing");
  clock.advance(29 * MINUTE_MS);
  await reader.read(FEED, log.logger);
  assert.equal(web.calls.length, 2, "still waiting out the first 30 minutes");

  clock.advance(2 * MINUTE_MS);
  web.answers.set(FEED, { failed: "blocked", httpStatus: 429, retryAfterSeconds: 3 * 60 * 60 });
  await reader.read(FEED, log.logger);
  clock.advance(2 * 60 * MINUTE_MS);
  await reader.read(FEED, log.logger);
  assert.equal(web.calls.length, 3, "Retry-After asked for three hours, past the doubled hour");

  clock.advance(61 * MINUTE_MS);
  web.answers.set(FEED, { body: feedWith(11, 10) });
  const back = feedOf(await reader.read(FEED, log.logger));
  assert.deepEqual([back.freshness, back.entries.map((entry) => entry.id)], ["read", ["p11", "p10"]]);
});

test("a 410 is gone at once, and a feed failing for seven days is gone; neither is fetched again", async () => {
  const { web, reader, clock, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  web.answers.set("https://other.example/feed", { body: feedWith(9) });
  await reader.read(FEED, log.logger);
  await reader.read("https://other.example/feed", log.logger);
  web.answers.set(FEED, { failed: "missing", httpStatus: 410 });
  web.answers.set("https://other.example/feed", { failed: "no-answer", httpStatus: 500 });

  clock.advance(31 * MINUTE_MS);
  assert.equal(feedOf(await reader.read(FEED, log.logger)).freshness, "gone");
  for (let day = 0; day < 8; day += 1) {
    await reader.read("https://other.example/feed", log.logger);
    clock.advance(DAY_MS + MINUTE_MS);
  }
  const callsBefore = web.calls.length;
  assert.equal(feedOf(await reader.read("https://other.example/feed", log.logger)).freshness, "gone");
  await reader.read(FEED, log.logger);
  assert.equal(web.calls.length, callsBefore);
});

test("a stored feed no follower checks for 90 days is forgotten", async () => {
  const { web, reader, sql, clock, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  web.answers.set("https://other.example/feed", { body: feedWith(9) });
  await reader.read(FEED, log.logger);
  clock.advance(91 * DAY_MS);

  await reader.read("https://other.example/feed", log.logger);

  const kept = await sql.query<{ feed_url: string }>("select feed_url from feeds order by feed_url");
  assert.deepEqual(
    kept.map((row) => row.feed_url),
    ["https://other.example/feed"],
  );
  assert.ok(log.lines.some((line) => line.msg === "unchecked feeds forgotten" && line.count === 1));
});

test("the stored copy has no place for an account", async () => {
  const { sql } = await setUp();
  const columns = await sql.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'feeds'");
  assert.ok(columns.length > 0);
  assert.ok(columns.every(({ column_name }) => !/account|session|reader|user/.test(column_name)));
});

test("a log line never carries the feed, the link or an entry", async () => {
  const { web, reader, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  web.answers.set("https://letter.example/", {
    body: `<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>`,
    type: "text/html",
  });

  await reader.lookUp("https://letter.example/", log.logger);

  const written = JSON.stringify(log.lines);
  assert.ok(log.lines.some((line) => line.msg === "feed looked up" && line.via === "page" && line.outcome === "found"));
  assert.ok(!written.includes("letter.example") && !written.includes("Post 10"));
});

test("a page's feed is found and read, and a page with none says so", async () => {
  const { web, reader, log } = await setUp();
  web.answers.set(FEED, { body: feedWith(10) });
  web.answers.set("https://letter.example/p/1", {
    body: `<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head><body></body></html>`,
    type: "text/html",
  });
  web.answers.set("https://plain.example/", { body: "<html><head><title>x</title></head></html>", type: "text/html" });

  assert.deepEqual(idsOf(await reader.lookUp("https://letter.example/p/1#top", log.logger)), ["p10"]);
  assert.deepEqual(await reader.lookUp("https://plain.example/", log.logger), { status: "failed", reason: "noFeedOnPage" });
});

test("a podcast's show link reads the feed the directories name, and a show with no public feed says so", async () => {
  const shows: Record<string, ShowFeed> = {
    "https://podcasts.apple.com/gb/podcast/a-show/id42": { status: "found", feedUrl: FEED },
    "https://open.spotify.com/show/3IM0lmZxpFAY7CwMuv9H4g": { status: "noPublicFeed" },
  };
  const { web, reader, log } = await setUp({}, async (link) => shows[link] ?? null);
  web.answers.set(FEED, { body: feedWith(10) });

  assert.deepEqual(idsOf(await reader.lookUp("https://podcasts.apple.com/gb/podcast/a-show/id42", log.logger)), ["p10"]);
  assert.deepEqual(await reader.lookUp("https://open.spotify.com/show/3IM0lmZxpFAY7CwMuv9H4g", log.logger), {
    status: "failed",
    reason: "noPublicFeed",
  });
  assert.ok(log.lines.some((line) => line.msg === "feed looked up" && line.via === "show" && line.outcome === "found"));
});

test("a YouTube channel link reads the channel's own feed, labelled as a channel", async () => {
  const { web, reader, log } = await setUp();
  const channelFeed = "https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv";
  web.answers.set(channelFeed, { body: youTubeChannelFeedOf(youTubeEntry("vid1", "2026-11-26T15:00:00+00:00")), type: "text/xml" });

  const feed = feedOf(await reader.lookUp("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/videos", log.logger));

  assert.deepEqual(
    web.calls.map((call) => call.url),
    [channelFeed],
  );
  assert.deepEqual([feed.feedUrl, feed.kind, feed.entries[0]?.kind], [channelFeed, "youTubeChannel", "video"]);
});

test("a link that isn't a web address, and one that can't be reached, say so", async () => {
  const { reader, log } = await setUp();
  assert.deepEqual(await reader.lookUp("not a link", log.logger), { status: "failed", reason: "notAFeed" });
  assert.deepEqual(await reader.lookUp("https://nowhere.example/feed", log.logger), { status: "failed", reason: "missing" });
});
