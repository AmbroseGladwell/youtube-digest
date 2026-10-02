import { HowToApply, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const HOW_TO_APPLY_TARGET_WORDS = 30;
export const HOW_TO_APPLY_MAX_WORDS = 40;

export const howToApplySection: PromptSection = {
  title: "How to apply",
  key: "howToApply",
  prompt: (input) => `
## How to apply
1 to 3 things I could actually do, concrete and specific, not principles.
"Do a 10 minute phone-free wind-down before bed on school nights." not
"Prioritise connection." If there is nothing actionable, return an empty
list rather than inventing something.

Each is one complete sentence, ${HOW_TO_APPLY_TARGET_WORDS} words at most, that reads
naturally after "First,", "Then," or "And finally,": an instruction, never a
label and a colon.${
    input.readerContext ? `\n\nAbout the reader, for fit: ${input.readerContext}` : ""
  }`,
  schemaShape: () => ({
    items: HowToApply.shape.items.element
      .refine((item) => wordCount(item) <= HOW_TO_APPLY_MAX_WORDS, `max ${HOW_TO_APPLY_MAX_WORDS} words`)
      .array()
      .max(3),
  }),
};
