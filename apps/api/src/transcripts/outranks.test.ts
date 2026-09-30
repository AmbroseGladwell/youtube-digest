import test from "node:test";
import assert from "node:assert/strict";
import { makeStoredTranscript } from "@overview/store-conformance";
import { outranks } from "./outranks.js";

const { video: _video, ...withoutVideo } = makeStoredTranscript();

test("a copy as good as the one held does not replace it", () => {
  assert.equal(outranks(makeStoredTranscript(), makeStoredTranscript()), false);
});

test("a copy written by a person outranks a machine-heard one", () => {
  assert.equal(outranks(makeStoredTranscript({ generated: false }), makeStoredTranscript({ generated: true })), true);
});

test("a machine-heard copy never outranks one written by a person, even carrying metadata the held one lacks", () => {
  assert.equal(outranks(makeStoredTranscript({ generated: true }), { ...withoutVideo, generated: false }), false);
});

test("between two copies of the same kind, the one carrying its video's metadata outranks the one without", () => {
  assert.equal(outranks(makeStoredTranscript(), withoutVideo), true);
});
