import test from "node:test";
import assert from "node:assert/strict";
import { parsePodcastLink } from "./parsePodcastLink.js";

test("an Apple episode link carries the show's id and the episode's", () => {
  assert.deepEqual(parsePodcastLink("https://podcasts.apple.com/us/podcast/the-daily/id1200361736?i=1000801496509"), {
    platform: "apple",
    showId: "1200361736",
    episodeId: "1000801496509",
  });
  assert.deepEqual(parsePodcastLink("https://itunes.apple.com/gb/podcast/id1200361736?i=1000801496509&uo=4"), {
    platform: "apple",
    showId: "1200361736",
    episodeId: "1000801496509",
  });
});

test("an Apple link with no episode is a show, not an episode", () => {
  assert.deepEqual(parsePodcastLink("https://podcasts.apple.com/us/podcast/the-daily/id1200361736"), { platform: "apple-show" });
});

test("a Spotify episode is found in a share link, a regional link and the app's own address", () => {
  const episode = { platform: "spotify", episodeId: "3Ma0w3NWINtFGibeApfhgE" };
  assert.deepEqual(parsePodcastLink("https://open.spotify.com/episode/3Ma0w3NWINtFGibeApfhgE?si=abc123"), episode);
  assert.deepEqual(parsePodcastLink("https://open.spotify.com/intl-de/episode/3Ma0w3NWINtFGibeApfhgE"), episode);
  assert.deepEqual(parsePodcastLink("spotify:episode:3Ma0w3NWINtFGibeApfhgE"), episode);
});

test("Spotify's short links are followed later, since only the redirect says which episode", () => {
  assert.deepEqual(parsePodcastLink("https://spotify.link/AbCdEf"), { platform: "spotify-short", url: "https://spotify.link/AbCdEf" });
});

test("a Spotify show, or anything Spotify that isn't an episode, is not read as one", () => {
  assert.deepEqual(parsePodcastLink("https://open.spotify.com/show/3IM0lmZxpFAY7CwMuv9H4g"), { platform: "spotify-show" });
  assert.equal(parsePodcastLink("https://open.spotify.com/track/3Ma0w3NWINtFGibeApfhgE"), null);
  assert.equal(parsePodcastLink("https://open.spotify.com/episode/too-short"), null);
});

test("any other web address is a page that may be an episode's own", () => {
  assert.deepEqual(parsePodcastLink("https://www.buzzsprout.com/1/episodes/2"), {
    platform: "page",
    url: "https://www.buzzsprout.com/1/episodes/2",
  });
});

test("what isn't a web address isn't a link", () => {
  assert.equal(parsePodcastLink("not a link"), null);
  assert.equal(parsePodcastLink("ftp://example.com/episode"), null);
});
