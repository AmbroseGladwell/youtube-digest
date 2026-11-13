import test from "node:test";
import type { FastifyBaseLogger } from "fastify";
import type { AccountId } from "../auth/AccountId.js";
import assert from "node:assert/strict";
import { Response } from "undici";
import type { StoredTranscript } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import {
  createPodcastTranscripts,
  MatchUnconfirmedError,
  podcastSourceKey,
  type PodcastTranscriptsOptions,
  type YouTubeAsk,
} from "./createPodcastTranscripts.js";
import { feedOf } from "./podcastFeedFixtures.testHelper.js";

const FEED_URL = "https://feeds.example/show.xml";
const EPISODE = { feedUrl: FEED_URL, guid: "ep-guid" };
const log = { info: () => undefined, warn: () => undefined } as unknown as FastifyBaseLogger;
const asking = (episode: { feedUrl: string; guid: string }, youTube: YouTubeAsk = null) => ({
  ...episode,
  youTube,
  caller: { accountId: "00000000-0000-4000-8000-000000000001" as AccountId, plan: "free" as const },
  log,
});
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

function ladderOver(
  web: Record<string, Answer>,
  shared: unknown = null,
  youTubeService: PodcastTranscriptsOptions["youTubeService"] = null,
) {
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
    youTubeService,
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
  const { transcript, answer } = await resolve(asking(EPISODE));
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
  assert.deepEqual(await resolve(asking(EPISODE)), { transcript: cached, answer: { via: "cache" } });
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
  const { answer } = await resolve(asking(EPISODE));
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
  assert.equal(await failureOf(resolve(asking(EPISODE))), "no-captions");
  assert.deepEqual(kept, []);
});

test("an episode missing from its feed is unavailable, and a feed that doesn't answer is a source that couldn't", async () => {
  const missing = ladderOver({ [FEED_URL]: { body: feedOf(itemWith("", "another-guid")), type: "application/rss+xml" } });
  assert.equal(await failureOf(missing.resolve(asking(EPISODE))), "video-unavailable");
  assert.equal(await failureOf(ladderOver({ [FEED_URL]: "down" }).resolve(asking(EPISODE))), "source-unavailable");
});

test("an item with no guid is the episode named by its audio address, as the reader names it", async () => {
  const item = `<item><title>Episode</title><enclosure url="https://media.example/ep.mp3" type="audio/mpeg"/><podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/></item>`;
  const { resolve } = ladderOver({
    [FEED_URL]: { body: feedOf(item), type: "application/rss+xml" },
    "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" },
  });
  const { answer } = await resolve(asking({ feedUrl: FEED_URL, guid: "https://media.example/ep.mp3" }));
  assert.equal(answer.via, "tag");
});

const NOTES_ITEM = `
  <item>
    <title>241. Susie Wiles Out, Stephen Miller In: What Happens Now?</title>
    <guid>ep-guid</guid>
    <pubDate>Tue, 10 Nov 2026 06:00:00 GMT</pubDate>
    <itunes:duration>2184</itunes:duration>
    <enclosure url="https://media.example/ep.mp3" type="audio/mpeg"/>
  </item>`;
const CAPTIONS: StoredTranscript = {
  videoId: "VIDEO000001" as StoredTranscript["videoId"],
  segments: [{ text: "Welcome back.", startMs: 0, endMs: 1500 }],
  generated: true,
  fetchedAt: "2026-11-12T00:00:00.000Z",
};

function youTubeServiceOver(player: { title: string; lengthSeconds: string }) {
  const calls: string[] = [];
  const service: NonNullable<PodcastTranscriptsOptions["youTubeService"]> = {
    onYouTube: async (operation) =>
      operation(async (request) => {
        const { videoId } = JSON.parse(request.body ?? "{}") as { videoId?: string };
        calls.push(`youtube:${request.url.split("/").at(-1)}${videoId === undefined ? "" : `:${videoId}`}`);
        return {
          status: 200,
          body: JSON.stringify({
            videoDetails: { videoId, title: player.title, lengthSeconds: player.lengthSeconds, shortDescription: "" },
            microformat: { playerMicroformatRenderer: { publishDate: "2026-11-10" } },
          }),
        };
      }),
    resolve: async (videoId) => {
      calls.push(`captions:${videoId}`);
      return { transcript: { ...CAPTIONS, videoId }, via: "cache" };
    },
  };
  return { service, calls };
}

const feedWithoutTags = { [FEED_URL]: { body: feedOf(NOTES_ITEM), type: "application/rss+xml" } };

test("a video the reader's extension found is checked by our server, and its captions kept under the episode's own key", async () => {
  const youTube = youTubeServiceOver({ title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", lengthSeconds: "2170" });
  const { resolve, kept } = ladderOver(feedWithoutTags, null, youTube.service);
  const { transcript, answer } = await resolve(asking(EPISODE, { videoId: "VIDEO000001" }));
  assert.deepEqual(answer, { via: "youtube", matchedBy: "title", searchedBy: "extension" });
  assert.equal(transcript.videoId, await podcastSourceKey(EPISODE));
  assert.deepEqual(transcript.segments, CAPTIONS.segments);
  assert.deepEqual(kept, [transcript]);
  assert.deepEqual(youTube.calls, ["youtube:player:VIDEO000001", "captions:VIDEO000001"]);
});

test("a video that isn't the episode by our server's check keeps nothing, and says so", async () => {
  const youTube = youTubeServiceOver({ title: "Something else entirely", lengthSeconds: "300" });
  const { resolve, kept } = ladderOver(feedWithoutTags, null, youTube.service);
  await assert.rejects(resolve(asking(EPISODE, { videoId: "VIDEO000001" })), (error) => error instanceof MatchUnconfirmedError);
  assert.deepEqual(kept, []);
  assert.deepEqual(youTube.calls, ["youtube:player:VIDEO000001"]);
});

test("asked to search, our server looks for the episode itself", async () => {
  const youTube = youTubeServiceOver({ title: "x", lengthSeconds: "1" });
  const { resolve } = ladderOver(feedWithoutTags, null, youTube.service);
  assert.equal(await failureOf(resolve(asking(EPISODE, { search: true }))), "no-captions");
  assert.equal(youTube.calls[0], "youtube:search");
});

test("a feed's own transcript wins, and YouTube isn't asked; nor is it when the caller didn't ask", async () => {
  const youTube = youTubeServiceOver({ title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", lengthSeconds: "2170" });
  const tagged = ladderOver(
    {
      [FEED_URL]: {
        body: feedOf(NOTES_ITEM.replace("</item>", `<podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/></item>`)),
        type: "application/rss+xml",
      },
      "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" },
    },
    null,
    youTube.service,
  );
  assert.equal((await tagged.resolve(asking(EPISODE, { videoId: "VIDEO000001" }))).answer.via, "tag");
  assert.equal(await failureOf(ladderOver(feedWithoutTags, null, youTube.service).resolve(asking(EPISODE))), "no-captions");
  assert.deepEqual(youTube.calls, []);
});

test("without our server's YouTube fetching, the YouTube rung says there are no captions", async () => {
  assert.equal(await failureOf(ladderOver(feedWithoutTags).resolve(asking(EPISODE, { videoId: "VIDEO000001" }))), "no-captions");
});
