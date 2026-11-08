import { describe, expect, it } from "vitest";
import { initialScale, recipeAdjustment } from "./recipeAdjustment.js";

const recipe = {
  ingredients: ["3 tbsp olive oil", "500ml vegetable stock", "A handful of parsley", "Salt and black pepper"],
  yield: "4 servings",
};

describe("recipeAdjustment", () => {
  it("starts as written, with nothing to say", () => {
    const adjustment = recipeAdjustment(recipe, initialScale(recipe), "asWritten");
    expect(adjustment.adjusted).toBe(false);
    expect(adjustment.status).toBeNull();
    expect(adjustment.servings).toBe("4 servings");
  });

  it("counts the lines it couldn't adjust, and says what the copy came from", () => {
    const adjustment = recipeAdjustment(recipe, { kind: "servings", base: 4, count: 8 }, "us");
    expect(adjustment.status).toBe("Adjusted for 8 servings in US units. 2 lines have no amount to adjust.");
    expect(adjustment.copyNote).toBe("Adjusted for 8 servings in US units, from the recipe’s 4 servings.");
    expect(adjustment.methodNote).toBe(
      "Amounts the method repeats from the ingredients are adjusted for 8 servings in US units, and marked. Oven temperatures are in °F. Everything else is as the recipe gives it.",
    );
    expect(adjustment.actionNote).toBe("Adjusted for 8 servings in US units");
    expect(adjustment.cookingNote).toBe("Adjusted for 8 servings in US units, and so is the method. 2 lines have no amount to adjust.");
    expect(adjustment.servings).toBe("8 servings");
  });

  it("says a yield in the page's words once, not after its own verb", () => {
    const serves = { ...recipe, yield: "Serves 6" };
    const adjustment = recipeAdjustment(serves, { kind: "servings", base: 6, count: 12 }, "asWritten");
    expect(adjustment.status).toBe("Adjusted for 12. 2 lines have no amount to adjust.");
    expect(adjustment.copyNote).toBe("Adjusted for 12, from the recipe’s 6.");
    expect(adjustment.actionNote).toBe("Adjusted for 12");
    expect(adjustment.servings).toBe("Serves 12");
  });

  it("gives the method the amounts it repeats from adjusted lines, and none as written", () => {
    const pancakes = { ingredients: ["100g plain flour", "2 large eggs", "a pinch of salt"], yield: "Makes 8 pancakes" };
    const doubled = recipeAdjustment(pancakes, { kind: "servings", base: 8, count: 16 }, "asWritten");
    expect(doubled.methodAmounts.map(({ written, adjusted }) => [written, adjusted])).toEqual([
      ["100g", "200g"],
      ["2", "4"],
    ]);
    expect(doubled.methodNote).toBe(
      "Amounts the method repeats from the ingredients are adjusted for 16 pancakes, and marked. Everything else is as the recipe gives it.",
    );
    expect(doubled.actionNote).toBe("Adjusted for 16 pancakes");
    expect(recipeAdjustment(pancakes, initialScale(pancakes), "asWritten").methodAmounts).toEqual([]);
  });

  it("uses a multiplier where the page gives no yield", () => {
    const noYield = { ...recipe, yield: null };
    expect(initialScale(noYield)).toEqual({ kind: "multiplier", times: 1 });
    expect(recipeAdjustment(noYield, { kind: "multiplier", times: 2 }, "asWritten").status).toBe(
      "Doubled. 2 lines have no amount to adjust.",
    );
  });

  it("says units alone when only the units changed", () => {
    expect(recipeAdjustment(recipe, initialScale(recipe), "metric").status).toBe("In metric units. 2 lines have no amount to adjust.");
  });
});
