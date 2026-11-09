import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_ABOUT_YOU } from "./AboutYou.js";
import { composeReaderContext, MAX_READER_CONTEXT_LENGTH } from "./composeReaderContext.js";
import type { LearnedItem } from "./LearnedItem.js";

const item = (text: string, overrides: Partial<LearnedItem> = {}): LearnedItem => ({
  text,
  source: "From 2 overviews",
  learnedAt: "2026-11-01T10:00:00.000Z",
  noticedAt: "2026-11-01T11:00:00.000Z",
  removedAt: null,
  ...overrides,
});

test("nothing known is no context at all", () => {
  assert.equal(composeReaderContext(EMPTY_ABOUT_YOU), null);
});

test("learned items follow the sentence, and a removed one is left out", () => {
  const context = composeReaderContext(
    { ...EMPTY_ABOUT_YOU, who: ["dad"] },
    { app: item("building an app"), gym: item("training for strength", { removedAt: "2026-11-02T10:00:00.000Z" }) },
  );

  assert.equal(context, "I'm a dad. Also: building an app.");
});

test("an item the reader hasn't been shown yet is left out until it has been", () => {
  const aboutYou = { ...EMPTY_ABOUT_YOU, who: ["dad"] };

  assert.equal(composeReaderContext(aboutYou, { app: item("building an app", { noticedAt: null }) }), "I'm a dad.");
  assert.equal(composeReaderContext(aboutYou, { app: item("building an app") }), "I'm a dad. Also: building an app.");
});

test("learned items alone are a context", () => {
  assert.equal(composeReaderContext(EMPTY_ABOUT_YOU, { app: item("building an app") }), "Also: building an app.");
});

test("past the cap the oldest learned items are dropped whole, and the sentence stays", () => {
  const learned = Object.fromEntries(
    Array.from({ length: 40 }, (_, index) => [
      String(index),
      item(`learned thing number ${index}`, { learnedAt: `2026-10-${String(index % 28 + 1).padStart(2, "0")}T10:00:00.000Z` }),
    ]),
  );
  const context = composeReaderContext({ ...EMPTY_ABOUT_YOU, who: ["dad"] }, learned)!;

  assert.ok(context.length <= MAX_READER_CONTEXT_LENGTH);
  assert.ok(context.startsWith("I'm a dad. Also: learned thing number 27;"));
  assert.ok(context.endsWith("."));
});
