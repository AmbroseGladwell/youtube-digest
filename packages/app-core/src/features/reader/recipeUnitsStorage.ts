import type { RecipeUnits } from "@overview/domain";

const STORAGE_KEY = "overview.recipeUnits";
const UNITS: readonly RecipeUnits[] = ["asWritten", "metric", "us"];

export const readRecipeUnits = (storage: Storage = globalThis.localStorage): RecipeUnits => {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return UNITS.find((units) => units === saved) ?? "asWritten";
  } catch {
    return "asWritten";
  }
};

export const writeRecipeUnits = (units: RecipeUnits, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, units);
  } catch {
    // A device that won't store it still adjusts this recipe.
  }
};
