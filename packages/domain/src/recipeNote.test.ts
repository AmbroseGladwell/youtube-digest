import test from "node:test";
import assert from "node:assert/strict";
import { Overview } from "./Overview.js";
import { makeOverview, makeRecipeOverview } from "./OverviewFactory.testHelper.js";
import { overviewMarkdown } from "./overviewMarkdown.js";
import { overviewMetaParts } from "./overviewMetaParts.js";
import { overviewNoteLines } from "./overviewNoteLines.js";
import { recipeFigures, recipeMinutes, recipeStepGroups, recipeYield } from "./recipeFacts.js";
import { recipeText } from "./recipeText.js";
import { shareSnapshot } from "./shareSnapshot.js";
import { SharedNote } from "./SharedNote.js";
import { overviewTimeSaved } from "./timeSavedSummary.js";

test("a recipe's note parses with no key points, and a note without a recipe still needs three", () => {
  assert.equal(Overview.safeParse(makeRecipeOverview()).success, true);
  assert.equal(Overview.safeParse(makeOverview({ keyPoints: [] })).success, false);
});

test("a recipe's note carries no verdict or key points beside it", () => {
  const withPoints = makeRecipeOverview({}, { keyPoints: [{ text: "one", range: null }] });
  assert.equal(Overview.safeParse(withPoints).success, false);
});

test("a method that is carried is carried whole", () => {
  assert.equal(Overview.safeParse(makeRecipeOverview({ stepCount: 4 })).success, false);
  assert.equal(Overview.safeParse(makeRecipeOverview({ steps: [], stepCount: 4 })).success, true);
});

test("times read as the page gave them, never summed", () => {
  assert.equal(recipeMinutes(50), "50 min");
  assert.equal(recipeMinutes(65), "1 hr 5 min");
  assert.equal(recipeMinutes(120), "2 hr");
  assert.deepEqual(
    recipeFigures({ prepMinutes: 20, cookMinutes: 40, totalMinutes: null, yield: null }).map(({ label }) => label),
    ["Prep", "Cook"],
  );
  assert.deepEqual(recipeFigures({ prepMinutes: null, cookMinutes: null, totalMinutes: null, yield: null }), []);
});

test("steps are numbered straight through their groups", () => {
  const groups = recipeStepGroups(makeRecipeOverview().recipe!.steps);
  assert.deepEqual(
    groups.map(({ name, start, steps }) => [name, start, steps.length]),
    [
      [null, 1, 1],
      ["For the beans", 2, 2],
    ],
  );
});

test("the length line names a recipe by its stated total, or just as a recipe", () => {
  assert.equal(overviewMetaParts(makeRecipeOverview()).at(-1), "1 hr 5 min recipe");
  assert.equal(overviewMetaParts(makeRecipeOverview({ totalMinutes: null })).at(-1), "Recipe");
});

test("a recipe's narration is the whole recipe, with each step's number and its units said aloud", () => {
  const lines = overviewNoteLines(makeRecipeOverview());
  assert.deepEqual(
    lines.map(({ section, text, spoken }) => [section, spoken ?? text]),
    [
      ["Summary", "The summary"],
      ["Summary", "Okafor's weeknight stew rests on one idea: roast the leeks hard before they go in."],
      ["Ingredients", "There are 3 ingredients"],
      ["Ingredients", "3 large leeks, trimmed"],
      ["Ingredients", "2 × 400 gram tins cannellini beans, drained"],
      ["Ingredients", "Salt and black pepper"],
      ["Method", "The method, in 3 steps"],
      ["Method", "Step 1. Roast the leeks for 20 minutes."],
      ["Method", "Step 2. Simmer the beans in the stock."],
      ["Method", "Step 3. Stir the leeks through."],
    ],
  );
  assert.equal(lines.at(-1)?.text, "Stir the leeks through.");
});

test("the method is narrated one action to a line, saying the step's number and label only on its first", () => {
  const steps = [
    { text: "Cook beef - Turn the heat up to high. Add the beef, then cook for 2 mins.", group: null },
    { text: "Season to taste.", group: null },
  ];
  const lines = overviewNoteLines(makeRecipeOverview({ steps, stepCount: 2 })).filter(({ section, heading }) => section === "Method" && !heading);
  assert.deepEqual(
    lines.map(({ text, spoken }) => [text, spoken]),
    [
      ["Turn the heat up to high.", "Step 1. Cook beef. Turn the heat up to high."],
      ["Add the beef", "Add the beef"],
      ["…then cook for 2 mins.", "then cook for 2 minutes."],
      ["Season to taste.", "Step 2. Season to taste."],
    ],
  );
});

test("in US units the method's oven temperatures are shown and read in Fahrenheit", () => {
  const steps = [{ text: "Heat the oven to 220°C (200°C fan).", group: null }];
  const [line] = overviewNoteLines(makeRecipeOverview({ steps, stepCount: 1 }), { units: "us" }).filter(
    ({ section, heading }) => section === "Method" && !heading,
  );
  assert.equal(line?.text, "Heat the oven to 425°F (400°F fan).");
  assert.equal(line?.spoken, "Step 1. Heat the oven to 425 degrees Fahrenheit.");
});

test("the ingredients are read as shown, and a copy shared without the method stops after them", () => {
  const adjusted = overviewNoteLines(makeRecipeOverview(), { ingredients: ["6 large leeks, trimmed"] });
  assert.deepEqual(adjusted.filter(({ section, heading }) => section === "Ingredients" && !heading).map(({ text }) => text), ["6 large leeks, trimmed"]);
  const shared = overviewNoteLines(makeRecipeOverview({ steps: [] }));
  assert.equal(shared.some(({ section }) => section === "Method"), false);
});

test("recipes don't count towards time saved", () => {
  assert.deepEqual(overviewTimeSaved(makeRecipeOverview()), { kind: "recipe" });
});

test("a shared copy carries the whole recipe, method included", () => {
  const overview = makeRecipeOverview();
  const { note } = shareSnapshot({ overview, transcript: null, narration: null });
  assert.deepEqual(note.recipe?.steps, overview.recipe?.steps);
  assert.equal(note.recipe?.stepCount, 3);
  assert.equal(note.recipe?.ingredients.length, 3);
  assert.equal(SharedNote.safeParse(note).success, true);
});

test("a shared copy of anything else carries no recipe key, so its hash doesn't move", () => {
  const { note } = shareSnapshot({ overview: makeOverview(), transcript: null, narration: null });
  assert.equal("recipe" in note, false);
});

test("a copied recipe is the page's recipe with its source, and never the summary", () => {
  const overview = makeRecipeOverview();
  const text = recipeText({
    title: overview.source.title,
    from: "Example Kitchen",
    url: overview.source.url,
    recipe: overview.recipe!,
    ingredients: overview.recipe!.ingredients,
    adjusted: null,
  });
  assert.equal(
    text,
    [
      "Charred leek and white bean stew",
      "From Example Kitchen: https://examplekitchen.example/recipes/charred-leek-white-bean-stew",
      "Prep 15 min · Cook 50 min · Total 1 hr 5 min · Makes 4 servings",
      "",
      "Ingredients",
      "- 3 large leeks, trimmed",
      "- 2 × 400g tins cannellini beans, drained",
      "- Salt and black pepper",
      "",
      "Method",
      "1. Roast the leeks for 20 minutes.",
      "For the beans",
      "2. Simmer the beans in the stock.",
      "3. Stir the leeks through.",
      "",
    ].join("\n"),
  );
});

test("a copy without the method points to the page for it", () => {
  const overview = makeRecipeOverview({ steps: [] });
  const text = recipeText({ title: "T", from: "Example Kitchen", url: "https://e.example/r", recipe: overview.recipe!, ingredients: ["x"], adjusted: null });
  assert.match(text, /The method, 3 steps, is on Example Kitchen: https:\/\/e\.example\/r/);
});

test("the markdown export gives the summary, ingredients and numbered method", () => {
  const markdown = overviewMarkdown(makeRecipeOverview());
  assert.match(markdown, /## Summary\n\nPrep 15 min · Cook 50 min · Total 1 hr 5 min · Makes 4 servings\n\nOkafor/);
  assert.match(markdown, /## Ingredients\n\n- 3 large leeks, trimmed/);
  assert.match(markdown, /## Method\n\n1\. Roast the leeks for 20 minutes\.\n\n### For the beans\n\n2\. Simmer/);
  assert.doesNotMatch(markdown, /Key points|Premise/);
});

test("a yield that already says what it is isn't labelled twice", () => {
  const figure = (yieldText: string) => recipeFigures({ prepMinutes: null, cookMinutes: null, totalMinutes: null, yield: yieldText })[0];
  assert.deepEqual(figure("Makes 12"), { label: "Makes", value: "12" });
  assert.deepEqual(figure("Serves 6"), { label: "Serves", value: "6" });
  assert.deepEqual(figure("Serves 4–6"), { label: "Serves", value: "4–6" });
  assert.deepEqual(figure("Servings: 4"), { label: "Serves", value: "4" });
  assert.deepEqual(figure("4 servings"), { label: "Makes", value: "4 servings" });
  assert.deepEqual(figure("16 servings"), { label: "Makes", value: "16 servings" });
  assert.deepEqual(recipeYield("Makes about 20 cookies"), { label: "Makes", amount: "about 20 cookies" });
});
