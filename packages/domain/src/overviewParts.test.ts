import test from "node:test";
import assert from "node:assert/strict";
import { overviewMarkdown } from "./overviewMarkdown.js";
import { makeOverview, makeRecipeOverview } from "./OverviewFactory.testHelper.js";
import { citedOverviewPart, overviewPartHash, overviewPartId, overviewParts, type OverviewPartItem } from "./overviewParts.js";
import type { Overview } from "./Overview.js";

const full = makeOverview({
  verdict: {
    novelty: "common_knowledge",
    standsOut: null,
    dubious: true,
    dubiousClaims: [
      { claim: "Creatine causes hair loss", basis: "contradictsSettled", reason: "One small study, never repeated.", startMs: 61_000 },
    ],
    reasoning: "Covers the basics.",
    similarTo: [],
  },
  sourceSteps: {
    items: [
      { text: "Take 3 g a day", range: null, dubiousReason: null },
      { text: "Skip loading", range: { startMs: 120_000, endMs: 130_000 }, dubiousReason: null },
    ],
  },
  howToApply: { items: ["Add it to your morning shake"] },
  selling: { type: "sponsor_or_affiliate", detail: "A supplement brand.", compromisesContent: false },
  watchAnyway: { answer: "no", reason: "The note covers it.", range: null },
  chapters: [{ title: "Dosing", summary: "How much to take.", startMs: 0, endMs: 60_000 }],
} as Partial<Overview>);

const ids = (items: readonly OverviewPartItem[]) => items.map(({ part, index }) => overviewPartId(part, index));
const idsInMarkdown = (markdown: string) => [...markdown.matchAll(/\[([a-z]+\d*)\]/g)].map((match) => match[1]);

test("the ids the prompt shows are exactly the parts an answer can cite, in the note's order", () => {
  assert.deepEqual(ids(overviewParts(full)), [
    "verdict",
    "dubious1",
    "kp1",
    "kp2",
    "kp3",
    "step1",
    "step2",
    "apply1",
    "sells",
    "anyway",
    "ch1",
  ]);
  assert.deepEqual(idsInMarkdown(overviewMarkdown(full, { partIds: true })), ids(overviewParts(full)));
});

test("a recipe's parts are its ingredients, its method and its chapters", () => {
  const recipe = makeRecipeOverview();
  const parts = overviewParts(recipe);
  assert.ok(parts.every(({ part }) => part === "ingredient" || part === "method" || part === "chapter"));
  assert.equal(parts.filter(({ part }) => part === "ingredient").length, recipe.recipe!.ingredients.length);
  assert.deepEqual(idsInMarkdown(overviewMarkdown(recipe, { partIds: true })), ids(parts));
});

test("the overview outside the app carries no ids", () => {
  assert.deepEqual(idsInMarkdown(overviewMarkdown(full)), []);
});

test("a selling of none is no part to cite", () => {
  const parts = overviewParts({ ...full, selling: { type: "none", detail: "", compromisesContent: false } });
  assert.ok(!parts.some(({ part }) => part === "selling"));
});

test("the hash is eight hex characters and ignores surrounding space", () => {
  assert.match(overviewPartHash("Take 3 g a day"), /^[0-9a-f]{8}$/);
  assert.equal(overviewPartHash(" Take 3 g a day\n"), overviewPartHash("Take 3 g a day"));
  assert.notEqual(overviewPartHash("Take 3 g a day"), overviewPartHash("Take 5 g a day"));
});

test("a citation lands on its item while the item still holds the cited text", () => {
  const citation = { part: "step" as const, index: 1, textHash: overviewPartHash("Skip loading") };
  assert.deepEqual(citedOverviewPart(full, citation), { part: "step", index: 1 });
});

test("a regenerated overview that moved the item is followed to where it went", () => {
  const citation = { part: "step" as const, index: 1, textHash: overviewPartHash("Skip loading") };
  const moved = { ...full, sourceSteps: { items: [full.sourceSteps!.items[1]!, full.sourceSteps!.items[0]!] } };
  assert.deepEqual(citedOverviewPart(moved, citation), { part: "step", index: 0 });
});

test("a regenerated overview that rewrote the item lands on the section", () => {
  const citation = { part: "step" as const, index: 1, textHash: overviewPartHash("Skip loading") };
  const rewritten = { ...full, sourceSteps: { items: [{ text: "Something else", range: null, dubiousReason: null }] } };
  assert.deepEqual(citedOverviewPart(rewritten, citation), { part: "step", index: null });
});

test("a regenerated overview without the section lands nowhere", () => {
  const citation = { part: "step" as const, index: 1, textHash: overviewPartHash("Skip loading") };
  assert.equal(citedOverviewPart({ ...full, sourceSteps: null }, citation), null);
});
