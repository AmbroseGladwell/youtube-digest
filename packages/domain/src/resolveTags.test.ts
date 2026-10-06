import test from "node:test";
import assert from "node:assert/strict";
import { resolveTags } from "./resolveTags.js";

const vocabulary = (known: string[], aliases: Record<string, string | null> = {}) => ({
  known: new Set(known),
  aliases,
});

test("tags are normalised and repeats dropped", () => {
  assert.deepEqual(resolveTags(["SaaS", "saas", "Founder Interview"], vocabulary([])), ["saas", "founder-interview"]);
});

test("a plural folds onto the singular the reader already has, and the other way round", () => {
  assert.deepEqual(resolveTags(["startups", "habit"], vocabulary(["startup", "habits"])), ["startup", "habits"]);
});

test("a word that only looks plural is left alone when nothing matches it", () => {
  assert.deepEqual(resolveTags(["news", "analytics"], vocabulary(["pricing"])), ["news", "analytics"]);
});

test("a merged-away tag becomes the tag it was merged into", () => {
  assert.deepEqual(resolveTags(["micro-saas", "pricing"], vocabulary(["saas"], { "micro-saas": "saas" })), [
    "saas",
    "pricing",
  ]);
});

test("a deleted tag cannot come back", () => {
  assert.deepEqual(resolveTags(["nuclear", "energy"], vocabulary([], { nuclear: null })), ["energy"]);
});

test("a tag named like an object property is an ordinary tag", () => {
  assert.deepEqual(resolveTags(["constructor"], vocabulary([])), ["constructor"]);
});
