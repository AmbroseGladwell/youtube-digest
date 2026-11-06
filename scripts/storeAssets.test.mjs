import test from "node:test";
import assert from "node:assert/strict";
import { artworkFit, markBox } from "./storeAssets.mjs";

test("the artwork fills the store's 96px and is centred in its 128px square", () => {
  const fit = artworkFit({ canvas: 128, artwork: 96 });
  // The mark is taller than it is wide, so height is what meets the 96.
  assert.equal(Math.round(fit.height), 96);
  assert.equal(Math.round(fit.top), 16);
  assert.ok(fit.width < fit.height);
  assert.equal(Math.round(fit.left * 2 + fit.width), 128);
});

test("a square mark would fill both axes and pad evenly", () => {
  const fit = artworkFit({ canvas: 128, artwork: 96, box: { x: 0, y: 0, width: 10, height: 10 } });
  assert.equal(fit.width, 96);
  assert.equal(fit.height, 96);
  assert.equal(fit.left, 16);
  assert.equal(fit.top, 16);
});

test("the viewBox is the mark's own ink, not its 32-unit canvas", () => {
  assert.equal(artworkFit({ canvas: 128, artwork: 96 }).viewBox, "7 5.5 18 22");
  assert.deepEqual(markBox, { x: 7, y: 5.5, width: 18, height: 22 });
});
