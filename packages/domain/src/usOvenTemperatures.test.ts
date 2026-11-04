import test from "node:test";
import assert from "node:assert/strict";
import { inUsOvenTemperatures, usOvenTemperatures } from "./usOvenTemperatures.js";

test("an oven's Celsius becomes Fahrenheit on a dial's 25° marks, fan figure included", () => {
  assert.equal(inUsOvenTemperatures("Heat the oven to 220°C (200°C fan)."), "Heat the oven to 425°F (400°F fan).");
  assert.equal(inUsOvenTemperatures("Bake at 180C/160C fan/gas 4."), "Bake at 350°F/325°F fan/gas 4.");
  assert.equal(inUsOvenTemperatures("Heat to 190 ºC."), "Heat to 375°F.");
});

test("a temperature below an oven's is converted exactly", () => {
  assert.equal(inUsOvenTemperatures("Cool to 40°C."), "Cool to 104°F.");
});

test("Fahrenheit, gas marks, amounts and words with a C stay as written", () => {
  for (const text of ["Bake at 400°F.", "Gas mark 6.", "Add 200g flour.", "Use 2 C of stock.", "Chop the 12 Carrots."]) {
    assert.equal(inUsOvenTemperatures(text), text);
  }
});

test("the converted figures are marked, so the screen can show what changed", () => {
  assert.deepEqual(usOvenTemperatures("Roast at 200C until golden."), [
    { text: "Roast at ", converted: false },
    { text: "400°F", converted: true },
    { text: " until golden.", converted: false },
  ]);
});
