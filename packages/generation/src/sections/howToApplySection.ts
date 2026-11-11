import { HowToApply, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const HOW_TO_APPLY_TARGET_WORDS = 30;
export const HOW_TO_APPLY_MAX_WORDS = 40;

// OV-236: fitting to the reader is wanted, inventing a life for them isn't. Measured in
// docs/architecture/model-comparison.md, "Different readers". Articles share it (OV-238).
const FIT = `Fit each step to what they already do and the limits they live with: their
time, the people around them, the work and plans they already have. Never give them a new
project, role or occasion just to hang a step on. "On your next 5 sales calls, ask how
they handle this today" fits a founder; "Film a problem on your ward" forces a nurse.`;

export const readerFit = (readerContext: string | null) =>
  readerContext ? `\n\nAbout the reader, for fit: ${readerContext}\n\n${FIT}` : "";

export const howToApplyInstructions = (readerContext: string | null) => `
## How to apply
1 to 3 things I could actually do, concrete and specific, not principles.
"Do a 10 minute phone-free wind-down before bed on school nights." not
"Prioritise connection." If there is nothing actionable, return an empty
list rather than inventing something.

Each is one complete sentence, ${HOW_TO_APPLY_TARGET_WORDS} words at most, that reads
naturally after "First,", "Then," or "And finally,": an instruction, never a
label and a colon.

When The steps it gives lists the source's own steps, never repeat them
here: apply or adapt them to me, or say what to do instead of one that
does not hold up.${readerFit(readerContext)}`;

export const howToApplyShape = () => ({
  items: HowToApply.shape.items.element
    .refine((item) => wordCount(item) <= HOW_TO_APPLY_MAX_WORDS, `max ${HOW_TO_APPLY_MAX_WORDS} words`)
    .array()
    .max(3),
});

export const howToApplySection: PromptSection = {
  title: "How to apply",
  key: "howToApply",
  prompt: (input) => howToApplyInstructions(input.readerContext),
  schemaShape: howToApplyShape,
};
