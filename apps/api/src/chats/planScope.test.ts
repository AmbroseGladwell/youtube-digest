import test from "node:test";
import assert from "node:assert/strict";
import type { Overview } from "@overview/domain";
import { noteAbout } from "../testing/meaningFixtures.testHelper.js";
import { planScope, type ChatPlan, type OverviewMarks } from "./planScope.js";

const ANY: ChatPlan["filters"] = { read: "any", favourite: "any", kinds: [], topics: [], savedFrom: "", savedTo: "", novelty: [] };

const library = () => {
  const at = (savedAt: string): Overview => noteAbout(`saved ${savedAt}`, ["One", "Two", "Three"], { savedAt });
  const overviews = [at("2026-09-10T09:00:00.000Z"), at("2026-10-05T09:00:00.000Z"), at("2026-11-20T09:00:00.000Z")];
  const labels = new Map(overviews.map((overview, index) => [`O${index + 1}`, overview]));
  const marks = new Map<string, OverviewMarks>([
    [overviews[0]!.id, { read: true, favourite: true, topics: ["Health"] }],
    [overviews[1]!.id, { read: false, favourite: false, topics: ["Business"] }],
  ]);
  return { labels, marks };
};

test("no filters keep the whole scope and say it wasn't filtered", () => {
  const { labels, marks } = library();
  assert.deepEqual(planScope(ANY, labels, marks), { kept: ["O1", "O2", "O3"], filtered: false });
});

test("read, favourite, topic and saved days narrow the scope, an overview with no marks counting as unread", () => {
  const { labels, marks } = library();
  assert.deepEqual(planScope({ ...ANY, read: "unread" }, labels, marks).kept, ["O2", "O3"]);
  assert.deepEqual(planScope({ ...ANY, favourite: "only" }, labels, marks).kept, ["O1"]);
  assert.deepEqual(planScope({ ...ANY, topics: ["health"] }, labels, marks).kept, ["O1"]);
  assert.deepEqual(planScope({ ...ANY, savedFrom: "2026-10-01", savedTo: "2026-10-31" }, labels, marks).kept, ["O2"]);
});

test("a topic the library doesn't have, or a day that isn't one, is dropped instead of emptying the scope", () => {
  const { labels, marks } = library();
  assert.deepEqual(planScope({ ...ANY, topics: ["Gardening"], savedFrom: "last week" }, labels, marks), {
    kept: ["O1", "O2", "O3"],
    filtered: false,
  });
  assert.deepEqual(planScope({ ...ANY, topics: ["Gardening", "Business"] }, labels, marks), { kept: ["O2"], filtered: true });
});

test("kind and novelty filter on the overview itself, and an overview with no verdict has no novelty", () => {
  const { labels, marks } = library();
  assert.deepEqual(planScope({ ...ANY, kinds: ["recipe"] }, labels, marks).kept, []);
  assert.deepEqual(planScope({ ...ANY, kinds: ["video"] }, labels, marks).kept, ["O1", "O2", "O3"]);
  const [first] = [...labels.values()];
  const judged = new Map(
    [...labels].map(([label, overview]) => [label, overview === first ? withNovelty(overview) : { ...overview, verdict: null }]),
  );
  assert.deepEqual(planScope({ ...ANY, novelty: ["original"] }, judged, marks).kept, ["O1"]);
});

const withNovelty = (overview: Overview): Overview => ({
  ...overview,
  verdict: { novelty: "original", standsOut: null, dubious: false, dubiousClaims: null, reasoning: "New.", similarTo: [] },
});
