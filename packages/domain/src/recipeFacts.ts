import type { Recipe, RecipeStep } from "./Recipe.js";

// "1 hr 5 min", "50 min": a time the page gave, never one we worked out.
export const recipeMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} hr${rest === 0 ? "" : ` ${rest} min`}`;
};

export interface RecipeFigure {
  label: string;
  value: string;
}

// Prep, Cook, Total and Makes, only what the page states; a total it didn't give is not summed
// (design 144f).
export function recipeFigures(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">): RecipeFigure[] {
  const figures: RecipeFigure[] = [];
  if (recipe.prepMinutes !== null) figures.push({ label: "Prep", value: recipeMinutes(recipe.prepMinutes) });
  if (recipe.cookMinutes !== null) figures.push({ label: "Cook", value: recipeMinutes(recipe.cookMinutes) });
  if (recipe.totalMinutes !== null) figures.push({ label: "Total", value: recipeMinutes(recipe.totalMinutes) });
  if (recipe.yield !== null) figures.push({ label: "Makes", value: recipe.yield });
  return figures;
}

export const recipeFiguresLine = (figures: RecipeFigure[]): string =>
  figures.map(({ label, value }) => `${label} ${value}`).join(" · ");

export interface RecipeStepGroup {
  name: string | null;
  // The number of the group's first step, counting through the whole method.
  start: number;
  steps: string[];
}

// Steps grouped under the page's subheads, numbered straight through so "step 9" means one
// thing (design 144g).
export function recipeStepGroups(steps: readonly RecipeStep[]): RecipeStepGroup[] {
  const groups: RecipeStepGroup[] = [];
  steps.forEach(({ text, group }, index) => {
    const last = groups.at(-1);
    if (last !== undefined && last.name === group) {
      last.steps.push(text);
    } else {
      groups.push({ name: group, start: index + 1, steps: [text] });
    }
  });
  return groups;
}
