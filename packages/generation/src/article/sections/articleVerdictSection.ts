import { z } from "zod";
import { DubiousClaim, MAX_DUBIOUS_CLAIMS, Verdict } from "@overview/domain";
import { DUBIOUS_CLAIM_TARGET_WORDS, DUBIOUS_REASON_TARGET_WORDS } from "../../sections/verdictSection.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { paragraphIndex, quoteSentenceFields } from "./paragraphIndex.js";

export const articleVerdictSection: ArticlePromptSection = {
  key: "verdict",
  prompt: (input) => {
    const conflictOfInterestClause = input.sectionsEnabled.selling
      ? " Also flag it if the author is selling something the advice conveniently requires."
      : "";
    const claimList =
      input.pastClaims.length === 0
        ? "The reader has no past overviews yet."
        : input.pastClaims.map((claim, i) => `${i}. ${claim.title}: ${claim.claim}`).join("\n");
    return `
## Verdict
Novelty: one of COMMON_KNOWLEDGE / FRESH_ANGLE / ORIGINAL, plus what
stands out, any dubious claims and one or two sentences of reasoning.

Novelty answers one question only: how much of this would a well-read
person in the article's field already know? Judge it against what you know
of the field, never against the reader's past overviews below. Having
seen an idea before in the reader's library does not make it common
knowledge, and seeing it for the first time there does not make it new.

- COMMON_KNOWLEDGE: standard knowledge in the field, however well
  written. A clear explainer on compound interest, or on progressive
  overload, is common knowledge.
- FRESH_ANGLE: mostly common knowledge, with one fresh part: a method, a
  number or an example that a well-read person probably has not met.
  Standard retirement advice built around a worked year-by-year drawdown
  table is a fresh angle.
- ORIGINAL: the central claim, method or evidence is something most
  people in the field would not know. An author presenting their own
  controlled trial of a technique, with results, is original.

For news, judge the reporting rather than the event. Original reporting
with its own sources or documents is ORIGINAL. A rewrite of an
announcement, or of another outlet's story, is COMMON_KNOWLEDGE even when
it happened yesterday.

Be blunt. Most articles repackage standard thinking, and saying so is the
most useful thing you can tell me. Common knowledge is not an insult; it
is the honest answer for most pieces. If what you know of the field may be
out of date for this topic, judge from what you do know and say so in the
reasoning.

standsOut names the fresh part in one short line, for FRESH_ANGLE and
ORIGINAL only: the thing itself, not praise of it, and the same part the
reasoning calls fresh. It is null for COMMON_KNOWLEDGE. Give the paragraph
where it is shown or explained as paragraphIndex, taken from the numbered
paragraphs below. Use null when no one paragraph carries it. Then, if that
paragraph or the rest of its section shows the fresh part in the article's
own words (the example, the demonstration or the data, never the sentence
that names it), give that short passage as quoteStartSentence/quoteEndSentence
from the numbered sentences {n} so code can quote it word for word;
otherwise, and when it has no paragraph, set both to -1.

Never begin the reasoning with the novelty word itself; the label is
shown beside it and the reasoning is read aloud on its own. Don't repeat
standsOut in it either.

List a claim as dubious only when it is stated with more certainty than it
has actually earned, because it contradicts something you are confident is
settled, or because of an undisclosed conflict of interest.${conflictOfInterestClause}
Never list one just because it is contested, unresolved (a prediction,
an opinion explicitly framed as one person's view), or simply new or
niche enough that you have nothing to compare it against. That is
ordinary novelty, not dubiousness. Most articles have none: leave
dubiousClaims empty unless one clears that bar.

For each dubious claim, ${MAX_DUBIOUS_CLAIMS} at most and the worst first:
- claim: the claim in the article's own words, as close to the text as
  you can, ${DUBIOUS_CLAIM_TARGET_WORDS} words at most.
- basis: contradictsSettled or conflictOfInterest.
- reason: one sentence, ${DUBIOUS_REASON_TARGET_WORDS} words at most, saying specifically what
  is wrong with it: what the settled evidence says instead, or what the
  author stands to gain. Never restate the claim.
- paragraphIndex: where it is said, taken from the numbered paragraphs
  below.

Separately from novelty, here are the reader's past claims, by index:
${claimList}
List the indices (if any) whose claim this article repeats, as similarToIndices.`;
  },
  schemaShape: (input) => ({
    novelty: Verdict.shape.novelty,
    standsOut: z.object({ text: z.string(), paragraphIndex: paragraphIndex(input).nullable(), ...quoteSentenceFields(input) }).nullable(),
    dubiousClaims: z
      .array(
        z.object({
          claim: DubiousClaim.shape.claim,
          basis: DubiousClaim.shape.basis,
          reason: DubiousClaim.shape.reason,
          paragraphIndex: paragraphIndex(input),
        }),
      )
      .max(MAX_DUBIOUS_CLAIMS),
    reasoning: Verdict.shape.reasoning,
    similarToIndices:
      input.pastClaims.length === 0
        ? z.array(z.int()).max(0)
        : z.array(
            z
              .int()
              .min(0)
              .max(input.pastClaims.length - 1),
          ),
  }),
};
