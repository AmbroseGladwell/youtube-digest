import { recipeFigures, recipeFiguresLine, recipeStepGroups } from "./recipeFacts.js";
import type { RecipeNote } from "./RecipeNote.js";

export interface RecipeTextInput {
  title: string;
  from: string;
  url: string;
  recipe: RecipeNote;
  // The lines as the reader sees them, which may be adjusted from the page's.
  ingredients: readonly string[];
  // Said when the lines were adjusted, so a copy never passes for the page's own amounts.
  adjusted: string | null;
}

// Copy recipe: the page's recipe only, with where it came from, and never our summary. Plain
// text with "-" and numbers, so it pastes cleanly anywhere (design 144r).
export function recipeText({ title, from, url, recipe, ingredients, adjusted }: RecipeTextInput): string {
  const figures = recipeFigures(recipe);
  const head = [title, `From ${from}: ${url}`, ...(figures.length === 0 ? [] : [recipeFiguresLine(figures)]), ...(adjusted === null ? [] : [adjusted])];
  const method =
    recipe.steps.length === 0
      ? [`The method, ${recipe.stepCount} steps, is on ${from}: ${url}`]
      : recipeStepGroups(recipe.steps).flatMap(({ name, start, steps }) => [
          ...(name === null ? [] : [name]),
          ...steps.map((step, index) => `${start + index}. ${step}`),
        ]);
  return [head.join("\n"), ["Ingredients", ...ingredients.map((line) => `- ${line}`)].join("\n"), ["Method", ...method].join("\n")].join("\n\n") + "\n";
}
