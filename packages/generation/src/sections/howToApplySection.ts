import { HowToApply } from "@overview/types";
import type { PromptSection } from "../PromptSection.js";

export const howToApplySection: PromptSection = {
  title: "How to apply",
  key: "howToApply",
  prompt: (input) => `
## How to apply
1 to 3 things I could actually do, concrete and specific, not principles.
"Do a 10 minute phone-free wind-down before bed on school nights" not
"prioritise connection". If there is nothing actionable, return an empty
list rather than inventing something.${
    input.readerContext ? `\n\nAbout the reader, for fit: ${input.readerContext}` : ""
  }`,
  schemaShape: () => HowToApply.shape,
};
