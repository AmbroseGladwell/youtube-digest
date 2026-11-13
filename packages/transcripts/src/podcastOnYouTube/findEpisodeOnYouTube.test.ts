import test from "node:test";
import assert from "node:assert/strict";
import type { YouTubeFetchRequest } from "../YouTubeFetch.js";
import { findEpisodeOnYouTube } from "./findEpisodeOnYouTube.js";
import type { EpisodeToFind } from "./matchUpload.js";
import { episodeKeywords } from "./noteWords.js";
import { nextPageAnswer, searchAnswer, videosTabAnswer, type UploadRow } from "./youTubeListingFixtures.testHelper.js";

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
  search?: unknown;
  browse?: Record<string, unknown>;
  players?: Record<string, { description: string; published: string }>;
}

function youTubeOver({ search = searchAnswer(SHOW), browse = {}, players = {} }: Script) {
  const asked: string[] = [];
  const youTubeFetch = async ({ url, body }: YouTubeFetchRequest) => {
    const payload = JSON.parse(body ?? "{}") as { browseId?: string; continuation?: string; videoId?: string };
    if (url.endsWith("/search")) {
      asked.push("search");
      return { status: 200, body: JSON.stringify(search) };
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
}

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
  assert.deepEqual(asked, ["search", "browse:UCshow"]);
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
  assert.deepEqual(asked, ["search", "browse:UCshow", "browse:UCother", "browse:page2", "browse:page3"]);
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
