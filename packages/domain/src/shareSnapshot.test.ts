import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId, TopicId } from "./Brands.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { PRIVATE_OVERVIEW_FIELDS } from "./SharedNote.js";
import { SharedOverview } from "./SharedOverview.js";
import { shareSnapshot } from "./shareSnapshot.js";

const SIMILAR_ID = OverviewId.parse("c4a9f0d2-7b31-4e68-8f5a-0d1c2b3a4e5f");

const privateOverview = () =>
  makeOverview({
    captureReason: "Read before the Thursday review.",
    topicIds: [TopicId.parse("2f1c8e4a-9b76-4d35-8a21-6c0f5e3d7b94")],
    tags: ["energy-policy", "nuclear", "grids"],
    verdict: {
      novelty: "established",
      dubious: false,
      dubiousClaims: [],
      reasoning: "The capacity-market argument is well sourced.",
      similarTo: [{ overviewId: SIMILAR_ID, title: "What a capacity market actually pays for" }],
    },
  });

const snapshotOf = (overview = privateOverview()) =>
  shareSnapshot({ overview, transcript: null, narration: null });

test("none of the reader's own fields reach the shared copy", () => {
  const { note } = snapshotOf();

  for (const field of PRIVATE_OVERVIEW_FIELDS) {
    assert.equal(field in note, false, `${field} is in the shared copy`);
  }
});

test("the reader's other overviews are not named in a shared verdict", () => {
  const { note } = snapshotOf();

  assert.deepEqual(note.verdict?.similarTo, []);
  assert.equal(note.verdict?.reasoning, "The capacity-market argument is well sourced.");
});

test("what is shared parses as a shared copy, with the whole note in it", () => {
  const overview = privateOverview();

  const snapshot = SharedOverview.parse(snapshotOf(overview));

  assert.equal(snapshot.note.id, overview.id);
  assert.equal(snapshot.note.inOneLine, overview.inOneLine);
  assert.deepEqual(snapshot.note.keyPoints, overview.keyPoints);
});
