import test from "node:test";
import assert from "node:assert/strict";
import { pickEpisode, sameEpisode } from "./sameEpisode.js";

const wanted = {
  title: "What Jensen Huang’s Resignation Will Mean for A.I.",
  publishedAt: "2026-11-12T10:52:00.000Z",
  durationSeconds: 1479,
};

test("the same title is the same episode, whatever its quotes, case and punctuation", () => {
  assert.ok(
    sameEpisode(wanted, {
      title: "what jensen huang's resignation will mean for A.I",
      publishedAt: "2026-11-12T10:52:06.000Z",
      durationSeconds: 1480,
    }),
  );
});

test("what isn't known can't disagree", () => {
  assert.ok(sameEpisode(wanted, { title: wanted.title, publishedAt: null, durationSeconds: null }));
});

test("a rerun under its old title is told apart by the date", () => {
  assert.equal(sameEpisode(wanted, { ...wanted, publishedAt: "2025-06-01T10:00:00.000Z" }), false);
});

test("a length that disagrees by more than a minute or 2% is another episode", () => {
  assert.equal(sameEpisode(wanted, { ...wanted, durationSeconds: 1479 + 120 }), false);
  assert.ok(sameEpisode({ ...wanted, durationSeconds: 6000 }, { ...wanted, durationSeconds: 6100 }));
});

test("a near title is not the same title: a confident wrong match is worse than none", () => {
  assert.equal(sameEpisode(wanted, { ...wanted, title: "What Jensen Huang’s Resignation Will Mean for A.I. (Part 2)" }), false);
  assert.equal(sameEpisode({ ...wanted, title: "!!!" }, { ...wanted, title: "???" }), false);
});

test("of several matches, the closest in date wins", () => {
  const near = { ...wanted, publishedAt: "2026-11-12T12:00:00.000Z", id: "near" };
  const far = { ...wanted, publishedAt: "2026-11-13T22:00:00.000Z", id: "far" };
  assert.equal(pickEpisode(wanted, [far, near])?.id, "near");
  assert.equal(pickEpisode(wanted, [{ ...wanted, title: "Other", id: "other" }]), null);
});
