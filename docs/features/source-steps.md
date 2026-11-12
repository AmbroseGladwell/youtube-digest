# The steps it gives

When a video or article tells its audience what to do, the note carries every step it gives, in
its order, from the source alone. Trello OV-250, decided with the owner on 9 Nov 2026 and built
from 11 Nov 2026. It closes the gap OV-251's steps check measured: on the prompt before it, about
a third of what a video told you to do was missing from its note, and nearly every note missing
something still told the reader to skip the video.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The block's shape | `SourceSteps`, `SourceStep` in `packages/domain`; `Overview.sourceSteps`, schema version 17 |
| Which notes get it | the kind check's `process` kind (`NoteKind`, `checkNoteKind.ts`, `sectionRegistry.ts`) |
| Asking for it | `sourceStepsSection.ts` (videos), `articleSourceStepsSection.ts` (articles) in `packages/generation` |
| No steps, no block | `sourceStepsOf.ts` |
| Outside the app | `overviewMarkdown` ("The steps it gives"), so an assistant over MCP has it |
| Shares | `SharedNote.sourceSteps`, absent rather than null, so a copy's hash doesn't move |
| Measuring it | `npm run steps` (OV-251) reads the block as part of the note and counts it in spoken length; `npm run kinds` scores the kind check |

The reader page, the read-along, the reader's section toggle and analytics come with the block's
design (the second slice of OV-250).

## Only on a process note

The kind check that already tells a recipe apart (OV-275) also answers `process` when the source
tells its audience to do something concrete, even inside an interview or a story, and even later
than the opening it reads. Only a `process` note is asked for steps, and only its key points and
How to apply are told to leave the steps to the block. A `default` note is asked what it was
before, apart from Watch it anyway's rule against counting (below), so a source that gives no steps can't lose anything to this block, and can't be
given steps it does not have.

When unsure, the check answers `process`, the opposite of its rule for recipes: a wrong `process`
costs an empty list, while a wrong `default` loses the block and is no worse than before.

Articles don't go through the kind check yet (OV-276), so an article is always asked for its steps
and returns none when it gives none.

## Steps, not How to apply

How to apply is the reader's own application. It uses what the reader has told us, holds three
items, and may sensibly go beyond the source
(`docs/features/personalisation.md`). The steps block is the other thing: what the source says to
do, in its order, with nothing added. Keeping the two apart is what makes "this is the process the
video gives" visible next to "this is what you might do about it". So How to apply is told to apply
or adapt the steps, or to say what to do instead of one that does not hold up, and never to repeat
them.

Key points leave the steps to the block too, and keep the idea or the reason behind them. Without
that line a note said its steps twice. GPT-6.1 Sol follows it: 3 of its 232 steps repeat a key
point. Claude doesn't, quite: Sonnet 5.5 repeated a quarter of its steps and Opus 5.5 about a
third, and a further line telling key points never to be instructions barely changed Sonnet, so it
was dropped. OV-283 tells readers on their own key that the model they choose changes the note.

## What counts as a step

The source's own instructions and rules, plus what a step depends on: its conditions, amounts and
timings, what to avoid where it says so, and how to tell it is working ("if the soreness has faded
by day three, you are on track"). That last kind is the one notes dropped most: Dr K's success
check, "if you can complete the act, you are on the right path", was the card's worked example.

Never a sponsor read, a call to like, subscribe or buy, or a vague exhortation. A source that
argues, explains, reviews or reports rather than telling the reader what to do gives an empty list,
and the note has no block, not an empty one.

## Rules

- **Completeness over brevity.** No count cap a real protocol can reach: at most
  `MOST_SOURCE_STEPS` (25), only to stop a runaway list. Each step is bounded instead, at
  `SOURCE_STEP_TARGET_WORDS` asked and `SOURCE_STEP_MAX_WORDS` enforced.
- **Dubious steps stay, flagged.** A shaky step is still what the source says. Dropping it would be
  a quiet omission; the verdict's dubious claims say why it does not hold up.
- **Each video step has its moment**, as a key point does, and loses only its link when the
  stretch does not fit the transcript. An article's steps have no position, like its key points.
- **A recipe has no block.** Its method is its steps (`recipe-notes.md`).
- **Watch it anyway never counts or times.** The reason says what the parts are, never how many
  steps there are or how much of the running time something takes (`docs/prototype/constraints.md`).
  Dr K's reason had said "four simple instructions" and "much of the running time".

## Measured

On the 20-video set, two runs a side, the share of what a video tells you to do that its note
misses fell from 30% and 32% to 19% and 14% for Sol, and from 29% and 26% to 28% and 21% for
Sonnet, whose misses were notes it gave no block; once told to give one whenever the video says
to do something, Sonnet missed 9 of 45 items on the six videos it had skipped, where it had
missed 25 and 16. Where a note has the block, almost nothing is missing. A note with a block is
about 30 to 55 seconds longer to hear. The full tables are in
`docs/architecture/model-comparison.md`, "The steps block (OV-250)".
