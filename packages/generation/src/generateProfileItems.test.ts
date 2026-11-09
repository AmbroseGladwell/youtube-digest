import test from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "./GenerationError.js";
import type { GenerationClient } from "./generateOverview.js";
import { generateProfileItems } from "./generateProfileItems.js";

const overview = (title: string, topics: string[]) => ({ title, premise: "A premise.", topics, captureReason: null });
const INPUT = {
  sentence: "I'm a dad.",
  learned: ["training for strength"],
  removed: ["saving for a home"],
  overviews: [overview("One", ["Startups"]), overview("Two", ["Startups", "Tech"]), overview("Three", ["Tech"])],
};
const answering =
  (items: unknown): GenerationClient =>
  async () => ({ items });

test("code counts the overviews behind an item and names their most common topic", async () => {
  const items = await generateProfileItems(answering([{ text: "building a consumer app", overviewIndices: [0, 1, 1] }]), INPUT);

  assert.deepEqual(items, [{ text: "building a consumer app", source: "From 2 overviews on startups" }]);
});

test("an item resting on one overview is dropped, and so is an index that doesn't exist", async () => {
  const items = await generateProfileItems(answering([{ text: "one video", overviewIndices: [0, 9] }]), INPUT);

  assert.deepEqual(items, []);
});

test("a removed item never comes back, whatever its case, and nor does one already held", async () => {
  const items = await generateProfileItems(
    answering([
      { text: "Saving for a Home", overviewIndices: [0, 1] },
      { text: "training  for strength", overviewIndices: [0, 1] },
    ]),
    INPUT,
  );

  assert.deepEqual(items, []);
});

test("the removed list reaches the model", async () => {
  let message = "";
  await generateProfileItems(async ({ userMessage }) => {
    message = userMessage;
    return { items: [] };
  }, INPUT);

  assert.match(message, /Removed by the reader:\n- saving for a home/);
});

test("too many items fail their schema", async () => {
  const item = { text: "x", overviewIndices: [0, 1] };

  await assert.rejects(() => generateProfileItems(answering([item, item, item]), INPUT), GenerationError);
});
