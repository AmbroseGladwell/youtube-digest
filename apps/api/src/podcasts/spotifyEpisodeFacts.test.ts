import test from "node:test";
import assert from "node:assert/strict";
import { pageMeta } from "./pageMeta.js";
import { spotifyEpisodeFacts } from "./spotifyEpisodeFacts.js";

const SPOTIFY_PAGE = `<!DOCTYPE html><html><head>
<title>What Jensen Huang’s Resignation Will Mean for A.I. - The Daily | Podcast on Spotify</title>
<meta name="description" content="Listen to this episode from The Daily on Spotify. This episode was recorded before…"/>
<meta name="music:duration" content="1479"/>
<meta name="music:release_date" content="2026-11-12T10:52:00Z"/>
<meta property="og:title" content="What Jensen Huang’s Resignation Will Mean for A.I."/>
<meta property="og:description" content="The Daily · Episode"/>
</head><body><meta property="og:title" content="Not this one"/></body></html>`;

test("a Spotify episode page names the episode, its show, its date and its length", () => {
  assert.deepEqual(spotifyEpisodeFacts(pageMeta(SPOTIFY_PAGE, "https://open.spotify.com/episode/x")), {
    title: "What Jensen Huang’s Resignation Will Mean for A.I.",
    showName: "The Daily",
    publishedAt: "2026-11-12T10:52:00.000Z",
    durationSeconds: 1479,
  });
});

test("the show is taken from the short description when the long one doesn't say", () => {
  const page = SPOTIFY_PAGE.replace(/<meta name="description"[^>]*>/, "");
  assert.equal(spotifyEpisodeFacts(pageMeta(page, "https://open.spotify.com/episode/x"))?.showName, "The Daily");
});

test("a page with no title isn't an episode", () => {
  assert.equal(spotifyEpisodeFacts(pageMeta("<html><head></head></html>", "https://open.spotify.com/episode/x")), null);
});

test("a show's own episode page points to its feed, and relative links are made whole", () => {
  const meta = pageMeta(
    `<html><head><title> Ep 1 </title><link rel="alternate" type="application/rss+xml" href="/feed.xml"><link rel="canonical" href="https://show.example/episodes/1"></head></html>`,
    "https://show.example/episodes/1?ref=x",
  );
  assert.equal(meta.feedUrl, "https://show.example/feed.xml");
  assert.equal(meta.canonicalUrl, "https://show.example/episodes/1");
  assert.equal(meta.title, "Ep 1");
});
