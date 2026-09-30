import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { transcriptFault } from "./transcriptFault.js";

const VIDEO = VideoId.parse("example");

test("an ordinary transcript has no fault", () => {
  assert.equal(transcriptFault(makeStoredTranscript(), VIDEO), null);
});

test("a transcript with no segments is faulted", () => {
  assert.equal(transcriptFault(makeStoredTranscript({ segments: [] }), VIDEO), "no-segments");
});

test("a transcript whose every segment is blank is faulted", () => {
  const blank = makeStoredTranscript({ segments: [{ text: "  ", startMs: 0, endMs: 1000 }, { text: "", startMs: 1000, endMs: 2000 }] });
  assert.equal(transcriptFault(blank, VIDEO), "no-words");
});

test("a segment that ends before it starts is faulted", () => {
  const inverted = makeStoredTranscript({ segments: [{ text: "Said.", startMs: 2000, endMs: 1000 }] });
  assert.equal(transcriptFault(inverted, VIDEO), "times-out-of-order");
});

test("segments that start earlier than the one before are faulted", () => {
  const backwards = makeStoredTranscript({
    segments: [
      { text: "Later.", startMs: 5000, endMs: 6000 },
      { text: "Earlier.", startMs: 0, endMs: 1000 },
    ],
  });
  assert.equal(transcriptFault(backwards, VIDEO), "times-out-of-order");
});

test("segments sharing a start time are not faulted, since one caption can hold two", () => {
  const shared = makeStoredTranscript({
    segments: [
      { text: "One.", startMs: 0, endMs: 1000 },
      { text: "Two.", startMs: 0, endMs: 1500 },
    ],
  });
  assert.equal(transcriptFault(shared, VIDEO), null);
});

test("a transcript whose metadata names another video is faulted", () => {
  const transcript = makeStoredTranscript();
  const mismatched = { ...transcript, video: { ...transcript.video!, id: VideoId.parse("another") } };
  assert.equal(transcriptFault(mismatched, VIDEO), "another-video");
});

test("a transcript kept before metadata was stored has no fault for lacking it", () => {
  const { video: _video, ...withoutVideo } = makeStoredTranscript();
  assert.equal(transcriptFault(withoutVideo, VIDEO), null);
});
