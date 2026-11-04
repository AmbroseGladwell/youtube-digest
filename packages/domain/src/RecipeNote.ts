import { z } from "zod";
import { Recipe, RecipeStep } from "./Recipe.js";
import { wordCount } from "./wordCount.js";

export const RECIPE_SUMMARY_MOST_WORDS = 90;

// What a recipe's note has in place of the argument-shaped fields: our one paragraph, and the
// page's recipe as the page wrote it (docs/features/recipe-notes.md).
export const RecipeNote = Recipe.extend({
  summary: z
    .string()
    .min(1)
    .refine((s) => wordCount(s) <= RECIPE_SUMMARY_MOST_WORDS, `docs/features/recipe-notes.md: max ${RECIPE_SUMMARY_MOST_WORDS} words`),
  // Empty where the method stayed on the page: a copy shared before OV-159, and one saved from it.
  steps: z.array(RecipeStep),
  stepCount: z.number().int().positive(),
}).refine((note) => note.steps.length === 0 || note.steps.length === note.stepCount, {
  path: ["stepCount"],
  message: "a method that is carried is carried whole",
});
export type RecipeNote = z.infer<typeof RecipeNote>;

export const recipeNote = (recipe: Recipe, summary: string): RecipeNote => ({
  ...recipe,
  summary,
  stepCount: recipe.steps.length,
});

export const carriesMethod = (note: RecipeNote): boolean => note.steps.length > 0;
