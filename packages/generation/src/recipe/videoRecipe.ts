import { Recipe, recipeFactsInLines } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";
import type { GeneratedRecipe } from "../sections/recipeSection.js";
import { statedNumbersIn, withStatedAmounts } from "./statedAmounts.js";

const comparable = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}½¼¾⅓⅔⅛]+/gu, " ")
    .trim();

export const descriptionOf = (input: GenerationInput): string => input.video.fullDescription ?? input.video.description ?? "";

// The model found the recipe, since a video has no structured data, so code checks every amount
// against what the description and the video state, reads the times and yield only where the
// description labels them, and places each step by its segments (docs/features/recipe-notes.md,
// "Recipe videos"). Null when no ingredient survives, so the video keeps its ordinary note.
export function videoRecipe(input: GenerationInput, generated: GeneratedRecipe): Recipe | null {
  const description = descriptionOf(input);
  const stated = statedNumbersIn([description, input.transcript.map(({ text }) => text).join(" ")]);
  const { ingredients } = withStatedAmounts(generated.ingredients, stated);
  const steps = generated.steps.map(({ text, group, range }) => {
    const start = range === null ? undefined : input.transcript[range.startSegmentIndex];
    const end = range === null ? undefined : input.transcript[range.endSegmentIndex];
    return start === undefined || end === undefined
      ? { text, group }
      : { text, group, range: { startMs: start.startMs, endMs: end.endMs } };
  });
  const listed = ` ${comparable(description)} `;
  const ingredientsSaid = ingredients.flatMap((line, index) => (listed.includes(` ${comparable(line)} `) ? [] : [index]));
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const recipe = Recipe.safeParse({ ingredients, steps, ...recipeFactsInLines(lines), ingredientsSaid });
  return recipe.success ? recipe.data : null;
}
