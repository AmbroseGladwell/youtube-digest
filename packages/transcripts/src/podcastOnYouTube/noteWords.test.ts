import test from "node:test";
import assert from "node:assert/strict";
import { episodeKeywords, noteWords } from "./noteWords.js";
import { ageInDays, clockSeconds } from "./youTubeListings.js";

test("words of four letters or more are compared, without links, case or accents", () => {
  assert.deepEqual([...noteWords("The Café at https://example.com/tracking?x=1 SERVES Crème brûlée to all")].sort(), [
    "brulee",
    "cafe",
    "creme",
    "serves",
  ]);
});

test("what the show repeats in its other episodes isn't the episode's own", () => {
  const others = Array.from(
    { length: 10 },
    (_, index) => `Episode ${index} about topic${index}. Sponsored by Squarespace. Follow us everywhere.`,
  );
  const keywords = episodeKeywords("Today Katty Kay explains the shutdown. Sponsored by Squarespace. Follow us everywhere.", others);
  assert.deepEqual(keywords.sort(), ["explains", "katty", "shutdown", "today"]);
});

test("with too few other episodes to judge by, every word is kept", () => {
  assert.ok(episodeKeywords("Sponsored by Squarespace", ["Sponsored by Squarespace"]).includes("squarespace"));
});

test("a listing's length and age are read as they are shown", () => {
  assert.equal(clockSeconds("1:02:05"), 3725);
  assert.equal(clockSeconds("31:52"), 1912);
  assert.equal(clockSeconds("LIVE"), null);
  assert.deepEqual(ageInDays("3 days ago"), { fewest: 2.5, most: 4.5 });
  assert.deepEqual(ageInDays("Streamed 2 weeks ago"), { fewest: 13, most: 21 });
  assert.deepEqual(ageInDays("5 hours ago"), { fewest: 0, most: 1.1 });
  assert.equal(ageInDays("Premieres tomorrow"), null);
});
