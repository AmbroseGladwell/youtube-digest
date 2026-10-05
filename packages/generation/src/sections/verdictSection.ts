import { z } from "zod";
import { DubiousClaim, MAX_DUBIOUS_CLAIMS, Verdict } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const DUBIOUS_CLAIM_TARGET_WORDS = 25;
export const DUBIOUS_REASON_TARGET_WORDS = 30;

export interface DubiousClaimShape {
  claim: string;
  basis: DubiousClaim["basis"];
  reason: string;
  segmentIndex: number | null;
}

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
    const whereClause =
      input.transcript.length === 0
        ? "There is no transcript, so give segmentIndex as null."
        : "Name where it is said as segmentIndex, taken from the numbered transcript segments below. Never estimate a time: the segment number is the position.";
    return `
## Verdict
Novelty — one of NOVEL / ESTABLISHED / RECYCLED — plus any dubious
claims and one or two sentences of reasoning. Be blunt. Most
short-form content is a repackaging of standard advice, and saying so is
the most useful thing you can tell me. Never begin the reasoning with
the novelty word itself; the label is shown beside it and the reasoning
is read aloud on its own.

List a claim as dubious only when it is stated with more certainty than it
has actually earned — because it contradicts something you are confident is
settled, or because of an undisclosed conflict of interest.${conflictOfInterestClause}
Never list one just because it is contested, unresolved (a prediction,
an opinion explicitly framed as one person's view), or simply new or
niche enough that you have nothing to compare it against — that is
ordinary novelty, not dubiousness. Most videos have none: leave
dubiousClaims empty unless one clears that bar.

For each dubious claim, ${MAX_DUBIOUS_CLAIMS} at most and the worst first:
- claim: the claim in the video's own words, as close to the transcript
  as you can, ${DUBIOUS_CLAIM_TARGET_WORDS} words at most.
- basis: contradictsSettled or conflictOfInterest.
- reason: one sentence, ${DUBIOUS_REASON_TARGET_WORDS} words at most, saying specifically what
  is wrong with it — what the settled evidence says instead, or what the
  creator stands to gain. Never restate the claim.
- ${whereClause}

Here are the reader's past claims, by index:
${claimList}
List the indices (if any) whose claim this video recycles, as similarToIndices.`;
  },
  schemaShape: (input) => {
    const lastIndex = input.transcript.length - 1;
    return {
      novelty: Verdict.shape.novelty,
      dubiousClaims: z
        .array(
          z.object({
            claim: DubiousClaim.shape.claim,
            basis: DubiousClaim.shape.basis,
            reason: DubiousClaim.shape.reason,
            segmentIndex: input.transcript.length === 0 ? z.null() : z.int().min(0).max(lastIndex),
          }),
        )
        .max(MAX_DUBIOUS_CLAIMS),
      reasoning: Verdict.shape.reasoning,
      similarToIndices:
        input.pastClaims.length === 0
          ? z.array(z.int()).max(0)
          : z.array(z.int().min(0).max(input.pastClaims.length - 1)),
    };
  },
};
