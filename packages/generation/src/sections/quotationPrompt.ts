// What a quotation is for, shared by video and articles so the two can't drift. Measured on
// 10 Nov 2026: quoting where a point is said gave the point back in looser words, so a quotation
// now illustrates the point instead (docs/features/overview-generation-decisions.md, "Evidence").
export const quotationPrompt = ({ source, most, where }: { source: "video" | "article"; most: number; where: string }): string => `
## Quotations
A quotation illustrates a point in the ${source}'s own words: an example, a
story, a demonstration, a worked case, a piece of dialogue, or the
specific data or study behind it. It shows the point rather than says it.
Never quote the sentence that states the claim, or anything that says the
point again in other words: I already have the point.
Good, for "If a follow-up still gets a flat answer, change the subject":
the passage where the speaker acts out asking "How's your work going?",
hearing "Yeah, good", and trying one more question.
Bad, for the same point: the sentence where the speaker says not to force
every topic deeper.

Choose a self-contained passage of a few sentences that makes sense on its
own from its first word to its last. A passage that runs long is left out
rather than cut, so keep it short. Name it ${where} Code copies it word for
word, so you never write a quotation yourself.

Quote ${most} points at most, and only where the ${source} has something that
shows the point; most points have nothing like that, and get no quotation.
Set both to -1 on every point without one.`;
