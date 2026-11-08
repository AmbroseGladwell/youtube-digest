import test from "node:test";
import assert from "node:assert/strict";
import { adjustIngredient, type RecipeUnits } from "./adjustIngredient.js";
import { inMethodAmounts, methodAmounts, methodPieces } from "./methodAmounts.js";

const pancakes = ["100g plain flour", "2 large eggs", "300ml milk", "1 tbsp sunflower or vegetable oil plus a little extra for frying", "lemon wedges to serve (optional)"];
const amountsFor = (ingredients: string[], factor: number, units: RecipeUnits = "asWritten") =>
  methodAmounts(
    ingredients,
    ingredients.map((line) => adjustIngredient(line, factor, units)),
  );
const marked = (text: string, ingredients: string[], factor: number, units: RecipeUnits = "asWritten") =>
  methodPieces(text, amountsFor(ingredients, factor, units))
    .filter((piece) => piece.changed)
    .map((piece) => piece.text);

const step1 =
  "Put 100g plain flour, 2 large eggs, 300ml milk, 1 tbsp sunflower or vegetable oil and a pinch of salt into a bowl or large jug, then whisk to a smooth batter.";

test("a method amount that repeats an ingredient line scales with it, and only the amount is marked", () => {
  assert.equal(
    inMethodAmounts(step1, amountsFor(pancakes, 2)),
    "Put 200g plain flour, 4 large eggs, 600ml milk, 2 tbsp sunflower or vegetable oil and a pinch of salt into a bowl or large jug, then whisk to a smooth batter.",
  );
  assert.deepEqual(marked(step1, pancakes, 2), ["200g", "4", "600ml", "2 tbsp"]);
});

test("a share stays as written, whether it's part of the batch or per pancake", () => {
  assert.equal(inMethodAmounts("Pour in about 3 tbsp of the batter and swirl it.", amountsFor(["3 tbsp milk"], 2)), "Pour in about 3 tbsp of the batter and swirl it.");
  assert.equal(inMethodAmounts("Toss the leeks with 1 tbsp of the oil.", amountsFor(["1 tbsp olive oil", "3 leeks"], 2)), "Toss the leeks with 1 tbsp of the oil.");
  assert.equal(inMethodAmounts("Spread over 3 tbsp of the sauce.", amountsFor(["3 tbsp passata"], 2)), "Spread over 3 tbsp of the sauce.");
});

test("times, sizes, pieces and different amounts stay as written", () => {
  const ingredients = ["2 large eggs", "20g butter", "4 tomatoes", "3 tbsp olive oil"];
  for (const text of ["Cook for 2 minutes on each side.", "Heat a 20cm frying pan.", "Divide it into 4 equal pieces.", "Heat 1 tbsp olive oil in a pan."]) {
    assert.equal(inMethodAmounts(text, amountsFor(ingredients, 2)), text);
  }
});

test("a number inside a longer one isn't taken for the amount", () => {
  assert.equal(inMethodAmounts("Add 1100g plain flour.", amountsFor(["100g plain flour"], 2)), "Add 1100g plain flour.");
});

test("one becoming several takes its plural in the method too", () => {
  assert.equal(inMethodAmounts("Fry 1 onion until soft.", amountsFor(["1 onion, finely chopped"], 2)), "Fry 2 onions until soft.");
  assert.equal(inMethodAmounts("Add 1 small garlic clove.", amountsFor(["1 small garlic clove, grated"], 2)), "Add 2 small garlic cloves.");
});

test("units change in the method as they do in the list", () => {
  assert.deepEqual(marked(step1, pancakes, 1, "us"), ["3½ oz", "1¼ cups"]);
});

test("as written, and a tin sold at its size, give the method nothing to change", () => {
  assert.deepEqual(amountsFor(pancakes, 1), []);
  assert.equal(inMethodAmounts("Tip in the 400g can of tomatoes.", amountsFor(["400g can chopped tomatoes"], 2)), "Tip in the 400g can of tomatoes.");
});
