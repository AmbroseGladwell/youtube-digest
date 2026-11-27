import test from "node:test";
import assert from "node:assert/strict";
import { hostPrice, speechDetail } from "./speechCost.js";

const PRICES = { fly: 0.1955, modal: 0.59 };

test("Modal work is priced at the card it ran on, and an unlisted card at the dearest", () => {
  assert.equal(hostPrice(PRICES, "modal", "Tesla T4"), 0.59);
  assert.equal(hostPrice(PRICES, "modal", "NVIDIA A10"), 1.1);
  assert.equal(hostPrice(PRICES, "modal", "Some Future Card"), 1.95);
});

test("without a reported card Modal falls back to its configured price, and Fly always uses its own", () => {
  assert.equal(hostPrice(PRICES, "modal", null), 0.59);
  assert.equal(hostPrice(PRICES, "fly", "Tesla T4"), 0.1955);
  assert.equal(hostPrice({ fly: null, modal: null }, "fly", null), null);
});

test("Fly's details keep their names, and Modal's say so", () => {
  assert.equal(speechDetail("chat", "fly"), "chat");
  assert.equal(speechDetail("narration", "modal"), "narration-modal");
});
