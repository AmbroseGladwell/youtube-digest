import test from "node:test";
import assert from "node:assert/strict";
import { Response } from "undici";
import type { StoredTranscript } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { createPodcastTranscripts, podcastSourceKey } from "./createPodcastTranscripts.js";
import { feedOf } from "./podcastFeedFixtures.testHelper.js";

const FEED_URL = "https://feeds.example/show.xml";
const EPISODE = { feedUrl: FEED_URL, guid: "ep-guid" };
const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello there.\n";
const TEXT = "00:00:00\nUntimed? No, timed.\n";

const itemWith = (transcriptTags: string, guid = "ep-guid") => `
  <item>
    <title>Episode</title>
    <guid>${guid}</guid>
    <enclosure url="https://media.example/ep.mp3" type="audio/mpeg"/>
    ${transcriptTags}
  </item>`;

type Answer = { body: string; type: string } | "down";

function ladderOver(web: Record<string, Answer>, shared: unknown = null) {
  const asked: string[] = [];
  const kept: StoredTranscript[] = [];
  const fetchPublicWeb = async (link: string): Promise<PublicWebAnswer> => {
    asked.push(link);
    const answer = web[link];
    if (answer === undefined) return { status: "failed", reason: "missing" };
    if (answer === "down") return { status: "failed", reason: "no-answer" };
    return { status: "answered", url: link, response: new Response(answer.body, { headers: { "content-type": answer.type } }) };
  };
  const resolve = createPodcastTranscripts({
    fetchPublicWeb,
    transcripts: {
      getShared: async () => shared,
      putServiceFetched: async (transcript) => {
        kept.push(transcript);
      },
    },
    clock: () => new Date("2026-11-13T09:00:00.000Z"),
  });
  return { resolve, asked, kept };
}

const failureOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof TranscriptFetchError);
    return error.failure;
  }
  return assert.fail("expected a TranscriptFetchError");
};

test("the feed's transcript tag answers, timed, under the episode's own key, and is kept in the shared cache", async () => {
  const { resolve, kept } = ladderOver({
    [FEED_URL]: {
      body: feedOf(itemWith(`<podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/>`)),
      type: "application/rss+xml",
    },
    "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" },
  });
  const { transcript, answer } = await resolve(EPISODE);
  const key = await podcastSourceKey(EPISODE);
  assert.match(key, /^podcast:[0-9a-f]{32}$/);
  assert.deepEqual(answer, { via: "tag", format: "vtt" });
  assert.deepEqual(transcript, {
    videoId: key,
    segments: [{ text: "Hello there.", startMs: 1000, endMs: 3000 }],
    generated: true,
    fetchedAt: "2026-11-13T09:00:00.000Z",
  });
  assert.deepEqual(kept, [transcript]);
});

test("a cached transcript answers without the feed being asked", async () => {
  const key = await podcastSourceKey(EPISODE);
  const cached: StoredTranscript = {
    videoId: key,
    segments: [{ text: "Kept.", startMs: 0, endMs: 1 }],
    generated: true,
    fetchedAt: "2026-11-01T00:00:00.000Z",
  };
  const { resolve, asked, kept } = ladderOver({}, cached);
  assert.deepEqual(await resolve(EPISODE), { transcript: cached, answer: { via: "cache" } });
  assert.deepEqual(asked, []);
  assert.deepEqual(kept, []);
});

test("of several tags, timed cues are tried first, and one that can't be read gives way to the next", async () => {
  const { resolve, asked } = ladderOver({
    [FEED_URL]: {
      body: feedOf(
        itemWith(`
          <podcast:transcript url="https://t.example/ep.txt" type="text/plain"/>
          <podcast:transcript url="https://t.example/ep.srt" type="application/srt"/>
          <podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/>`),
      ),
      type: "application/rss+xml",
    },
    "https://t.example/ep.vtt": "down",
    "https://t.example/ep.srt": { body: "not a transcript at all", type: "application/srt" },
    "https://t.example/ep.txt": { body: TEXT, type: "text/plain" },
  });
  const { answer } = await resolve(EPISODE);
  assert.deepEqual(answer, { via: "tag", format: "text" });
  assert.deepEqual(asked.slice(1), ["https://t.example/ep.vtt", "https://t.example/ep.srt", "https://t.example/ep.txt"]);
});

test("an episode with no usable tag says there are no captions, and nothing is kept", async () => {
  const { resolve, kept } = ladderOver({
    [FEED_URL]: {
      body: feedOf(itemWith(`<podcast:transcript url="https://t.example/ep.pdf" type="application/pdf"/>`)),
      type: "application/rss+xml",
    },
  });
  assert.equal(await failureOf(resolve(EPISODE)), "no-captions");
  assert.deepEqual(kept, []);
});

test("an episode missing from its feed is unavailable, and a feed that doesn't answer is a source that couldn't", async () => {
  const missing = ladderOver({ [FEED_URL]: { body: feedOf(itemWith("", "another-guid")), type: "application/rss+xml" } });
  assert.equal(await failureOf(missing.resolve(EPISODE)), "video-unavailable");
  assert.equal(await failureOf(ladderOver({ [FEED_URL]: "down" }).resolve(EPISODE)), "source-unavailable");
});

test("an item with no guid is the episode named by its audio address, as the reader names it", async () => {
  const item = `<item><title>Episode</title><enclosure url="https://media.example/ep.mp3" type="audio/mpeg"/><podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/></item>`;
  const { resolve } = ladderOver({
    [FEED_URL]: { body: feedOf(item), type: "application/rss+xml" },
    "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" },
  });
  const { answer } = await resolve({ feedUrl: FEED_URL, guid: "https://media.example/ep.mp3" });
  assert.equal(answer.via, "tag");
});
