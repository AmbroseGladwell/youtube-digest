import test from "node:test";
import assert from "node:assert/strict";
import type { NoteLine } from "./NoteLine.js";
import { elapsedSecondsBefore, noteTiming } from "./noteTiming.js";

const body = (text: string): NoteLine => ({ section: "Summary", heading: false, bullet: false, text });

const wordsLine = (count: number) => body(Array.from({ length: count }, () => "word").join(" "));

test("both times come from the note's own words, never from a guess", () => {
  const timing = noteTiming([wordsLine(660)]);

  assert.equal(timing.readMinutes, 3);
  assert.equal(timing.listenMinutes, 4);
});

test("a note shorter than a minute rounds up to one, and an empty note stays at zero", () => {
  assert.equal(noteTiming([wordsLine(12)]).readMinutes, 1);
  assert.equal(noteTiming([]).listenMinutes, 0);
});

test("a short line is held for a minimum beat so a three-word heading isn't a flash", () => {
  const timing = noteTiming([body("Key points"), wordsLine(150)]);

  assert.equal(timing.lineSeconds[0], 1.5);
  assert.equal(timing.lineSeconds[1], 60);
  assert.equal(timing.totalSeconds, 61.5);
});

test("the elapsed time before a line sums the lines already read, and is zero on the first", () => {
  const timing = noteTiming([wordsLine(150), wordsLine(300), wordsLine(150)]);

  assert.equal(elapsedSecondsBefore(timing, 0), 0);
  assert.equal(elapsedSecondsBefore(timing, 2), 180);
});
