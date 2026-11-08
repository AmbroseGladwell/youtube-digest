import test from "node:test";
import assert from "node:assert/strict";
import { spokenMeasures } from "./spokenMeasures.js";

const says = (cases: Array<[string, string]>) => {
  for (const [written, spoken] of cases) assert.equal(spokenMeasures(written), spoken, written);
};

test("a unit after an amount is said in full, singular for one and plural for more", () => {
  says([
    ["1 tsp ground cumin", "1 teaspoon ground cumin"],
    ["2 tbsp olive oil", "2 tablespoons olive oil"],
    ["500ml chicken stock", "500 millilitres chicken stock"],
    ["250g plain flour", "250 grams plain flour"],
    ["1kg potatoes", "1 kilogram potatoes"],
    ["2 lbs beef", "2 pounds beef"],
    ["1 lb. minced pork", "1 pound minced pork"],
    ["8 oz cheddar", "8 ounces cheddar"],
    ["4 fl oz milk", "4 fluid ounces milk"],
    ["1.5 L water", "1.5 litres water"],
    ["2 Tbsp butter", "2 tablespoons butter"],
  ]);
});

test("fractions and ranges are said as a cook would", () => {
  says([
    ["½ tsp salt", "half a teaspoon salt"],
    ["¼ tsp chilli flakes", "a quarter of a teaspoon chilli flakes"],
    ["⅔ oz yeast", "two thirds of an ounce yeast"],
    ["1½ tbsp honey", "1 and a half tablespoons honey"],
    ["1 1/2 tsp baking powder", "1 and a half teaspoons baking powder"],
    ["1/2 tsp nutmeg", "half a teaspoon nutmeg"],
    ["2-3 tbsp milk", "2 to 3 tablespoons milk"],
    ["½ lemon, juiced", "half lemon, juiced"],
  ]);
});

test("a size that describes the thing is said singular", () => {
  says([
    ["2 × 400g tins chopped tomatoes", "2 × 400 gram tins chopped tomatoes"],
    ["cut into 2cm pieces", "cut into 2 centimetre pieces"],
    ["a 23cm springform tin", "a 23 centimetre springform tin"],
    ["roll it 3mm thick", "roll it 3 millimetres thick"],
  ]);
});

test("a share of a pack sold whole is said as a share of one", () => {
  says([
    ["½ × 190g jar pesto", "half a 190 gram jar pesto"],
    ["½ × 800g tin tomatoes", "half an 800 gram tin tomatoes"],
    ["¼ × 400g can beans", "a quarter of a 400 gram can beans"],
    ["1½ × 400g cans chopped tomatoes", "1 and a half 400 gram cans chopped tomatoes"],
  ]);
});

test("oven temperatures, gas marks and times are said in full", () => {
  says([
    ["Heat the oven to 200°C/180°C fan/gas 6.", "Heat the oven to 200 degrees Celsius, or 180 degrees Celsius fan, or gas mark 6."],
    ["Preheat to 350°F.", "Preheat to 350 degrees Fahrenheit."],
    ["Heat to 180C fan.", "Heat to 180 degrees Celsius fan."],
    ["Bake for 25-30 mins.", "Bake for 25 to 30 minutes."],
    ["Rest for 1 hr.", "Rest for 1 hour."],
  ]);
});

test("words that only look like units are left alone, and so is a line with no measure", () => {
  says([
    ["3 large leeks, trimmed", "3 large leeks, trimmed"],
    ["2 garlic cloves", "2 garlic cloves"],
    ["Salt and black pepper", "Salt and black pepper"],
    ["Add the eggs, one at a time.", "Add the eggs, one at a time."],
    ["Stir in 2 limes' zest", "Stir in 2 limes' zest"],
  ]);
});

test("a conversion in brackets isn't read twice, and one after a slash is read as the other way", () => {
  says([
    ["100g (3½oz) butter", "100 grams butter"],
    ["200g/7oz caster sugar", "200 grams, or 7 ounces caster sugar"],
    ["2 tsp + 1 tbsp", "2 teaspoons plus 1 tablespoon"],
  ]);
});
