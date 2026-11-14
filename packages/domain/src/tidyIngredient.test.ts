import assert from "node:assert/strict";
import { test } from "node:test";
import { tidyIngredient } from "./tidyIngredient.js";

test("a note wrapped in a second pair of brackets loses the outer pair", () => {
  assert.equal(
    tidyIngredient("1 cup plain / all purpose flour ((cake flour OK too, Note 1))"),
    "1 cup plain / all purpose flour (cake flour OK too, Note 1)",
  );
  assert.equal(tidyIngredient("1 1/2 tsp vegetable or canola oil ((Note 7))"), "1 1/2 tsp vegetable or canola oil (Note 7)");
  assert.equal(
    tidyIngredient("2 large eggs ((50 - 55g / 2 oz each), at room temp (Note 3))"),
    "2 large eggs (50 - 55g / 2 oz each), at room temp (Note 3)",
  );
});

test("a bracketed note that starts with a comma follows the name after the comma", () => {
  assert.equal(tidyIngredient("1/2 cup milk (, full fat (Note 5))"), "1/2 cup milk, full fat (Note 5)");
  assert.equal(
    tidyIngredient("60g / 1/4 cup unsalted butter (, cut into 1.5cm / 1/2” cubes)"),
    "60g / 1/4 cup unsalted butter, cut into 1.5cm / 1/2” cubes",
  );
});

test("brackets written once, or unbalanced, are left as they are", () => {
  assert.equal(tidyIngredient("1 small tub (200g) crème fraîche"), "1 small tub (200g) crème fraîche");
  assert.equal(tidyIngredient("2 onions (red or white), diced"), "2 onions (red or white), diced");
  assert.equal(tidyIngredient("1 lemon (zest (and juice"), "1 lemon (zest (and juice");
  assert.equal(tidyIngredient("Salt"), "Salt");
});
