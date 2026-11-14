import {
  adjustIngredient,
  methodAmounts,
  pluralise,
  recipeYield,
  servingsLabel,
  tidyIngredient,
  yieldCount,
  type AdjustedIngredient,
  type MethodAmount,
  type Recipe,
  type RecipeUnits,
} from "@overview/domain";

export const RECIPE_MULTIPLIERS = [0.5, 1, 2, 3] as const;
export type RecipeMultiplier = (typeof RECIPE_MULTIPLIERS)[number];

export const MULTIPLIER_LABEL: Record<RecipeMultiplier, string> = { 0.5: "½×", 1: "1×", 2: "2×", 3: "3×" };
const MULTIPLIER_WORD: Record<RecipeMultiplier, string> = { 0.5: "Halved", 1: "", 2: "Doubled", 3: "Tripled" };
export const UNITS_LABEL: Record<RecipeUnits, string> = { asWritten: "As written", metric: "Metric", us: "US" };
const UNITS_PHRASE: Record<RecipeUnits, string> = { asWritten: "", metric: "metric units", us: "US units" };

// What the reader asked for: a number of servings where the page gives a yield to step from,
// otherwise a multiplier (design 144aa).
export type RecipeScale = { kind: "servings"; base: number; count: number } | { kind: "multiplier"; times: RecipeMultiplier };

export interface RecipeAdjustment {
  lines: AdjustedIngredient[];
  adjusted: boolean;
  // "Adjusted for 8 servings in US units. 2 lines have no amount to adjust."
  status: string | null;
  // Said on a copy or a print, so it never passes for the page's own amounts.
  copyNote: string | null;
  // The method's amounts that repeat an ingredient line, which scale with it (OV-231, 231k).
  methodAmounts: readonly MethodAmount[];
  // Said once above step 1: what in the method changed, and that the rest is the recipe's (231a).
  methodNote: string | null;
  // Said under the step on every action of cooking step by step (231f, replacing 150af).
  actionNote: string | null;
  // Said over the ingredients in cooking mode, where the method is a tap away (231j).
  cookingNote: string | null;
  servings: string | null;
}

export const initialScale = (recipe: Pick<Recipe, "yield">): RecipeScale => {
  const base = yieldCount(recipe.yield);
  return base === null ? { kind: "multiplier", times: 1 } : { kind: "servings", base, count: base };
};

const factorOf = (scale: RecipeScale): number => (scale.kind === "servings" ? scale.count / scale.base : scale.times);

export function recipeAdjustment(recipe: Pick<Recipe, "ingredients" | "yield">, scale: RecipeScale, units: RecipeUnits): RecipeAdjustment {
  const factor = factorOf(scale);
  const ingredients = recipe.ingredients.map(tidyIngredient);
  const lines = ingredients.map((line) => adjustIngredient(line, factor, units));
  const servings = scale.kind === "servings" && recipe.yield !== null ? servingsLabel(recipe.yield, scale.count) : null;
  if (factor === 1 && units === "asWritten") {
    return {
      lines,
      adjusted: false,
      status: null,
      copyNote: null,
      methodAmounts: [],
      methodNote: null,
      actionNote: null,
      cookingNote: null,
      servings,
    };
  }

  const unread = lines.filter(({ kind }) => kind === "unreadable").length;
  const unitsPhrase = UNITS_PHRASE[units];
  const sized =
    factor === 1
      ? null
      : scale.kind === "servings"
        ? `for ${recipeYield(servingsLabel(recipe.yield!, scale.count)).amount}`
        : MULTIPLIER_WORD[scale.times];
  const what =
    sized === null
      ? `In ${unitsPhrase}.`
      : scale.kind === "servings"
        ? `Adjusted ${sized}${unitsPhrase === "" ? "" : ` in ${unitsPhrase}`}.`
        : `${sized}${unitsPhrase === "" ? "" : `, in ${unitsPhrase}`}.`;
  const unreadNote = unread === 0 ? "" : ` ${pluralise(unread, "line has", "lines have")} no amount to adjust.`;
  const status = `${what}${unreadNote}`;
  const done = what.slice(0, -1);
  const forYield = recipe.yield === null ? null : recipeYield(recipe.yield).amount;
  const asWritten = forYield === null ? "the recipe as written" : `the recipe’s ${forYield}`;
  return {
    lines,
    adjusted: true,
    status,
    copyNote: `${what.slice(0, -1)}, from ${asWritten}.`,
    methodAmounts: methodAmounts(ingredients, lines),
    methodNote: `Amounts the method repeats from the ingredients are ${done.charAt(0).toLowerCase()}${done.slice(1)}, and marked.${units === "us" ? " Oven temperatures are in °F." : ""} Everything else is as the recipe gives it.`,
    actionNote: done,
    cookingNote: `${done}, and so is the method.${unreadNote}`,
    servings,
  };
}
