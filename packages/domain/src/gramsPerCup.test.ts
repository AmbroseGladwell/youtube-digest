import assert from "node:assert/strict";
import { test } from "node:test";
import { gramsPerCup } from "./gramsPerCup.js";

test("a dry ingredient the table knows has a weight per cup", () => {
  assert.equal(gramsPerCup(" plain / all purpose flour (cake flour OK too, Note 1)"), 120);
  assert.equal(gramsPerCup("flour"), 120);
  assert.equal(gramsPerCup("of self-raising flour"), 113);
  assert.equal(gramsPerCup("caster / superfine sugar (granulated/regular ok too, Note 4)"), 190);
  assert.equal(gramsPerCup("sugar"), 198);
  assert.equal(gramsPerCup("packed light brown sugar"), 213);
  assert.equal(gramsPerCup("icing sugar, sifted"), 113);
  assert.equal(gramsPerCup("unsalted butter, softened"), 227);
  assert.equal(gramsPerCup("unsweetened cocoa powder"), 84);
  assert.equal(gramsPerCup("rolled oats"), 89);
});

test("anything the table can't answer for has no weight", () => {
  assert.equal(gramsPerCup("milk, full fat (Note 5)"), null);
  assert.equal(gramsPerCup("rice flour"), null);
  assert.equal(gramsPerCup("chickpea flour"), null);
  assert.equal(gramsPerCup("peanut butter"), null);
  assert.equal(gramsPerCup("buttermilk"), null);
  assert.equal(gramsPerCup("sugar snap peas"), null);
});
