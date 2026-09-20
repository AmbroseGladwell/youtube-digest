import test from "node:test";
import assert from "node:assert/strict";
import { mapJson3ToSegments } from "./mapJson3ToSegments.js";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { JSON3_WITH_NOISE, JSON3_WRITTEN } from "./PlayerResponseFactory.testHelper.js";

test("a cue's times are YouTube's own, with the end being start plus the duration it gave", () => {
  const segments = mapJson3ToSegments(JSON3_WRITTEN);

  assert.deepEqual(segments, [
    { text: "How much LSD should\nyou give an elephant?", startMs: 0, endMs: 2706 },
    { text: "(mellow music)\nWell, to a reasonable person,", startMs: 2706, endMs: 4320 },
  ]);
});

test("window definitions, rolling appends and whitespace-only cues are not transcript", () => {
  const segments = mapJson3ToSegments(JSON3_WITH_NOISE);

  assert.deepEqual(
    segments.map((segment) => segment.text),
    ["How much", ">> And here is the answer."],
  );
});

test("the pieces of a cue are joined into one, rather than becoming a segment each", () => {
  const [first] = mapJson3ToSegments(JSON3_WITH_NOISE);

  assert.equal(first?.text, "How much");
});

test("a cue with no duration ends where it starts, rather than borrowing the next cue's", () => {
  const [, second] = mapJson3ToSegments(JSON3_WITH_NOISE);

  assert.equal(second?.startMs, 4400);
  assert.equal(second?.endMs, 4400);
});

test("a speaker marker is left in the text, because stripping it is the reader's job", () => {
  const [, second] = mapJson3ToSegments(JSON3_WITH_NOISE);

  assert.ok(second?.text.startsWith(">>"));
});

test("a track that answers with no cues at all is the source being turned away, not a video without captions", () => {
  assert.throws(
    () => mapJson3ToSegments(JSON.stringify({ events: [] })),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "source-blocked");
      return true;
    },
  );
});

test("a body that is not json3 is a malformed response rather than a crash", () => {
  assert.throws(
    () => mapJson3ToSegments("<?xml version=\"1.0\"?><timedtext/>"),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "malformed-response");
      return true;
    },
  );
});
