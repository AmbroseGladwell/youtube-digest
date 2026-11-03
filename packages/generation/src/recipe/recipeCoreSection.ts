import { z } from "zod";
import { CoreFields, RECIPE_SUMMARY_MOST_WORDS, wordCount } from "@overview/domain";
import type { ArticlePromptSection } from "../article/ArticlePromptSection.js";

export const recipeCoreSection: ArticlePromptSection = {
  key: "structural",
  prompt: () => `
## In one line
What the dish is, in one sentence of 25 words at most. This is the line
I read when scanning my library, so it has to be enough on its own for me
to remember which recipe this was.
Good: "A weeknight stew built on charred leeks."
Good: "Sunday lunch for six, mostly oven time."
Bad: "A delicious and easy recipe everyone will love."
Never start it with "This recipe" or "A recipe for". Never repeat the
site's name.

## Summary
One paragraph, ${RECIPE_SUMMARY_MOST_WORDS} words at most, and shorter when the page is short.
Say what the dish is in the author's own framing, and quote a line of
theirs where the page has one worth keeping, naming them as its source.
Then give the two or three things that make the recipe work, kept in the
prose rather than listed. This is for deciding whether to cook it, so say
what kind of effort or occasion it suits where the page makes that clear.

Never repeat a step, an amount, a time or a temperature: the recipe sits
right below this paragraph exactly as the page gives it. Never add advice
of your own or anything the page doesn't say.

If the page says almost nothing around the recipe, set thin to true and
make the summary only what the page itself says, quoted, in one or two
sentences. Never pad it.
Good, for a page with one line: "The page gives the recipe and one line
around it: “for tacos, salads, anything that needs a sharp edge”."`,
  schemaShape: () => ({
    inOneLine: CoreFields.shape.inOneLine,
    thin: z.boolean(),
    summary: z
      .string()
      .min(1)
      .refine((summary) => wordCount(summary) <= RECIPE_SUMMARY_MOST_WORDS, `max ${RECIPE_SUMMARY_MOST_WORDS} words`),
  }),
};
