import test from "node:test";
import assert from "node:assert/strict";
import { makeStoredTranscript } from "@overview/store-conformance";
import { wordsHash } from "./wordsHash.js";

const said = (...texts: string[]) =>
  makeStoredTranscript({ segments: texts.map((text, index) => ({ text, startMs: index * 1000, endMs: index * 1000 + 1000 })) });

test("the same words cut into different segments hash the same", () => {
  assert.equal(wordsHash(said("Hello and welcome.", "Here is the claim.")), wordsHash(said("Hello and", "welcome. Here is the claim.")));
});

test("case, punctuation and spacing do not change the hash", () => {
  assert.equal(wordsHash(said("Hello, and  WELCOME!")), wordsHash(said("hello and welcome")));
});

test("when the captions were fetched, and what the video is called, do not change the hash", () => {
  const first = said("Hello and welcome.");
  const later = { ...first, fetchedAt: "2026-10-01T00:00:00.000Z", video: { ...first.video!, title: "Renamed" } };
  assert.equal(wordsHash(first), wordsHash(later));
});

test("a different word changes the hash", () => {
  assert.notEqual(wordsHash(said("Buy this product.")), wordsHash(said("Skip this product.")));
});

test("the same words machine-heard and written by a person hash differently", () => {
  const written = said("Hello and welcome.");
  assert.notEqual(wordsHash(written), wordsHash({ ...written, generated: true }));
});

test("words in other scripts are kept rather than stripped as punctuation", () => {
  assert.notEqual(wordsHash(said("你好")), wordsHash(said("再见")));
});
