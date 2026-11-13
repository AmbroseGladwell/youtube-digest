import test from "node:test";
import assert from "node:assert/strict";
import { Response } from "undici";
import type { PodcastRead } from "@overview/domain";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { createPodcastReader } from "./createPodcastReader.js";
import { feedOf, FEED_ITEM_NEWEST, FEED_ITEM_OLDER } from "./podcastFeedFixtures.testHelper.js";

type Answer = { body: string; type: string; url?: string } | "missing" | "down";

const FEED_URL = "https://feeds.example/show.xml";
const APPLE_EPISODE = "https://podcasts.apple.com/gb/podcast/a-show/id42?i=1001";
const SPOTIFY_EPISODE = "3Ma0w3NWINtFGibeApfhgE";

const json = (value: unknown): Answer => ({ body: JSON.stringify(value), type: "application/json" });
const xml = (body: string): Answer => ({ body, type: "application/rss+xml" });
const html = (body: string, url?: string): Answer => ({ body, type: "text/html; charset=utf-8", ...(url === undefined ? {} : { url }) });

const appleShow = (feedUrl: string | null = FEED_URL) => ({
  wrapperType: "track",
  kind: "podcast",
  collectionId: 42,
  collectionName: "A Show & Friends",
  ...(feedUrl === null ? {} : { feedUrl }),
});
const appleEpisode = (trackId: number, guid: string, trackName: string, releaseDate: string) => ({
  wrapperType: "podcastEpisode",
  trackId,
  trackName,
  episodeGuid: guid,
  releaseDate,
  trackTimeMillis: 3_725_000,
});
const LOOKUP = "https://itunes.apple.com/lookup?id=42&entity=podcastEpisode&limit=200";
const SEARCH = "https://itunes.apple.com/search?term=A%20Show%20%26%20Friends&media=podcast&entity=podcast&limit=10";
const spotifyPage = (title: string, released: string) =>
  html(`<html><head>
    <meta name="description" content="Listen to this episode from A Show &amp; Friends on Spotify. Notes.">
    <meta name="music:release_date" content="${released}">
    <meta name="music:duration" content="3725">
    <meta property="og:title" content="${title}">
  </head><body></body></html>`);

function readerOver(web: Record<string, Answer>) {
  const asked: string[] = [];
  const fetchPublicWeb = async (link: string): Promise<PublicWebAnswer> => {
    asked.push(link);
    const answer = web[link];
    if (answer === undefined || answer === "missing") return { status: "failed", reason: "missing" };
    if (answer === "down") return { status: "failed", reason: "no-answer" };
    return {
      status: "answered",
      url: answer.url ?? link,
      response: new Response(answer.body, { headers: { "content-type": answer.type } }),
    };
  };
  return { read: createPodcastReader({ fetchPublicWeb }), asked };
}

const episodeOf = (read: PodcastRead) => {
  assert.equal(read.status, "read", JSON.stringify(read));
  return read.status === "read" ? read.episode : assert.fail();
};

test("an Apple link finds its episode's guid in Apple's directory, then the episode in the show's feed", async () => {
  const { read } = readerOver({
    [LOOKUP]: json({ results: [appleShow(), appleEpisode(1001, "older-guid", "Episode 1: The “Start”", "2026-11-01T09:00:00Z")] }),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  const episode = episodeOf(await read(APPLE_EPISODE));
  assert.equal(episode.guid, "older-guid");
  assert.equal(episode.showName, "A Show & Friends");
  assert.equal(episode.audioUrl, "https://media.example/ep1.mp3");
  assert.equal(episode.imageUrl, "https://cdn.example/show.jpg");
  assert.equal(episode.linkFrom, "apple");
  assert.equal(episode.transcripts.length, 2);
});

test("an Apple episode too old for the directory's newest 200 is found by the title on its page", async () => {
  const { read } = readerOver({
    [LOOKUP]: json({ results: [appleShow(), appleEpisode(1002, "newest-guid", "Episode 2", "2026-11-12T10:00:00Z")] }),
    [APPLE_EPISODE]: html(`<html><head><meta property="og:title" content="Episode 1: The “Start”"></head></html>`),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  assert.equal(episodeOf(await read(APPLE_EPISODE)).guid, "older-guid");
});

test("an Apple show with no public feed says so, by name", async () => {
  const { read } = readerOver({ [LOOKUP]: json({ results: [appleShow(null)] }) });
  assert.deepEqual(await read(APPLE_EPISODE), { status: "failed", reason: "no-public-feed", showName: "A Show & Friends" });
});

test("a Spotify link is matched through Apple's directory to the same show's feed, and a rerun's old date loses", async () => {
  const { read } = readerOver({
    [`https://open.spotify.com/episode/${SPOTIFY_EPISODE}`]: spotifyPage("Episode 1: The “Start”", "2026-11-01T09:00:00Z"),
    [SEARCH]: json({ results: [appleShow()] }),
    [LOOKUP]: json({
      results: [
        appleShow(),
        appleEpisode(1003, "rerun-guid", "Episode 1: The “Start”", "2026-11-10T09:00:00Z"),
        appleEpisode(1001, "older-guid", "Episode 1: The “Start”", "2026-11-01T09:00:00Z"),
      ],
    }),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  const episode = episodeOf(await read(`https://open.spotify.com/episode/${SPOTIFY_EPISODE}?si=abc`));
  assert.equal(episode.guid, "older-guid");
  assert.equal(episode.linkFrom, "spotify");
});

test("a Spotify show Apple's directory doesn't know is reported as having no public feed: likely a Spotify exclusive", async () => {
  const { read } = readerOver({
    [`https://open.spotify.com/episode/${SPOTIFY_EPISODE}`]: spotifyPage("Exclusive", "2026-11-01T09:00:00Z"),
    [SEARCH]: json({ results: [{ ...appleShow(), collectionName: "A Different Show" }] }),
  });
  assert.deepEqual(await read(`spotify:episode:${SPOTIFY_EPISODE}`), {
    status: "failed",
    reason: "no-public-feed",
    showName: "A Show & Friends",
  });
});

test("a Spotify episode missing from a public show's feed is not found, rather than matched to another", async () => {
  const { read } = readerOver({
    [`https://open.spotify.com/episode/${SPOTIFY_EPISODE}`]: spotifyPage("Bonus: only on Spotify", "2026-11-01T09:00:00Z"),
    [SEARCH]: json({ results: [appleShow()] }),
    [LOOKUP]: json({ results: [appleShow()] }),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  assert.deepEqual(await read(`https://open.spotify.com/episode/${SPOTIFY_EPISODE}`), {
    status: "failed",
    reason: "not-found",
    showName: "A Show & Friends",
  });
});

test("a Spotify short link is followed to the episode it names", async () => {
  const { read } = readerOver({
    "https://spotify.link/AbC": html("<html></html>", `https://open.spotify.com/episode/${SPOTIFY_EPISODE}`),
    [`https://open.spotify.com/episode/${SPOTIFY_EPISODE}`]: spotifyPage("Episode 2", "2026-11-12T10:00:00Z"),
    [SEARCH]: json({ results: [appleShow()] }),
    [LOOKUP]: json({ results: [appleShow(), appleEpisode(1002, "newest-guid", "Episode 2", "2026-11-12T10:00:00Z")] }),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  assert.equal(episodeOf(await read("https://spotify.link/AbC")).guid, "newest-guid");
});

test("a show's own episode page leads to its feed, and the episode is the item that links back to the page", async () => {
  const { read } = readerOver({
    "https://show.example/episodes/1/": html(
      `<html><head><title>Something else</title><link rel="alternate" type="application/rss+xml" href="${FEED_URL}"></head></html>`,
    ),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  const episode = episodeOf(await read("https://show.example/episodes/1/"));
  assert.equal(episode.guid, "older-guid");
  assert.equal(episode.linkFrom, "page");
});

const episodeSearch = (term: string) =>
  `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&entity=podcastEpisode&limit=10`;
const OMNY_STYLE_PAGE = "https://host.example/shows/a-show/episode-1";
const omnyStylePage = html(`<html><head><meta property="og:title" content="Episode 1: The “Start” - A Show &amp; Friends"></head></html>`);
const searchedEpisode = (collectionName: string) =>
  json({
    results: [
      {
        ...appleEpisode(1001, "older-guid", "Episode 1: The “Start”", "2026-11-01T09:00:00Z"),
        collectionId: 42,
        collectionName,
        feedUrl: FEED_URL,
      },
    ],
  });

test("a page that names no feed is found in Apple's directory by its title, when the page also names the show", async () => {
  const { read } = readerOver({
    [OMNY_STYLE_PAGE]: omnyStylePage,
    [episodeSearch("Episode 1: The “Start” - A Show & Friends")]: json({ results: [] }),
    [episodeSearch("Episode 1: The “Start”")]: searchedEpisode("A Show & Friends"),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST, FEED_ITEM_OLDER)),
  });
  const episode = episodeOf(await read(OMNY_STYLE_PAGE));
  assert.equal(episode.guid, "older-guid");
  assert.equal(episode.linkFrom, "page");
});

test("an episode of the same title from a show the page doesn't name is not taken", async () => {
  const { read } = readerOver({
    [OMNY_STYLE_PAGE]: omnyStylePage,
    [episodeSearch("Episode 1: The “Start” - A Show & Friends")]: json({ results: [] }),
    [episodeSearch("Episode 1: The “Start”")]: searchedEpisode("Someone Else's Show"),
  });
  assert.deepEqual(await read(OMNY_STYLE_PAGE), { status: "failed", reason: "not-an-episode", showName: null });
});

test("a page with no feed, a feed itself, and a show's link are not episodes", async () => {
  const { read } = readerOver({
    "https://news.example/story": html("<html><head><title>News</title></head></html>"),
    [episodeSearch("News")]: json({ results: [] }),
    [FEED_URL]: xml(feedOf(FEED_ITEM_NEWEST)),
  });
  for (const link of [
    "https://news.example/story",
    FEED_URL,
    "https://podcasts.apple.com/gb/podcast/a-show/id42",
    "https://open.spotify.com/show/3IM0lmZxpFAY7CwMuv9H4g",
  ]) {
    assert.deepEqual(await read(link), { status: "failed", reason: "not-an-episode", showName: null }, link);
  }
});

test("a directory or feed that doesn't answer is reported as no answer, not as a missing episode", async () => {
  assert.deepEqual(await readerOver({ [LOOKUP]: "down" }).read(APPLE_EPISODE), { status: "failed", reason: "no-answer", showName: null });
  const feedDown = readerOver({
    [LOOKUP]: json({ results: [appleShow(), appleEpisode(1001, "older-guid", "Episode 1", "2026-11-01T09:00:00Z")] }),
    [FEED_URL]: "down",
  });
  assert.deepEqual(await feedDown.read(APPLE_EPISODE), { status: "failed", reason: "no-answer", showName: "A Show & Friends" });
});

test("a feed that isn't one is unreadable", async () => {
  const { read } = readerOver({
    [LOOKUP]: json({ results: [appleShow(), appleEpisode(1001, "older-guid", "Episode 1", "2026-11-01T09:00:00Z")] }),
    [FEED_URL]: html("<html><body>Gone</body></html>"),
  });
  assert.deepEqual(await read(APPLE_EPISODE), { status: "failed", reason: "feed-unreadable", showName: "A Show & Friends" });
});
