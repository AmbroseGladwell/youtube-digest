import { z } from "zod";
import { WatchAnswer, WatchAnyway } from "@overview/domain";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { offeredLinks } from "../offeredLinks.js";

// The resources block carries the further reading, so leftOut never names it (design 203w).
const LEAVE_LINKS_TO_THE_RESOURCES = `
The links the piece points to are listed with the note, so never name
them, or its further reading, in leftOut.`;

export const readAnywaySection: ArticlePromptSection = {
  key: "watchAnyway",
  prompt: (input) => `
## Read it anyway?
Yes, no, or partial, plus a reason. Default to no. Say yes only if this
note cannot get me to the same place: original reporting or data I would
want to see for myself, an argument whose force is in its working rather
than its conclusion, or writing worth reading for its own sake. It is not
enough that the article is good, or that it has more detail. If a
competent summary would get me to the same place, the answer is no. Assume
I am trying to stop reading these, and that a soft yes costs me time I will
not get back.

The reason is read aloud straight after the answer, as in "No, you can
probably skip the article, the overview covers it." followed by the reason,
so never restate yes, no, or skip in it, and never say again that the
overview covers it. Give the reason itself in one or two sentences. Never
count anything in it, such as how many steps or points there are, and never
say how much of the article something takes up.

Then say what this overview leaves out, as leftOut, in one sentence of 30
words at most, so I can judge for myself: "It leaves out the code samples
and the author's account of the argument with his boss." Name the actual
things: examples, quotes, background, a table, a section. Read it aloud
straight after the reason, so start it with "It leaves out". Never claim
it leaves out nothing, and never say whether that matters; the reason does.${offeredLinks(input.article).length > 0 ? LEAVE_LINKS_TO_THE_RESOURCES : ""}

Say partial when this is true of only part of the article. When you do,
name the parts worth reading as chapterIndexes, counting your own chapters
from 0, at most three. Leave it empty otherwise.`,
  schemaShape: () => ({
    answer: WatchAnswer,
    reason: WatchAnyway.shape.reason,
    leftOut: z.string(),
    chapterIndexes: z.array(z.int().min(0)).max(3),
  }),
};
