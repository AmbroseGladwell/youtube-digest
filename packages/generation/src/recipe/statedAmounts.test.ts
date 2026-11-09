import test from "node:test";
import assert from "node:assert/strict";
import { numbersStated, statedNumbersIn, withStatedAmounts } from "./statedAmounts.js";

test("numbers said in words state the same amount as in digits", () => {
  assert.deepEqual(numbersStated("two and a half cups"), [2.5]);
  assert.deepEqual(numbersStated("2½ cups, 1 1/2 tsp and 1-1/2 tbsp"), [2.5, 1.5, 1.5]);
  assert.deepEqual(numbersStated("twenty five minutes, a dozen eggs, half an onion"), [25, 12, 0.5]);
  assert.deepEqual(numbersStated("three quarters of a cup"), [0.75]);
  assert.deepEqual(numbersStated("an onion, someone"), []);
});

test("a line whose amounts were all stated stays as the model copied it", () => {
  const stated = statedNumbersIn(["add two cups of rice and 400g of tomatoes"]);
  assert.deepEqual(withStatedAmounts(["2 cups rice", "400g tomatoes"], stated), {
    ingredients: ["2 cups rice", "400g tomatoes"],
    amountsDropped: 0,
  });
});

test("an amount nobody stated leaves the line its name", () => {
  const stated = statedNumbersIn(["2 cups rice"]);
  assert.deepEqual(withStatedAmounts(["1 tsp salt", "3-4 cloves of garlic", "1 tbsp of oil", "about 5 tbsp butter"], stated).ingredients, [
    "salt",
    "cloves of garlic",
    "oil",
    "butter",
  ]);
});

test("an unstated figure in brackets or after a comma goes, and the rest stays", () => {
  const stated = statedNumbersIn(["1 onion and 2 peppers"]);
  assert.deepEqual(withStatedAmounts(["1 onion (about 150g), sliced", "2 peppers, 300g"], stated), {
    ingredients: ["1 onion, sliced", "2 peppers"],
    amountsDropped: 2,
  });
});
