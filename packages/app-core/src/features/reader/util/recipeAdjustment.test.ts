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
    expect(adjustment.methodNote).toBe("The method gives the recipe’s own amounts, for 4 servings, with oven temperatures in °F.");
    expect(adjustment.actionNote).toBe("Temperatures in °F. Amounts as written, for 4 servings");
    expect(adjustment.servings).toBe("8 servings");
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
