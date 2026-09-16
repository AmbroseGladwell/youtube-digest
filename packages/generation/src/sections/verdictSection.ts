import { z } from "zod";
import { Verdict } from "@digest/types";
import type { PromptSection } from "../PromptSection.js";

export const verdictSection: PromptSection = {
  title: "Verdict",
  key: "verdict",
  prompt: (input) => {
    const conflictOfInterestClause = input.sectionsEnabled.selling
      ? " Also flag it if the creator is selling something the advice conveniently requires."
      : "";
    const claimList =
      input.pastClaims.length === 0
        ? "The reader has no past overviews yet."
        : input.pastClaims.map((claim, i) => `${i}. ${claim.title}: ${claim.claim}`).join("\n");
    return `
## Verdict
Novelty — one of NOVEL / COMPETENT, NOT NEW / RECYCLED — plus a
dubious flag and one or two sentences of reasoning. Be blunt. Most
short-form content is a repackaging of standard advice, and saying so is
the most useful thing you can tell me.

Set dubious only when a claim is stated with more certainty than it has
actually earned — because it contradicts something you are confident is
settled, or because of an undisclosed conflict of interest.${conflictOfInterestClause}
Never set it just because a claim is contested, unresolved (a prediction,
an opinion explicitly framed as one person's view), or simply new or
niche enough that you have nothing to compare it against — that is
ordinary novelty, not dubiousness.

Here are the reader's past claims, by index:
${claimList}
List the indices (if any) whose claim this video recycles, as similarToIndices.`;
  },
  schemaShape: (input) => ({
    novelty: Verdict.shape.novelty,
    dubious: Verdict.shape.dubious,
    reasoning: Verdict.shape.reasoning,
    similarToIndices:
      input.pastClaims.length === 0
        ? z.array(z.int()).max(0)
        : z.array(z.int().min(0).max(input.pastClaims.length - 1)),
  }),
};
