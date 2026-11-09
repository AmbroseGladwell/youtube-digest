import { z } from "zod";
import { RECIPE_SUMMARY_MOST_WORDS, RecipeStep, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { NO_SEGMENT } from "./segmentRangeFields.js";

export interface GeneratedRecipe {
  summary: string;
  ingredients: string[];
  steps: { text: string; group: string | null; startSegmentIndex: number; endSegmentIndex: number }[];
}

export const recipeSection: PromptSection = {
  title: "Recipe",
  key: "structural",
  prompt: () => `
## Recipe
Give a recipe only when the video teaches one dish from start to finish,
so that someone could cook it from what the video and its description
say. Otherwise set recipe to null: a talk, an interview, a restaurant
review, food history, a taste test, a vlog that cooks without teaching
it, or a video that runs through several different recipes.

When you give one, the reader sees it in place of the core claim, key
points and verdict, so write In one line as what the dish is ("A party
jollof with a smoky, fried tomato base"), never "This video".

Ingredients: one line per ingredient, in the order given, with its amount
first. Where the description lists the ingredients, copy its lines. Where
it doesn't, write each ingredient as the video says it. Write an amount
only as the description or the video states it, in digits: "2 cups
long-grain rice" for "two cups of long-grain rice". An amount nobody
states stays out: "salt", never "1 tsp salt". Never convert, scale,
estimate or add up an amount.

Steps: the method in the video's order, each step one stage the cook
carries out, written as plain full sentences. Keep every time,
temperature and cue for when it's done ("until the oil rises to the
top") as the video gives it, and never add one it doesn't. Give each
step the stretch of the video that shows it as startSegmentIndex and
endSegmentIndex from the numbered transcript segments below. A step only
the description gives, which the video never shows, keeps its place in
the method with both set to -1. Set group where the video divides the
method into parts ("For the sauce"), otherwise null.

Summary: one paragraph, ${RECIPE_SUMMARY_MOST_WORDS} words at most. Say what the dish is in
the creator's own framing, and quote a line of theirs where one is worth
keeping, naming them as its source. Then give the two or three things
that make the recipe work, kept in the prose rather than listed, and what
kind of effort or occasion it suits where the video makes that clear.
Never repeat a step, an amount, a time or a temperature, since the recipe
sits right below it.`,
  schemaShape: (input) => {
    const segment = z
      .int()
      .min(NO_SEGMENT)
      .max(input.transcript.length - 1);
    return {
      recipe: z
        .object({
          summary: z
            .string()
            .min(1)
            .refine((summary) => wordCount(summary) <= RECIPE_SUMMARY_MOST_WORDS, `max ${RECIPE_SUMMARY_MOST_WORDS} words`),
          ingredients: z.array(z.string().min(1)).min(1),
          steps: z
            .array(
              z
                .object({
                  text: RecipeStep.shape.text,
                  group: RecipeStep.shape.group,
                  startSegmentIndex: segment,
                  endSegmentIndex: segment,
                })
                .refine(
                  ({ startSegmentIndex, endSegmentIndex }) =>
                    startSegmentIndex === NO_SEGMENT
                      ? endSegmentIndex === NO_SEGMENT
                      : startSegmentIndex >= 0 && startSegmentIndex <= endSegmentIndex,
                  "a step shown in the video ends where it starts or after, and one it never shows has both at -1",
                ),
            )
            .min(1),
        })
        .nullable(),
    };
  },
};
