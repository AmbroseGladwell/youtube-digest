import { recipeFigures, recipeFiguresLine, recipeStepGroups } from "./recipeFacts.js";
import type { RecipeNote } from "./RecipeNote.js";
import { inMethodAmounts, type MethodAmount } from "./methodAmounts.js";
import { formatTimestamp } from "./formatTimestamp.js";
import type { RecipeStep } from "./Recipe.js";

// A video's step ends with its moment, so a cook with the video on another screen can find it (122r).
export const stepMoment = (step: RecipeStep | undefined): string | null =>
  step?.range === undefined ? null : formatTimestamp(step.range.startMs);

export interface RecipeTextInput {
  title: string;
  from: string;
  url: string;
  recipe: RecipeNote;
  // The lines as the reader sees them, which may be adjusted from the page's.
  ingredients: readonly string[];
  // Said when the lines were adjusted, so a copy never passes for the page's own amounts.
  adjusted: string | null;
  // The method's amounts that follow the adjusted ingredients (OV-231).
  methodAmounts?: readonly MethodAmount[];
}

// Copy recipe: the page's recipe only, with where it came from, and never our summary. Plain
// text with "-" and numbers, so it pastes cleanly anywhere (design 144r).
export function recipeText({ title, from, url, recipe, ingredients, adjusted, methodAmounts = [] }: RecipeTextInput): string {
  const figures = recipeFigures(recipe);
  const head = [
    title,
    `From ${from}: ${url}`,
    ...(figures.length === 0 ? [] : [recipeFiguresLine(figures)]),
    ...(adjusted === null ? [] : [adjusted]),
  ];
  const method =
    recipe.steps.length === 0
      ? [`The method, ${recipe.stepCount} steps, is on ${from}: ${url}`]
      : recipeStepGroups(recipe.steps).flatMap(({ name, start, steps }) => [
          ...(name === null ? [] : [name]),
          ...steps.map((step, index) => {
            const moment = stepMoment(recipe.steps[start + index - 1]);
            return `${start + index}. ${inMethodAmounts(step, methodAmounts)}${moment === null ? "" : ` (${moment})`}`;
          }),
        ]);
  return (
    [head.join("\n"), ["Ingredients", ...ingredients.map((line) => `- ${line}`)].join("\n"), ["Method", ...method].join("\n")].join(
      "\n\n",
    ) + "\n"
  );
}
