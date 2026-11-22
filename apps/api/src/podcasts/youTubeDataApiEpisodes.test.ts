import test from "node:test";
import assert from "node:assert/strict";
import type { EpisodeToFind, YouTubeFetch } from "@overview/transcripts";
import { isoDurationSeconds, youTubeDataApiEpisodes } from "./youTubeDataApiEpisodes.js";

const API_KEY = "test-youtube-key";
const NOW = new Date("2026-11-13T09:00:00.000Z");

interface FakeVideo {
  id: string;
  title: string;
  duration: string;
  description?: string;
  publishedAt?: string;
}

interface FakeChannel {
  id: string;
  title: string;
  videos: FakeVideo[];
}

// search, channels, playlistItems and videos, answered in the Data API's own shapes, and refused
// without the key in its header. The video search finds `searchFinds`, by default every video.
const dataApiOver = (channels: FakeChannel[], searchFinds?: readonly string[]) => {
  const asked: string[] = [];
  const youTubeFetch: YouTubeFetch = async (request) => {
    const url = new URL(request.url);
    const path = url.pathname.replace("/youtube/v3/", "");
    asked.push(path);
    if (request.headers["x-goog-api-key"] !== API_KEY || url.searchParams.has("key")) {
      return { status: 400, body: "{}" };
    }
    const json = (body: unknown) => ({ status: 200, body: JSON.stringify(body) });
    const every = channels.flatMap((channel) => channel.videos);
    if (path === "search") {
      assert.equal(url.searchParams.get("type"), "video");
      return json({
        items: channels
          .flatMap((channel) => channel.videos.map((video) => ({ channel, video })))
          .filter(({ video }) => searchFinds === undefined || searchFinds.includes(video.id))
          .slice(0, 10)
          .map(({ channel, video }) => ({
            id: { kind: "youtube#video", videoId: video.id },
            snippet: { channelId: channel.id, channelTitle: channel.title, title: video.title },
          })),
      });
    }
    if (path === "channels") {
      const ids = url.searchParams.get("id")!.split(",");
      return json({
        items: channels
          .filter((channel) => ids.includes(channel.id))
          .map((channel) => ({ id: channel.id, contentDetails: { relatedPlaylists: { uploads: `UU${channel.id}` } } })),
      });
    }
    if (path === "playlistItems") {
      const channel = channels.find((candidate) => `UU${candidate.id}` === url.searchParams.get("playlistId"))!;
      const start = Number(url.searchParams.get("pageToken") ?? "0");
      const next = start + 50 < channel.videos.length ? String(start + 50) : undefined;
      return json({
        ...(next === undefined ? {} : { nextPageToken: next }),
        items: channel.videos.slice(start, start + 50).map((video) => ({ contentDetails: { videoId: video.id } })),
      });
    }
    if (path === "videos") {
      const ids = url.searchParams.get("id")!.split(",");
      return json({
        items: every
          .filter((video) => ids.includes(video.id))
          .map((video) => ({
            id: video.id,
            snippet: { title: video.title, description: video.description ?? "", publishedAt: video.publishedAt ?? "2026-01-01T00:00:00Z" },
            contentDetails: { duration: video.duration },
          })),
      });
    }
    return { status: 404, body: "{}" };
  };
  return { episodes: youTubeDataApiEpisodes({ apiKey: API_KEY, youTubeFetch, now: () => NOW }), asked };
};

const EPISODE: EpisodeToFind = {
  showName: "The Rest Is Politics: US",
  title: "241. Susie Wiles Out, Stephen Miller In: What Happens Now?",
  durationSeconds: 2184,
  publishedAt: "2026-11-10T06:00:00.000Z",
  keywords: ["wiles", "miller", "chief", "staff", "white", "house", "deportation", "loyalty", "succession", "trump"],
};

const filler = (count: number, from = 0): FakeVideo[] =>
  Array.from({ length: count }, (_, index) => ({ id: `filler${from + index}`, title: `Another week ${from + index}`, duration: "PT40M" }));

test("ISO 8601 lengths become seconds, and nothing readable is no length", () => {
  assert.equal(isoDurationSeconds("PT36M24S"), 2184);
  assert.equal(isoDurationSeconds("PT1H56M"), 6960);
  assert.equal(isoDurationSeconds("P1DT1S"), 86_401);
  assert.equal(isoDurationSeconds("P0D"), null);
  assert.equal(isoDurationSeconds(undefined), null);
});

test("the episode is found by its title and length among a video search's results, for one quota unit", async () => {
  const { episodes, asked } = dataApiOver([
    {
      id: "rip",
      title: "The Rest Is Politics: US",
      videos: [
        { id: "clip00000001", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", duration: "PT4M" },
        { id: "episode00001", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", duration: "PT36M10S" },
      ],
    },
  ]);
  const search = await episodes.find(EPISODE);
  assert.deepEqual(search, {
    found: { videoId: "episode00001", channelTitle: "The Rest Is Politics: US", via: "title" },
    units: 1,
    searches: 1,
  });
  assert.deepEqual(asked, ["search", "videos"]);
});

test("an episode the search didn't list is looked for in more pages of the show's own channel only", async () => {
  const { episodes } = dataApiOver(
    [
      { id: "other", title: "Politics Daily Clips", videos: filler(50, 1000) },
      {
        id: "rip",
        title: "The Rest Is Politics: US",
        videos: [
          ...filler(120),
          { id: "episode00001", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", duration: "PT36M10S" },
        ],
      },
    ],
    ["filler1000", "filler0"],
  );
  const search = await episodes.find(EPISODE);
  assert.equal(search.found?.videoId, "episode00001");
  assert.equal(search.units, 1 + 1 + 2 * 3);
});

test("a retitled upload is found by its description and date, but not when a neighbour is as close", async () => {
  const retitled: FakeVideo = {
    id: "retitled0001",
    title: "Trump's new chief of staff",
    duration: "PT36M30S",
    publishedAt: "2026-11-10T08:00:00Z",
    description: "Wiles goes, Miller comes in as chief of staff at the White House: loyalty, deportation and the succession under Trump.",
  };
  const found = await dataApiOver(
    [{ id: "rip", title: "The Rest Is Politics: US", videos: [retitled, ...filler(3)] }],
    ["filler0"],
  ).episodes.find(EPISODE);
  assert.equal(found.found?.videoId, "retitled0001");
  assert.equal(found.found?.via, "description");

  const twin = { ...retitled, id: "retitled0002", publishedAt: "2026-11-11T08:00:00Z" };
  const tied = await dataApiOver(
    [{ id: "rip", title: "The Rest Is Politics: US", videos: [retitled, twin] }],
    ["retitled0001"],
  ).episodes.find(EPISODE);
  assert.equal(tied.found, null);
});

test("nothing found by the search is no match, after the one search", async () => {
  const { episodes, asked } = dataApiOver([]);
  assert.deepEqual(await episodes.find(EPISODE), { found: null, units: 0, searches: 1 });
  assert.deepEqual(asked, ["search"]);
});

const PUBLISHER = { id: "nytpods", title: "Politics Network Podcasts" };

test("on a publisher's channel that doesn't name the show, the episode is found by its title, length and date", async () => {
  const { episodes, asked } = dataApiOver([
    {
      ...PUBLISHER,
      videos: [
        {
          id: "onPublisher1",
          title: "Susie Wiles Out, Stephen Miller In: What Happens Now?",
          duration: "PT36M30S",
          publishedAt: "2026-11-10T16:30:00Z",
        },
      ],
    },
  ]);
  assert.deepEqual(await episodes.find(EPISODE), {
    found: { videoId: "onPublisher1", channelTitle: "Politics Network Podcasts", via: "title" },
    units: 1,
    searches: 1,
  });
  assert.deepEqual(asked, ["search", "videos"]);
});

test("the same title and length on another channel, a year apart, isn't the episode, and no channel naming the show is no deeper look", async () => {
  const { episodes, asked } = dataApiOver([
    {
      ...PUBLISHER,
      videos: [
        {
          id: "onPublisher1",
          title: "Susie Wiles Out, Stephen Miller In: What Happens Now?",
          duration: "PT36M30S",
          publishedAt: "2025-11-10T16:30:00Z",
        },
      ],
    },
  ]);
  assert.deepEqual(await episodes.find(EPISODE), { found: null, units: 1, searches: 1 });
  assert.deepEqual(asked, ["search", "videos"]);
});

test("one video is checked against the episode from its own details, for one unit", async () => {
  const { episodes, asked } = dataApiOver([
    {
      id: "rip",
      title: "The Rest Is Politics: US",
      videos: [
        { id: "episode00001", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", duration: "PT36M10S" },
        { id: "somethingels", title: "Something else entirely", duration: "PT5M" },
      ],
    },
  ]);
  assert.equal(await episodes.confirm(EPISODE, "episode00001"), "title");
  assert.equal(await episodes.confirm(EPISODE, "somethingels"), null);
  assert.equal(await episodes.confirm(EPISODE, "missing00001"), null);
  assert.deepEqual(asked, ["videos", "videos", "videos"]);
});

test("a refusal, as when the day's quota is spent, is an error rather than no match", async () => {
  const episodes = youTubeDataApiEpisodes({ apiKey: API_KEY, youTubeFetch: async () => ({ status: 403, body: "{}" }), now: () => NOW });
  await assert.rejects(episodes.find(EPISODE), /answered 403 to search/);
});
