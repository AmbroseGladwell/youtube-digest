import type { RecipeUnits } from "@overview/domain";

const STORAGE_KEY = "overview.recipeUnits";
const UNITS: readonly RecipeUnits[] = ["asWritten", "metric", "us"];

// The units a reader chose, kept for every recipe on this device; servings start again on
// each recipe (design 144y). Never synced, and as written whenever it can't be read.
export function readRecipeUnits(storage: Storage = globalThis.localStorage): RecipeUnits {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return UNITS.find((units) => units === saved) ?? "asWritten";
  } catch {
    return "asWritten";
  }
}

export function writeRecipeUnits(units: RecipeUnits, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, units);
  } catch {
    // A device that won't store it still adjusts this recipe.
  }
}
