import test from "node:test";
import assert from "node:assert/strict";
import { podcastIndexDirectory, podcastIndexHeaders } from "./podcastIndexDirectory.js";

const KEY = { apiKey: "KEY", apiSecret: "SECRET" };
const NOW = new Date("2025-11-14T09:00:00.000Z");

test("each request is signed with the SHA-1 of key, secret and time, and the secret itself is never sent", () => {
  assert.deepEqual(podcastIndexHeaders(KEY, NOW), {
    "X-Auth-Key": "KEY",
    "X-Auth-Date": "1763110800",
    Authorization: "70646934c7543c07aa78f378caed64d64faabb21",
  });
});

function directoryOver(answers: Record<string, unknown>) {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const directory = podcastIndexDirectory(
    KEY,
    async (url, headers) => {
      asked.push({ url, headers });
      const path = new URL(url).pathname.replace("/api/1.0/", "");
      if (!(path in answers)) throw new Error(`unexpected ${path}`);
      return answers[path];
    },
    () => NOW,
  );
  return { directory, asked };
}

test("a show is searched for by its name, and each feed found becomes a show with its feed", async () => {
  const { directory, asked } = directoryOver({
    "search/byterm": {
      status: "true",
      feeds: [
        { id: 920666, title: "A Show & Friends", url: "https://feeds.example/show.xml", itunesId: 42 },
        { id: 7, title: "No feed address", url: "" },
        { title: "No id" },
      ],
    },
  });
  assert.deepEqual(await directory.searchShows("A Show & Friends"), [
    { showId: "920666", showName: "A Show & Friends", feedUrl: "https://feeds.example/show.xml" },
    { showId: "7", showName: "No feed address", feedUrl: null },
  ]);
  assert.equal(asked[0]?.url, "https://api.podcastindex.org/api/1.0/search/byterm?q=A+Show+%26+Friends&max=10");
  assert.equal(asked[0]?.headers["X-Auth-Key"], "KEY");
});

test("a show's newest episodes come with their guids, dates from Unix seconds and lengths in seconds", async () => {
  const { directory, asked } = directoryOver({
    "podcasts/byfeedid": { status: "true", feed: { id: 920666, title: "A Show & Friends", url: "https://feeds.example/show.xml" } },
    "episodes/byfeedid": {
      status: "true",
      items: [
        { id: 1, title: "Episode 1", guid: "older-guid", datePublished: 1761987600, duration: 3725 },
        { id: 2, title: "Episode 2", guid: null, datePublished: 0, duration: 0 },
      ],
    },
  });
  assert.deepEqual(await directory.showWithEpisodes("920666"), {
    show: { showId: "920666", showName: "A Show & Friends", feedUrl: "https://feeds.example/show.xml" },
    episodes: [
      { episodeId: "1", guid: "older-guid", title: "Episode 1", publishedAt: "2025-11-01T09:00:00.000Z", durationSeconds: 3725 },
      { episodeId: "2", guid: null, title: "Episode 2", publishedAt: null, durationSeconds: null },
    ],
  });
  assert.ok(asked.some(({ url }) => url.endsWith("/episodes/byfeedid?id=920666&max=200")));
});

test("a feed it doesn't know is no show", async () => {
  const { directory } = directoryOver({
    "podcasts/byfeedid": { status: "true", feed: [] },
    "episodes/byfeedid": { status: "true", items: [] },
  });
  assert.equal(await directory.showWithEpisodes("1"), null);
});
