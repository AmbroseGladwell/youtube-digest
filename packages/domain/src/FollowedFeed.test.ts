import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Capture } from "./Capture.js";
import { feedIdOf } from "./feedIdOf.js";
import { FollowedFeed } from "./FollowedFeed.js";

const FEED_URL = "https://blog.example/feed.xml";

test("a feed's id is the SHA-256 of its address, so every device following it names the same record", async () => {
  const id = await feedIdOf(FEED_URL);

  assert.equal(id, createHash("sha256").update(FEED_URL).digest("hex"));
  assert.notEqual(await feedIdOf("https://blog.example/feed.xml?format=atom"), id);
});

test("a followed feed holds its address, kind, pace and order, and a dead image link reads as none", async () => {
  const read = FollowedFeed.parse({
    id: await feedIdOf(FEED_URL),
    feedUrl: FEED_URL,
    kind: "blog",
    title: "A blog",
    siteUrl: "https://blog.example/",
    imageUrl: "not a link",
    followedAt: "2026-11-28T09:00:00.000Z",
    pace: "whenChosen",
    order: "newestFirst",
    unavailable: null,
  });

  assert.equal(read.imageUrl, null);
});

test("a kept capture can come from a feed, and says which", async () => {
  const read = Capture.parse({
    id: "8d0b1b52-6c1f-4a43-9a0e-0c2f4a1e9b11",
    sourceKey: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    keptAt: "2026-11-28T09:00:00.000Z",
    keptFrom: "feed",
    captureReason: null,
    fromFeed: { id: await feedIdOf(FEED_URL), kind: "youTubeChannel", title: "A channel" },
    stage: "kept",
    source: null,
    waitingFor: "turn",
    resumesAt: null,
  });

  assert.equal(read.fromFeed?.kind, "youTubeChannel");
});
