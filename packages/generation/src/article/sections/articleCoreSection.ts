import { z } from "zod";
import { CoreFields, wordCount } from "@overview/domain";
import { articleNoteBudget, mostWordsPerKeyPoint } from "../articleNoteBudget.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";
import { paragraphIndex } from "./paragraphIndex.js";

export const articleCoreSection: ArticlePromptSection = {
  key: "structural",
  prompt: (input) => {
    const { keyPoints, wordsPerKeyPoint } = articleNoteBudget(input.article.wordCount);
    return `
## In one line
What this piece IS, not what it argues. One sentence, 25 words at most.
Cover the form and the subject: a reported story, an opinion column, a
how-to post, a personal essay, and what territory it covers. This is the
line I read when scanning, so it has to be enough on its own for me to
remember which article this was.
Good: "A reported piece on why one town's bridge repairs cost twice the
original estimate."
Bad: "An insightful exploration of infrastructure challenges."
Never start it with "This article" or "An article about". Never repeat
the site's name, which already has its own field.

## Core claim
One sentence, 60 words at most. The single most important thing to take
from this piece: the claim, if it's arguing one; the substance, plainly
described, if it's reporting or explaining something instead. For a news
story, that is who did what and when. If it asserts nothing and is pure
vibes, say so plainly and set thin to true.

## Key points
At most ${keyPoints} points, and at least 3. This note has to be far shorter than
the piece it replaces, so it is a judgment of what matters, never a
paragraph by paragraph retelling. Strip the anecdote that opens it, the
scene setting, the restatement, the background, and the call to subscribe.

The reader must be able to trust that nothing important is missing, so the
points together have to represent the whole piece through to its end, not
just its opening. Don't spend them all on the first half of a long piece.
In a news story, where the main facts come first, follow the importance.
Never repeat the core claim in a key point: each point adds something new.

Each point is one to three complete sentences, ${wordsPerKeyPoint} words at most, that
make sense heard on their own: never a noun phrase or a fragment. This is
read aloud to someone who chose to listen, so it has to sound like a person
telling them about it, not like condensed notes. Open with the point in a
short plain sentence, then give the evidence or example in the next. Two
short sentences are better than one long one. Never chain more than three
things in a comma list.

Say who says it. Use the author's or the piece's name and verbs like says,
argues, cites or found, and keep anything said by one person as theirs.
Good: "Pretty and premium are different. Packaging studies from 2010 and
2021 found that looks get a product picked, but evidence of a good product
is what gets it called premium."
Bad: "Premium requires evidence, consistency, recovery and care."

Keep the specifics that make a point worth having: names, numbers,
dates, studies, and the concrete steps. Always keep any caveat, criticism
or counter-argument the piece itself raises, and keep who claims
something when the piece presents it as one person's claim rather than
settled fact. For a news story, say what its claims rest on: named
sources, unnamed sources, documents, or nothing stated.

Each is read aloud after a linking word such as "First," or "Then,", so
never open a point with its own number, a label and a colon, or a heading.
Good: "Adding sets grows the arms faster than adding weight, as long as
each set is taken close to failure."
Bad: "Volume over load."

Give each point the paragraph it comes from, as paragraphIndex, taken from
the numbered paragraphs below, so the reader can go to it. When the piece
builds a point over a run of paragraphs or a whole section, give the
paragraph where that run begins. Use null only when the point gathers
places far apart in the piece, so no one paragraph is a fair place to
start reading.`;
  },
  schemaShape: (input) => {
    const budget = articleNoteBudget(input.article.wordCount);
    const mostWords = mostWordsPerKeyPoint(budget);
    return {
      ...CoreFields.shape,
      keyPoints: z
        .object({
          text: z.string().refine((point) => wordCount(point) <= mostWords, `max ${mostWords} words`),
          paragraphIndex: paragraphIndex(input).nullable(),
        })
        .array()
        .min(3)
        .max(budget.keyPoints),
    };
  },
};
