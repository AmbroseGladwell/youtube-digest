import test from "node:test";
import assert from "node:assert/strict";
import type { YouTubeFetchRequest } from "../YouTubeFetch.js";
import { findEpisodeOnYouTube } from "./findEpisodeOnYouTube.js";
import type { EpisodeToFind } from "./matchUpload.js";
import { episodeKeywords } from "./noteWords.js";
import { nextPageAnswer, searchAnswer, videoSearchAnswer, videosTabAnswer, type UploadRow } from "./youTubeListingFixtures.testHelper.js";

const NOW = new Date("2026-11-13T12:00:00.000Z");
const SHOW = { channelId: "UCshow", title: "The Rest Is Politics US" };
const OTHER = { channelId: "UCother", title: "Politics Clips Daily" };

const episode: EpisodeToFind = {
  showName: "The Rest Is Politics: US",
  title: "241. Susie Wiles Out, Stephen Miller In: What Happens Now?",
  durationSeconds: 2184,
  publishedAt: "2026-11-10T06:00:00.000Z",
  keywords: episodeKeywords(
    "Anthony Scaramucci and Katty Kay discuss the departure of Susie Wiles, Stephen Miller's promotion, the shutdown talks and Mamdani.",
    [],
  ),
};

const filler = (count: number, from = 0): UploadRow[] =>
  Array.from({ length: count }, (_, index) => ({
    videoId: `f${from + index}`,
    title: `Another episode ${from + index}`,
    length: "41:00",
    age: "2 months ago",
  }));

interface Script {
  videoSearch?: unknown;
  search?: unknown;
  browse?: Record<string, unknown>;
  players?: Record<string, { description: string; published: string }>;
}

const youTubeOver = ({ videoSearch = videoSearchAnswer(), search = searchAnswer(SHOW), browse = {}, players = {} }: Script) => {
  const asked: string[] = [];
  const youTubeFetch = async ({ url, body }: YouTubeFetchRequest) => {
    const payload = JSON.parse(body ?? "{}") as { browseId?: string; continuation?: string; videoId?: string; params?: string };
    if (url.endsWith("/search")) {
      const forVideos = payload.params === "EgIQAQ==";
      asked.push(forVideos ? "search:videos" : "search");
      return { status: 200, body: JSON.stringify(forVideos ? videoSearch : search) };
    }
    if (url.endsWith("/browse")) {
      const key = payload.continuation ?? payload.browseId ?? "";
      asked.push(`browse:${key}`);
      const answer = browse[key];
      return answer === undefined ? { status: 404, body: "" } : { status: 200, body: JSON.stringify(answer) };
    }
    asked.push(`player:${payload.videoId}`);
    const player = players[payload.videoId ?? ""];
    return player === undefined
      ? { status: 404, body: "" }
      : {
          status: 200,
          body: JSON.stringify({
            playabilityStatus: { status: "OK" },
            videoDetails: { videoId: payload.videoId, shortDescription: player.description },
            microformat: { playerMicroformatRenderer: { publishDate: player.published } },
          }),
        };
  };
  return { youTubeFetch, asked };
};

const find = (script: Script, wanted: EpisodeToFind = episode) => {
  const youTube = youTubeOver(script);
  return { result: findEpisodeOnYouTube(youTube.youTubeFetch, wanted, { now: () => NOW }), asked: youTube.asked };
};

test("the episode's title on an upload of its length, on the show's first page, is the episode", async () => {
  const { result, asked } = find({
    browse: {
      UCshow: videosTabAnswer([
        ...filler(3),
        {
          videoId: "match",
          title: "Susie Wiles Out, Stephen Miller In: What Happens Now? | The Rest Is Politics US",
          length: "36:01",
          age: "3 days ago",
        },
      ]),
    },
  });
  assert.deepEqual(await result, { videoId: "match", channelTitle: SHOW.title, via: "title" });
  assert.deepEqual(asked, ["search:videos", "search", "browse:UCshow"]);
});

test("a clip with the episode's title isn't the episode", async () => {
  const { result } = find({
    browse: {
      UCshow: videosTabAnswer([
        { videoId: "clip", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", length: "8:12", age: "3 days ago" },
      ]),
    },
  });
  assert.equal(await result, null);
});

test("an older episode is found further down the show's uploads, page by page", async () => {
  const { result, asked } = find({
    search: searchAnswer(SHOW, OTHER),
    browse: {
      UCshow: videosTabAnswer(filler(30), "page2"),
      UCother: videosTabAnswer(filler(30, 100)),
      page2: nextPageAnswer(filler(30, 30), "page3"),
      page3: nextPageAnswer([
        { videoId: "match", title: "241. Susie Wiles Out, Stephen Miller In: What Happens Now?", length: "36:24", age: "3 days ago" },
      ]),
    },
  });
  assert.equal((await result)?.videoId, "match");
  assert.deepEqual(asked, ["search:videos", "search", "browse:UCshow", "browse:UCother", "browse:page2", "browse:page3"]);
});

test("a retitled upload is the episode when its description carries the episode's own words, on its date", async () => {
  const { result } = find({
    browse: {
      UCshow: videosTabAnswer([
        { videoId: "retitled", title: "It's Official: Trump's Grift IS OUT OF CONTROL", length: "36:10", age: "3 days ago" },
        { videoId: "neighbour", title: "Trump Has Lost MAGA: What Next?", length: "36:30", age: "4 days ago" },
      ]),
    },
    players: {
      retitled: {
        description:
          "Anthony Scaramucci and Katty Kay on the departure of Susie Wiles, Stephen Miller's promotion, the shutdown talks and Mamdani.",
        published: "2026-11-10T03:00:00-08:00",
      },
      neighbour: { description: "Anthony and Katty on the midterms.", published: "2026-11-09T03:00:00-08:00" },
    },
  });
  assert.deepEqual(await result, { videoId: "retitled", channelTitle: SHOW.title, via: "description" });
});

test("two uploads whose descriptions match about as well can't be told apart, so neither is taken", async () => {
  const description =
    "Anthony Scaramucci and Katty Kay on the departure of Susie Wiles, Stephen Miller's promotion, the shutdown talks and Mamdani.";
  const { result } = find({
    browse: {
      UCshow: videosTabAnswer([
        { videoId: "a", title: "Part one", length: "36:10", age: "3 days ago" },
        { videoId: "b", title: "Part two", length: "36:20", age: "3 days ago" },
      ]),
    },
    players: { a: { description, published: "2026-11-10T03:00:00-08:00" }, b: { description, published: "2026-11-10T05:00:00-08:00" } },
  });
  assert.equal(await result, null);
});

test("a matching description on an upload from another week isn't the episode", async () => {
  const { result } = find({
    browse: { UCshow: videosTabAnswer([{ videoId: "late", title: "Another title", length: "36:10", age: "3 days ago" }]) },
    players: {
      late: {
        description:
          "Anthony Scaramucci and Katty Kay on the departure of Susie Wiles, Stephen Miller's promotion, the shutdown talks and Mamdani.",
        published: "2026-11-01T03:00:00-08:00",
      },
    },
  });
  assert.equal(await result, null);
});

test("no channel named for the show means the episode isn't looked for by description", async () => {
  const { result, asked } = find({
    search: searchAnswer(OTHER),
    browse: { UCother: videosTabAnswer([{ videoId: "x", title: "Another title", length: "36:10", age: "3 days ago" }]) },
    players: { x: { description: episode.keywords.join(" "), published: "2026-11-10T03:00:00-08:00" } },
  });
  assert.equal(await result, null);
  assert.ok(!asked.some((request) => request.startsWith("player:")));
});

test("YouTube turning the search away is reported as the named failure the ladder reads", async () => {
  const youTubeFetch = async () => ({ status: 429, body: "" });
  await assert.rejects(findEpisodeOnYouTube(youTubeFetch, episode), { failure: "rate-limited" });
});

const PUBLISHER = { channelId: "UCpublisher", channelTitle: "Politics Network Podcasts" };
const THE_EPISODE = { videoId: "onPublisher", title: "Susie Wiles Out, Stephen Miller In: What Happens Now?", length: "36:30" };

test("on a publisher's channel that doesn't name the show, the episode is found by a video search, by title, length and date", async () => {
  const { result, asked } = find({ videoSearch: videoSearchAnswer({ ...THE_EPISODE, age: "2 days ago", ...PUBLISHER }) });
  assert.deepEqual(await result, { videoId: "onPublisher", channelTitle: "Politics Network Podcasts", via: "title" });
  assert.deepEqual(asked, ["search:videos"]);
});

test("the same title and length on another channel, from another month, isn't the episode", async () => {
  const { result, asked } = find({
    videoSearch: videoSearchAnswer({ ...THE_EPISODE, age: "1 year ago", ...PUBLISHER }),
    browse: { UCshow: videosTabAnswer(filler(3)) },
  });
  assert.equal(await result, null);
  assert.deepEqual(asked.slice(0, 2), ["search:videos", "search"]);
});

test("on the show's own channel, a video search result needs only its title and length", async () => {
  const { result } = find({
    videoSearch: videoSearchAnswer({ ...THE_EPISODE, age: "1 year ago", channelId: SHOW.channelId, channelTitle: SHOW.title }),
  });
  assert.equal((await result)?.videoId, "onPublisher");
});

test("a clip with the episode's title in the video search isn't the episode", async () => {
  const { result } = find({
    videoSearch: videoSearchAnswer({ ...THE_EPISODE, length: "4:12", age: "2 days ago", ...PUBLISHER }),
    browse: { UCshow: videosTabAnswer(filler(3)) },
  });
  assert.equal(await result, null);
});
