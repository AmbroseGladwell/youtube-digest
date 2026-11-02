# Article notes

What generation makes of an article, the first half of Trello OV-77's third slice. Decided
2026-11-02. Nothing here is visible to a reader yet: the record, the reader and the panel wait
for the agreed design (`OV-77 1 Articles` in Claude Design).

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The forked sections | `packages/generation/src/article/sections/` |
| The prompt, and the article as numbered paragraphs | `composeArticlePrompt.ts`, `articleParagraphs.ts` |
| Paragraph numbers turned into places | `assembleArticleNote.ts` |
| Calling the model, with one correction | `requestGeneratedOutput`, shared with videos |
| The result | `ArticleNote`, `ArticlePlace`, `articlePlaceUrl` in `packages/domain` |

## Forked, not conditional

`prototype/summary-prompt.md` is built around video, so the article sections are their own files
rather than branches inside the video ones. The structure, the word limits, the bluntness and the
verdict scale are unchanged, and the limits are imported so the two can't drift. What changed:

- **Read it anyway?** Defaults to no, as watching does. Yes needs a reason the note can't meet:
  original reporting or data the reader would want to see, an argument whose force is in its
  working, or writing worth reading for its own sake. Partial names up to three chapters rather
  than paragraphs, because an article with no headings would otherwise show a paragraph's opening
  words as the name of the part. It shares the reader's `watchAnyway` toggle, since it is the same
  choice about the same part of the note.
- **News is judged on the reporting, not the event.** A rewrite of yesterday's announcement is
  common knowledge. Key points say what a story's claims rest on.
- **A site's own subscribe prompt is not selling**, as asking for likes isn't for a video.
- **Figures are quoted, never worked out.** A real run turned $1,080 and $480 into "saved $600".
  The sum was right, and it is still a model doing arithmetic (`docs/prototype/constraints.md`).
- **The page is content, not instructions.** It's a stranger's page rather than captions, so the
  system prompt says so, on top of the escaping videos have.

## Coverage without a rewrite

A reader has to trust that nothing important is missing, and the note still has to be far shorter
than the piece. Those pull against each other, so both are measured rather than left to the prompt.

**The size comes from code.** `articleNoteBudget` takes the measured word count and sets the key
points, their length and the most chapters, from 3 points of 25 words and one chapter under 400
words to 7 points
of 40 words over 6,000. The ceilings are in the schema, so an over-long note goes back to the model.

**Chapters say what the piece says.** A summary states the finding, reason or number in that stretch,
not its subject, and uses the room for what the key points left out. Reading down them gives the
argument. Early versions read as a table of contents.

**Key points have to reach the end.** Two checks in code, each sending the note back naming what is
missing, because asking in the prompt was not enough: telling the model that chapters carry the rest
let its points stop 51% of the way through a listicle.

- Any chapter holding over a quarter of the piece's words needs a key point, at any length. An
  earlier version exempted news on the grounds that it puts the main facts first, and a BBC item's
  points stopped at 39%, skipping the second half of the story.
- At every length, at least one key point comes from the last third, since a short article has
  only one chapter and the first check can't reach inside it.

**It says what it leaves out.** `ReadAnyway.leftOut` names the things the note doesn't carry, such
as the code samples or a table, and is read aloud after the reason. It doesn't say whether they
matter, because the reason does. The link to the full article belongs beside it on screen.

## The voice follows the video notes

A note is read aloud to someone who chose to listen. The first article budget was too tight and
produced condensed notes: single sentences of 27 to 30 words, chained with commas. Real video notes
in the library run about 2 sentences a point at 15 to 17 words each: a short plain statement, then the
evidence, with the speaker named. The prompt now asks for that shape, says who claims what, limits
comma lists, and the budget gives a 1,500 word article what an 11 minute video gets.

| Article | Words | Note length | Key points reach | Sentences a point | Words a sentence |
|---|---|---|---|---|---|
| BBC news item | 335 | 58% | 72% | 2.0 | 13 |
| Blog post | 1,241 | 29% | 82% | 2.0 | 19 |
| BBC investigation | 1,529 | 20% | 91% | 2.2 | 15 |
| Listicle | 2,786 | 12% | 87% | 2.0 | 15 |
| Essay | 10,535 | 4% | 87% | 2.0 | 18 |

Note length counts the main note, not the chapters. Measured 2026-11-02 on one run each, so treat
these as a first reading rather than a guarantee. Voice costs length: the tighter budget had the
news item at 48%.

## Chapters

Articles keep them (decided 2026-11-02). They may matter more here, since they give a map to pages
with no headings. The article's own headings guide the split, but the model finds the changes
where there are none.

## Positions are paragraphs

The model is never asked where something is in any unit but a paragraph number, as it is only
given segment numbers for a video (`docs/prototype/constraints.md`). `assembleArticleNote` turns the
number into an `ArticlePlace`: the heading's id for a section's first paragraph, otherwise that
paragraph's first eight words for a text fragment. A number outside the article stops the run.

**Pages change.** The quote is taken when the note is made, and no text is kept to repair it with.
If the words later change, the link opens at the top of the page. That's why the mock-up says so.

## No article text is kept

Decided 2026-11-02. Only the note and metadata are stored. So there's no Transcript tab, links go
to the live page, regenerating means opening the article again, and the shared cache holds no
articles. Nothing in this slice writes to `TranscriptStore`.

## Why ArticleNote isn't an Overview yet

`Overview` holds times: `TimeRange` on key points, `startMs` on chapters. Adding `web` to `Source`
makes every reader that assumes a video a compile error, and each needs a design answer. So
`ArticleNote` stands alone until that's agreed, and the next PR decides how it becomes a record.
One article will count as one overview against a plan's total.

## Not built

The `web` kind and its id, the stored record, spoken lines
for "Read it anyway", the panel's Create button, the right-click menu item, and the reader and
library screens.

## Testing

`generateArticleNote.test.ts` covers the prompt's wording, paragraph numbering, a hostile title, a
section switched off, places, partial answers, corrections going back to the model, thin notes and
the conversion each provider receives. All use a simulated model.

**Real articles, 2026-11-02.** Five pages through `DEFAULT_MODEL.anthropic`: a BBC investigation, a
short BBC news item, a blog post, a 10,500-word essay and a listicle. Each took 15 to 31 seconds.
Four answered no and the essay partial; the listicle, the blog and the news item came back as
common knowledge. Every place quoted words on the page, and every figure traced to the article.
Five notes prove the shape works rather than that the judgement holds, so a wider run still belongs
in the OV-92 harness.
