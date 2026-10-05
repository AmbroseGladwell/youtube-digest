import { z } from "zod";
import { DubiousClaim, MAX_DUBIOUS_CLAIMS, Verdict } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { SegmentRangeShape } from "./watchAnywaySection.js";

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
Novelty: one of COMMON_KNOWLEDGE / FRESH_ANGLE / ORIGINAL, plus what
stands out, any dubious claims and one or two sentences of reasoning.

Novelty answers one question only: how much of this would a well-read
person in the video's field already know? Judge it against what you know
of the field, never against the reader's past overviews below. Having
seen an idea before in the reader's library does not make it common
knowledge, and seeing it for the first time there does not make it new.

- COMMON_KNOWLEDGE: standard knowledge in the field, however well
  explained. A clear walkthrough of compound interest, or of progressive
  overload, is common knowledge.
- FRESH_ANGLE: mostly common knowledge, with one fresh part: a method, a
  number or a demonstration that a well-read person probably has not met.
  Standard retirement advice built around a worked year-by-year drawdown
  spreadsheet is a fresh angle.
- ORIGINAL: the central claim, method or evidence is something most
  people in the field would not know. A creator presenting their own
  controlled trial of a technique, with results, is original.

Be blunt. Most short-form content is a repackaging of standard advice,
and saying so is the most useful thing you can tell me. Common knowledge
is not an insult; it is the honest answer for most videos. If what you
know of the field may be out of date for this topic, judge from what you
do know and say so in the reasoning.

standsOut names the fresh part in one short line, for FRESH_ANGLE and
ORIGINAL only: the thing itself, not praise of it, and the same part the
reasoning calls fresh. It is null for COMMON_KNOWLEDGE. Give the stretch
of the video where it is shown or explained as
startSegmentIndex/endSegmentIndex, taken from the numbered transcript
segments below; don't estimate a time. Use null when no one stretch
carries it.

Never begin the reasoning with the novelty word itself; the label is
shown beside it and the reasoning is read aloud on its own. Don't repeat
standsOut in it either.

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

Separately from novelty, here are the reader's past claims, by index:
${claimList}
List the indices (if any) whose claim this video repeats, as similarToIndices.`;
  },
  schemaShape: (input) => ({
    novelty: Verdict.shape.novelty,
    standsOut: z
      .object({
        text: z.string(),
        range: input.transcript.length === 0 ? z.null() : SegmentRangeShape.nullable(),
      })
      .nullable(),
    dubiousClaims: z
      .array(
        z.object({
          claim: DubiousClaim.shape.claim,
          basis: DubiousClaim.shape.basis,
          reason: DubiousClaim.shape.reason,
          segmentIndex:
            input.transcript.length === 0 ? z.null() : z.int().min(0).max(input.transcript.length - 1),
        }),
      )
      .max(MAX_DUBIOUS_CLAIMS),
    reasoning: Verdict.shape.reasoning,
    similarToIndices:
      input.pastClaims.length === 0
        ? z.array(z.int()).max(0)
        : z.array(z.int().min(0).max(input.pastClaims.length - 1)),
  }),
};
