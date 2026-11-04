import test from "node:test";
import assert from "node:assert/strict";
import { recipeActions } from "./recipeActions.js";

const step = (text: string) => ({ text, group: null });
const pieces = (text: string) => recipeActions([step(text)]).map(({ text: piece }) => piece);

test("a step splits at the end of each sentence", () => {
  assert.deepEqual(pieces("Heat the oil in a large pan. Add the onions and cook for 10 minutes until soft. Stir in the garlic."), [
    "Heat the oil in a large pan.",
    "Add the onions and cook for 10 minutes until soft.",
    "Stir in the garlic.",
  ]);
});

test("a step of one sentence is one action", () => {
  assert.deepEqual(pieces("Stir occasionally."), ["Stir occasionally."]);
});

test("abbreviations, temperatures, decimals and ranges stay inside their sentence", () => {
  assert.deepEqual(pieces("Bake for approx. 25 minutes at 180°C. Cool for 1.5 hours, e.g. on a rack."), [
    "Bake for approx. 25 minutes at 180°C.",
    "Cool for 1.5 hours, e.g. on a rack.",
  ]);
  assert.deepEqual(pieces("Cook for 20 - 30 minutes (no lid), adding water if needed."), ["Cook for 20 - 30 minutes (no lid), adding water if needed."]);
});

test("a temperature ending a sentence still ends it", () => {
  assert.deepEqual(pieces("Heat the oven to 200C. Line a tray."), ["Heat the oven to 200C.", "Line a tray."]);
});

test("', then' and a verb starts a new action that reads '…then', and the comma goes", () => {
  assert.deepEqual(pieces("Scoop out a mug of pasta cooking water and set aside, then drain the pasta."), [
    "Scoop out a mug of pasta cooking water and set aside",
    "…then drain the pasta.",
  ]);
});

test("', then' before a thing rather than a doing stays in one piece", () => {
  assert.deepEqual(pieces("Mix in the flour, then the chips."), ["Mix in the flour, then the chips."]);
  assert.deepEqual(pieces("Weigh your flour; or measure it by gently spooning it into a cup, then sweeping off any excess."), [
    "Weigh your flour; or measure it by gently spooning it into a cup, then sweeping off any excess.",
  ]);
  assert.deepEqual(pieces("Beat the butter until creamy, then gradually beat in the sugar."), ["Beat the butter until creamy, then gradually beat in the sugar."]);
  assert.deepEqual(pieces("Spread with 2 cups of Ragu, then 1 cup of Cheese Sauce."), ["Spread with 2 cups of Ragu, then 1 cup of Cheese Sauce."]);
});

test("'then' without a comma, as in a list of ingredients, never splits", () => {
  assert.deepEqual(pieces("Add bean sprouts, tofu, noodles then Sauce."), ["Add bean sprouts, tofu, noodles then Sauce."]);
});

test("an 'If' sentence keeps its ', then' so the second half keeps its condition", () => {
  const [action] = recipeActions([step("If you're using a bread machine, add everything to the pan, then skip to step 7.")]);
  assert.equal(action?.text, "If you're using a bread machine, add everything to the pan, then skip to step 7.");
  assert.equal(action?.condition, "If you're using a bread machine,");
});

test("semicolons, dashes and colons inside a sentence never split", () => {
  assert.deepEqual(pieces("Don't over-knead the dough; it should hold together. Cook until soft - they should not brown."), [
    "Don't over-knead the dough; it should hold together.",
    "Cook until soft - they should not brown.",
  ]);
});

test("a short label before ' - ' or ':' at a step's start is lifted, and each action carries it", () => {
  const actions = recipeActions([step("Cook beef - Turn heat up to high. Add the beef.")]);
  assert.deepEqual(
    actions.map(({ label, text }) => [label, text]),
    [
      ["Cook beef", "Turn heat up to high."],
      ["Cook beef", "Add the beef."],
    ],
  );
  assert.equal(recipeActions([step("Marinade: Combine the ingredients.")])[0]?.label, "Marinade");
  assert.equal(recipeActions([step("To make pizza later: Allow the dough to rise.")])[0]?.label, "To make pizza later");
});

test("words before a dash that run on in lower case are the sentence, not a label", () => {
  const [action] = recipeActions([step("Serve over spaghetti - though tossing it is better.")]);
  assert.equal(action?.label, null);
  assert.equal(action?.text, "Serve over spaghetti - though tossing it is better.");
});

test("a sentence that is only an aside in brackets stays with the action before it", () => {
  assert.deepEqual(pieces("Simmer for 20 minutes to thicken the sauce. (Note 6 for slow cooker)"), [
    "Simmer for 20 minutes to thicken the sauce. (Note 6 for slow cooker)",
  ]);
});

test("a step that is only a label stays whole", () => {
  assert.deepEqual(recipeActions([step("Sauce: ")]).map(({ text, label }) => [text, label]), [["Sauce:", null]]);
});

test("each action knows its step, its place in it, and where it sits in the page's words", () => {
  const steps = [step("Rinse the lentils."), step("Fry the cumin. Add the onion, then stir in the garlic.")];
  const actions = recipeActions(steps);
  assert.deepEqual(
    actions.map(({ step: at, index, count }) => [at, index, count]),
    [
      [0, 0, 1],
      [1, 0, 3],
      [1, 1, 3],
      [1, 2, 3],
    ],
  );
  assert.deepEqual(
    actions.map(({ step: at, start, end }) => steps[at]!.text.slice(start, end)),
    ["Rinse the lentils.", "Fry the cumin.", "Add the onion", "then stir in the garlic."],
  );
});
