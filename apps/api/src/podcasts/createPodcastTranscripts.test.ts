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
  type PodcastTranscriptRequest,
  type PodcastTranscriptsOptions,
  type YouTubeAsk,
} from "./createPodcastTranscripts.js";
import { feedOf } from "./podcastFeedFixtures.testHelper.js";
import type { EpisodeWordSource, KnownWordSource } from "./EpisodeWordSourcesRepository.js";
import type { YouTubeEpisodes } from "./youTubeDataApiEpisodes.js";

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

const NOW = new Date("2026-11-13T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function ladderOver(
  web: Record<string, Answer>,
  known: EpisodeWordSource | null = null,
  youTube: { service: PodcastTranscriptsOptions["youTubeService"]; episodes: YouTubeEpisodes } | null = null,
  knownSince: Date = NOW,
) {
  const asked: string[] = [];
  const sources = new Map<string, KnownWordSource>();
  const kept = () => [...sources.values()].map(({ source }) => source);
  const keptSince = () => [...sources.values()].map(({ foundAt }) => foundAt.toISOString());
  const fetchPublicWeb = async (link: string): Promise<PublicWebAnswer> => {
    asked.push(link);
    const answer = web[link];
    if (answer === undefined) return { status: "failed", reason: "missing" };
    if (answer === "down") return { status: "failed", reason: "no-answer" };
    return { status: "answered", url: link, response: new Response(answer.body, { headers: { "content-type": answer.type } }) };
  };
  const ready = podcastSourceKey(EPISODE).then((key) => {
    if (known !== null) sources.set(key, { source: known, foundAt: knownSince });
  });
  const podcastTranscripts = createPodcastTranscripts({
    fetchPublicWeb,
    sources: {
      get: async (key) => sources.get(key) ?? null,
      put: async (key, source, at) => {
        sources.set(key, { source, foundAt: at });
      },
      forget: async (key) => {
        sources.delete(key);
      },
    },
    youTubeService: youTube?.service ?? null,
    youTubeEpisodes: youTube?.episodes ?? null,
    clock: () => NOW,
  });
  const resolve = async (request: PodcastTranscriptRequest) => {
    await ready;
    return podcastTranscripts.resolve(request);
  };
  const remembered: typeof podcastTranscripts.remembered = async (...args) => {
    await ready;
    return podcastTranscripts.remembered(...args);
  };
  return { resolve, remembered, asked, kept, keptSince };
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

test("the feed's transcript tag answers, timed, under the episode's own key, and only where it was found is kept", async () => {
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
  assert.deepEqual(kept(), [{ via: "tag", url: "https://t.example/ep.vtt", type: "text/vtt" }]);
});

test("where the words were found answers next time, fetched afresh from there, without the feed being asked", async () => {
  const { resolve, asked } = ladderOver(
    { "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" } },
    { via: "tag", url: "https://t.example/ep.vtt", type: "text/vtt" },
  );
  const { transcript, answer } = await resolve(asking(EPISODE));
  assert.deepEqual(answer, { via: "remembered", from: "tag" });
  assert.deepEqual(transcript.segments, [{ text: "Hello there.", startMs: 1000, endMs: 3000 }]);
  assert.deepEqual(asked, ["https://t.example/ep.vtt"]);
});

test("a source that no longer answers is forgotten, and the episode's own feed is read again", async () => {
  const { resolve, asked, kept } = ladderOver(
    {
      [FEED_URL]: {
        body: feedOf(itemWith(`<podcast:transcript url="https://t.example/new.vtt" type="text/vtt"/>`)),
        type: "application/rss+xml",
      },
      "https://t.example/new.vtt": { body: VTT, type: "text/vtt" },
    },
    { via: "tag", url: "https://t.example/gone.vtt", type: "text/vtt" },
  );
  assert.deepEqual((await resolve(asking(EPISODE))).answer, { via: "tag", format: "vtt" });
  assert.deepEqual(asked, ["https://t.example/gone.vtt", FEED_URL, "https://t.example/new.vtt"]);
  assert.deepEqual(kept(), [{ via: "tag", url: "https://t.example/new.vtt", type: "text/vtt" }]);
});

test("a reader's other device, holding only the episode's key, gets the words from where they were found, and nothing without", async () => {
  const key = await podcastSourceKey(EPISODE);
  const known = ladderOver(
    { "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" } },
    { via: "tag", url: "https://t.example/ep.vtt", type: "text/vtt" },
  );
  await known.resolve(asking(EPISODE));
  const words = await known.remembered(key, asking(EPISODE).caller, log);
  assert.deepEqual(words?.segments, [{ text: "Hello there.", startMs: 1000, endMs: 3000 }]);
  const unknown = ladderOver({});
  assert.equal(await unknown.remembered(key, asking(EPISODE).caller, log), null);
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
  assert.deepEqual(kept(), []);
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

// Our server's YouTube, scripted: what the Data API's check says of a video, what its search
// finds, and the captions any video has. The matching rules themselves are
// youTubeDataApiEpisodes.test.ts's.
function youTubeOver({ confirms = null, finds = null }: { confirms?: "title" | "description" | null; finds?: string | null }) {
  const calls: string[] = [];
  const episodes: YouTubeEpisodes = {
    confirm: async (_episode, videoId) => {
      calls.push(`confirm:${videoId}`);
      return confirms;
    },
    find: async () => {
      calls.push("search");
      return { found: finds === null ? null : { videoId: finds, channelTitle: "The Show", via: "title" }, units: 3, searches: 1 };
    },
  };
  const service: NonNullable<PodcastTranscriptsOptions["youTubeService"]> = {
    resolve: async (videoId) => {
      calls.push(`captions:${videoId}`);
      return { transcript: { ...CAPTIONS, videoId }, via: "direct" };
    },
  };
  return { youTube: { service, episodes }, calls };
}

const feedWithoutTags = { [FEED_URL]: { body: feedOf(NOTES_ITEM), type: "application/rss+xml" } };

test("a video the reader's extension found is checked by our server, its captions answer under the episode's own key, and the video is remembered", async () => {
  const { youTube, calls } = youTubeOver({ confirms: "title" });
  const { resolve, kept, keptSince } = ladderOver(feedWithoutTags, null, youTube);
  const { transcript, answer } = await resolve(asking(EPISODE, { videoId: "VIDEO000001" }));
  assert.deepEqual(answer, { via: "youtube", matchedBy: "title", searchedBy: "extension" });
  assert.equal(transcript.videoId, await podcastSourceKey(EPISODE));
  assert.deepEqual(transcript.segments, CAPTIONS.segments);
  assert.deepEqual(kept(), [{ via: "youtube", videoId: "VIDEO000001" }]);
  assert.deepEqual(keptSince(), [NOW.toISOString()]);
  assert.deepEqual(calls, ["confirm:VIDEO000001", "captions:VIDEO000001"]);
});

test("a remembered video gives its captions without the episode being looked for again", async () => {
  const { youTube, calls } = youTubeOver({});
  const { resolve, asked } = ladderOver({}, { via: "youtube", videoId: "VIDEO000001" }, youTube, new Date(NOW.getTime() - 29 * DAY_MS));
  const { transcript, answer } = await resolve(asking(EPISODE, { search: true }));
  assert.deepEqual(answer, { via: "remembered", from: "youtube" });
  assert.deepEqual(transcript.segments, CAPTIONS.segments);
  assert.deepEqual(calls, ["captions:VIDEO000001"]);
  assert.deepEqual(asked, []);
});

test("a video remembered past 30 days is checked against the episode again, and kept another 30 if it still is", async () => {
  const { youTube, calls } = youTubeOver({ confirms: "title" });
  const { resolve, keptSince } = ladderOver(
    feedWithoutTags,
    { via: "youtube", videoId: "VIDEO000001" },
    youTube,
    new Date(NOW.getTime() - 31 * DAY_MS),
  );
  const { answer } = await resolve(asking(EPISODE));
  assert.deepEqual(answer, { via: "remembered", from: "youtube" });
  assert.deepEqual(calls, ["confirm:VIDEO000001", "captions:VIDEO000001"]);
  assert.deepEqual(keptSince(), [NOW.toISOString()]);
});

test("a video remembered past 30 days that no longer checks out is forgotten, and the episode is searched for afresh", async () => {
  const { youTube, calls } = youTubeOver({ confirms: null, finds: "VIDEO000002" });
  const { resolve, kept } = ladderOver(
    feedWithoutTags,
    { via: "youtube", videoId: "VIDEO000001" },
    youTube,
    new Date(NOW.getTime() - 31 * DAY_MS),
  );
  const { answer } = await resolve(asking(EPISODE, { search: true }));
  assert.deepEqual(answer, { via: "youtube", matchedBy: "title", searchedBy: "server" });
  assert.deepEqual(calls, ["confirm:VIDEO000001", "search", "captions:VIDEO000002"]);
  assert.deepEqual(kept(), [{ via: "youtube", videoId: "VIDEO000002" }]);
});

test("a reader's other device gets a remembered video only within its 30 days, since checking it again needs the feed", async () => {
  const { youTube } = youTubeOver({});
  const key = await podcastSourceKey(EPISODE);
  const fresh = ladderOver({}, { via: "youtube", videoId: "VIDEO000001" }, youTube, new Date(NOW.getTime() - 29 * DAY_MS));
  assert.notEqual(await fresh.remembered(key, asking(EPISODE).caller, log), null);
  const stale = ladderOver({}, { via: "youtube", videoId: "VIDEO000001" }, youTube, new Date(NOW.getTime() - 31 * DAY_MS));
  assert.equal(await stale.remembered(key, asking(EPISODE).caller, log), null);
});

test("a video that isn't the episode by our server's check keeps nothing, and says so", async () => {
  const { youTube, calls } = youTubeOver({ confirms: null });
  const { resolve, kept } = ladderOver(feedWithoutTags, null, youTube);
  await assert.rejects(resolve(asking(EPISODE, { videoId: "VIDEO000001" })), (error) => error instanceof MatchUnconfirmedError);
  assert.deepEqual(kept(), []);
  assert.deepEqual(calls, ["confirm:VIDEO000001"]);
});

test("asked to search, our server looks for the episode itself, and finding nothing says there are no captions", async () => {
  const { youTube, calls } = youTubeOver({ finds: null });
  const { resolve } = ladderOver(feedWithoutTags, null, youTube);
  assert.equal(await failureOf(resolve(asking(EPISODE, { search: true }))), "no-captions");
  assert.deepEqual(calls, ["search"]);
});

test("a Data API that refuses, as when the day's quota is spent, is a source that couldn't answer", async () => {
  const { youTube } = youTubeOver({});
  youTube.episodes.find = async () => {
    throw new Error("The YouTube Data API answered 403 to search");
  };
  const { resolve } = ladderOver(feedWithoutTags, null, youTube);
  assert.equal(await failureOf(resolve(asking(EPISODE, { search: true }))), "source-unavailable");
});

test("a feed's own transcript wins, and YouTube isn't asked; nor is it when the caller didn't ask", async () => {
  const { youTube, calls } = youTubeOver({ confirms: "title" });
  const tagged = ladderOver(
    {
      [FEED_URL]: {
        body: feedOf(NOTES_ITEM.replace("</item>", `<podcast:transcript url="https://t.example/ep.vtt" type="text/vtt"/></item>`)),
        type: "application/rss+xml",
      },
      "https://t.example/ep.vtt": { body: VTT, type: "text/vtt" },
    },
    null,
    youTube,
  );
  assert.equal((await tagged.resolve(asking(EPISODE, { videoId: "VIDEO000001" }))).answer.via, "tag");
  assert.equal(await failureOf(ladderOver(feedWithoutTags, null, youTube).resolve(asking(EPISODE))), "no-captions");
  assert.deepEqual(calls, []);
});

test("without our server's YouTube, the YouTube rung says there are no captions", async () => {
  assert.equal(await failureOf(ladderOver(feedWithoutTags).resolve(asking(EPISODE, { videoId: "VIDEO000001" }))), "no-captions");
});
