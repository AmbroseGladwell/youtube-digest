import { z } from "zod";

export const RecipeStep = z.object({
  text: z.string().min(1),
  // The part of the method it belongs to, where the page divides it ("For the sauce").
  group: z.string().nullable(),
});
export type RecipeStep = z.infer<typeof RecipeStep>;

const Minutes = z.number().int().positive().nullable();

// Copied from the source, never converted or estimated, so an ingredient stays the one string
// the source wrote and a time the page didn't give stays null (docs/features/recipe-notes.md).
export const Recipe = z.object({
  ingredients: z.array(z.string().min(1)).min(1),
  steps: z.array(RecipeStep).min(1),
  prepMinutes: Minutes,
  cookMinutes: Minutes,
  totalMinutes: Minutes,
  yield: z.string().nullable(),
});
export type Recipe = z.infer<typeof Recipe>;
