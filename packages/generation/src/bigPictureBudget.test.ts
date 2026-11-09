import test from "node:test";
import assert from "node:assert/strict";
import { BIG_PICTURE_MAX_WORDS } from "@overview/domain";
import { bigPictureBudget, mostBigPictureWords } from "./bigPictureBudget.js";

test("a short source earns no big picture, and each step up in length earns more", () => {
  assert.equal(bigPictureBudget(0), 0);
  assert.equal(bigPictureBudget(1000), 0);
  assert.equal(bigPictureBudget(1001), 35);
  assert.equal(bigPictureBudget(2500), 35);
  assert.equal(bigPictureBudget(2501), 60);
  assert.equal(bigPictureBudget(6001), 90);
  assert.equal(bigPictureBudget(15_001), 120);
  assert.equal(bigPictureBudget(40_000), 120);
});

test("the cap sits above the target and never past what the record keeps", () => {
  assert.equal(mostBigPictureWords(60), 75);
  assert.ok(mostBigPictureWords(bigPictureBudget(40_000)) <= BIG_PICTURE_MAX_WORDS);
});
