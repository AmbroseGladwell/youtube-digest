import { HowToApply, wordCount } from "@overview/domain";
import { HOW_TO_APPLY_MAX_WORDS, HOW_TO_APPLY_TARGET_WORDS, readerFit } from "../../sections/howToApplySection.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";

export const articleHowToApplySection: ArticlePromptSection = {
  key: "howToApply",
  prompt: (input) => `
## How to apply
1 to 3 things I could actually do, concrete and specific, not principles.
"Do a 10 minute phone-free wind-down before bed on school nights." not
"Prioritise connection." Most news has nothing to apply: if there is
nothing actionable, return an empty list rather than inventing something.

Each is one complete sentence, ${HOW_TO_APPLY_TARGET_WORDS} words at most, that reads
naturally after "First,", "Then," or "And finally,": an instruction, never a
label and a colon.${readerFit(input.readerContext)}`,
  schemaShape: () => ({
    items: HowToApply.shape.items.element
      .refine((item) => wordCount(item) <= HOW_TO_APPLY_MAX_WORDS, `max ${HOW_TO_APPLY_MAX_WORDS} words`)
      .array()
      .max(3),
  }),
};
