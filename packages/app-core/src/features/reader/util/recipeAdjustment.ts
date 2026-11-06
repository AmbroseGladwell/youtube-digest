import { adjustIngredient, pluralise, servingsLabel, yieldCount, type AdjustedIngredient, type Recipe, type RecipeUnits } from "@overview/domain";

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
  // Said once above the method, which keeps the author's amounts.
  methodNote: string | null;
  // Said under the step on every action of cooking step by step, for the same reason (150af).
  actionNote: string | null;
  servings: string | null;
}

export const initialScale = (recipe: Pick<Recipe, "yield">): RecipeScale => {
  const base = yieldCount(recipe.yield);
  return base === null ? { kind: "multiplier", times: 1 } : { kind: "servings", base, count: base };
};

const factorOf = (scale: RecipeScale): number => (scale.kind === "servings" ? scale.count / scale.base : scale.times);

export function recipeAdjustment(recipe: Pick<Recipe, "ingredients" | "yield">, scale: RecipeScale, units: RecipeUnits): RecipeAdjustment {
  const factor = factorOf(scale);
  const lines = recipe.ingredients.map((line) => adjustIngredient(line, factor, units));
  const servings = scale.kind === "servings" && recipe.yield !== null ? servingsLabel(recipe.yield, scale.count) : null;
  if (factor === 1 && units === "asWritten") {
    return { lines, adjusted: false, status: null, copyNote: null, methodNote: null, actionNote: null, servings };
  }

  const unread = lines.filter(({ kind }) => kind === "unreadable").length;
  const unitsPhrase = UNITS_PHRASE[units];
  const sized =
    factor === 1
      ? null
      : scale.kind === "servings"
        ? `for ${servingsLabel(recipe.yield!, scale.count).replace(/^Makes /, "")}`
        : MULTIPLIER_WORD[scale.times];
  const what =
    sized === null
      ? `In ${unitsPhrase}.`
      : scale.kind === "servings"
        ? `Adjusted ${sized}${unitsPhrase === "" ? "" : ` in ${unitsPhrase}`}.`
        : `${sized}${unitsPhrase === "" ? "" : `, in ${unitsPhrase}`}.`;
  const status = `${what}${unread === 0 ? "" : ` ${pluralise(unread, "line has", "lines have")} no amount to adjust.`}`;
  const asWritten = recipe.yield === null ? "the recipe as written" : `the recipe’s ${servingsLabel(recipe.yield, yieldCount(recipe.yield) ?? 0).replace(/^Makes /, "")}`;
  return {
    lines,
    adjusted: true,
    status,
    copyNote: `${what.slice(0, -1)}, from ${asWritten}.`,
    methodNote:
      units === "us"
        ? `The method gives the recipe’s own amounts${recipe.yield === null ? "" : `, for ${recipe.yield}`}, with oven temperatures in °F.`
        : recipe.yield === null
          ? "The method gives the recipe’s own amounts and temperatures."
          : `The method gives the recipe’s own amounts and temperatures, for ${recipe.yield}.`,
    actionNote: `${units === "us" ? "Temperatures in °F. " : ""}Amounts as written${recipe.yield === null ? "" : `, for ${recipe.yield}`}`,
    servings,
  };
}
