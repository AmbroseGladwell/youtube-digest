# Overview quality: what an overview is for, and what would make it better

Written 7 Nov 2026, from two outside conversations the owner brought in
(`docs/reference/chatgpt-overview-quality-and-context.md` and
`docs/reference/gemini-longform-podcast-pipeline.md`). **Nothing here is decided.** It
exists to separate the one product question that has to be answered by the owner from the
changes that follow it, and to price each change against what has actually been measured
rather than against either conversation's own arithmetic.

The question it hangs on is `open-questions.md` #6.

## The fork: triage or comprehension

**Answered 7 Nov 2026: comprehension, with the triage kept inside it.** The overview carries
enough substance to stand in for the source, and the verdict stays part of it. Recorded in
`open-questions.md` #6, with what it settles and what it leaves open. The rest of this section
is the argument as it stood, kept because the costs below turn on it.

The two conversations agree on almost everything mechanical and disagree, without
noticing, about what an overview is for. So does the repo, with itself.

**Triage**, which is what `README.md` says the product is:

> It isn't a storage problem. It's a triage problem: most saved content is not worth your
> time, and you can't tell which until after you've spent it.
>
> The output is deliberately not a summary. A summary is shorter content. This produces a
> judgment.

Its principles follow from that. Default to not watching. Be blunt. "A tool that tells you
everything you saved was insightful is worthless." The verdict distribution across a real
library should be unflattering. `summary-prompt.md` strips the hook, the story, the
restatement and the call to action, and caps key points at five.

**Comprehension**, which is what the ChatGPT framework proposes:

> Understand more. Spend less time.
>
> Comprehensive understanding: Don't miss important substance just to make something
> shorter.

Its success measure is "whether someone who hasn't consumed the original can accurately
explain its important ideas, understand why they matter, and distinguish the author's
arguments from the evidence supporting them."

These pull opposite ways on the same input. A two-hour podcast that repackages standard
advice gets a blunt verdict and a short note under triage, and a six-to-ten-minute deep
brief under comprehension. Neither is wrong. They are different products, and almost every
change below moves depending on which one is the spine.

**The repo has already drifted towards comprehension without saying so.** OV-87 raises the
key-point ceiling for long videos. OV-203 asks for more key points on a dense short
article. OV-202 measures coverage of the source. Articles got `paragraphsInTheFinalStretch`
and `chaptersTooBigToSkip`, both of which exist to stop a note missing parts of its source.
Every one of those is a comprehension move made for a good local reason. Nothing has
revisited whether "seven is the ceiling however long the video is" was a cost decision or a
product one.

A plausible answer is that it is not one or the other: the verdict is the triage layer and
the key points are the comprehension layer, and the fork is really about which one gets the
budget when they compete. That is worth considering, but it still has to be decided rather
than drifted into.

## What the ChatGPT framework actually adds

Its six sections map onto what exists more closely than its length suggests:

| Its section | What that is here | Gap |
|---|---|---|
| The big picture | the premise, "in one line" | none |
| The central argument | the core claim | none |
| The key insights | key points | the selection rule differs, below |
| Evidence and standout passages | `standsOut`, one line | **the real gap** |
| What it means | how to apply | none |
| The verdict | the verdict: novelty, what stands out, dubious reasons, `similarTo` | ours is richer |

**It deletes two sections it does not know exist.** Selling and Watch it anyway are not in
its framework. Both are `README.md` design principles, both are reader-toggleable sections
in `sectionRegistry`, and Selling is the one that carries "surface the pattern, not just the
item" (`overview-generation-decisions.md` makes it typed categories precisely so the pattern
can be computed). Its framework is an addition to the sections, never a replacement for
them.

**Its verdict is weaker than ours.** It proposes one editorial assessment of value. The
novelty scale (`novelty-scale.md`) already separates how much of this a well-read person
would know from whether *this reader* has saved it before (`similarTo`), which is the two-axis
split `open-questions.md` #1 asked for. Nothing in either conversation improves on that.

Three things it adds that are genuinely new here:

1. **Choose by significance, not by sequence.** "A two-hour podcast might contain 30
   individual topics, but only seven really matter. The overview should organise those
   seven into three or four coherent themes, rather than reproduce all 30 topics." Today's
   key-points rule in `coreSection.ts` is a subtraction rule (strip the hook, the story,
   the restatement) and a ceiling, never a selection criterion. This is the cheapest change
   in this document and probably the largest one.
2. **Evidence, quoted and attributed.** Distinguish what the source said from what the note
   infers from it. Never invent a quotation or let a paraphrase read as one. Attribute
   disputed claims to whoever made them. Keep the qualifications.
3. **A completeness check against the source, not against another model's opinion.** This is
   OV-202, already on the board, raised independently on 6 Nov 2026 from a Diary of a CEO
   episode. The framework arrives at the same place from the opposite direction, which is
   mild evidence the card is pointed at a real thing.

## What the Gemini conversation adds, and the premise it rests on

Almost all of it is either already decided here with better numbers, or wrong about this
build.

- **Its "Shared vs Personal Core pattern" is OV-19**, decided 19 Oct 2026, measured, written
  up in `cost-model.md`, with OV-124 as the build card.
- **Its pricing redesign argues against `tiers.md`** using figures it invented. `tiers.md`'s
  allowances come from OV-92's measured $0.038 an overview.
- **Its podcast ingestion cascade is OV-106**, which is more careful than the advice: OV-106
  already has the shared cache, the Podcasting 2.0 `<podcast:transcript>` rung, the
  same-episode-on-YouTube rung, speech to text last and metered, and it already names
  Spotify exclusives and Apple's missing API as the hard cases. It also insists the hosted
  against self-hosted choice is measured rather than argued, which the conversation does not.
- **Its headline recommendation rests on a false premise.** It was told chapters are a
  separate call from the overview. They are not: `composePrompt.ts` builds one system prompt
  from `sectionRegistry`, chapters included, and `generateOverview` makes one call against
  one schema. Its "optimised 2-step ingestion pipeline", feeding chapters into a second
  overview pass "without spending a single extra penny", would add a call here, not remove
  one.

The underlying idea, that a long source should be understood in structured pieces before it
is written up, is the second slice of OV-87 and is already written there, with the warning
that it costs more passes and must be measured rather than assumed.

What it is worth reading for: the reminder that "loss in the middle" is the specific failure
mode at length, which is exactly what OV-202 exists to detect.

## The structure: what an improved overview looks like

Worked out with the owner on 8 Nov 2026, after #6 was answered. **Two new fields, not a new
format.** Reading `coreSection.ts` against the outside framework, almost everything it
proposes already exists here under another name, and the two things that do not are small.

### What is genuinely missing

- **A big picture, and the premise cannot become one.** The premise is explicitly a scanning
  field: 25 words, "what this video IS, not what it argues", format and territory, "the line I
  read when scanning, so it has to be enough on its own for me to remember which video this
  was." That is a library-row label. Widening it wrecks the list without producing orientation,
  which is why a long-form note reads thin at the top: you get a label, then a claim, with no
  ground under either.
- **Evidence under the key points.** Points already carry `startSegmentIndex`/`endSegmentIndex`,
  but a range is navigation, not evidence. Nothing shows what was actually said.

Everything else in the framework is already here and mostly better: `coreClaim` is already 60
words rather than a sentence, "what it means" is How to apply and is personalised, and its single
editorial verdict is weaker than novelty plus what stands out plus dubious plus selling.

### The order, and the rule that keeps triage alive

**The rule: a reader must reach the verdict before they reach anything long.** If someone has to
get through six minutes to find out something was recycled, triage is dead.

**That rule is already satisfied**, because the verdict sits third in `overviewNoteLines.ts`,
ahead of the key points. The note does not need rearranging to protect triage; it needs the two
new fields placed without breaking it.

**Decided by the owner, 8 Nov 2026: what it sells and watch it anyway stay last.** An earlier
draft of this section proposed hauling both into a triage block at the top. That was wrong:

- **Watch it anyway is not a triage signal, it is the conclusion** the verdict leads to. The
  verdict is the signal, and it is already early.
- **The narration's close is worth protecting.** The spoken script ends on "No, you can probably
  skip the video, the overview covers it", which is where the product's argument lands. A
  listener hears everything in order and gains nothing from a front-loaded conclusion, so moving
  it would have cost the ending for no benefit.

So one order serves both surfaces, and the reading-against-listening tension does not arise.

| | Section | Grows with length |
|---|---|---|
| **Opens** | premise, 25 words | no |
| | verdict: novelty, what stands out, dubious | no |
| **Comprehension** | **the big picture** (new) | yes |
| | the core argument (`coreClaim`) | a little |
| | key points, each with its evidence (new) | yes |
| | how to apply | no |
| | chapters, transcript | yes |
| **Closes** | what it sells | no |
| | watch or listen to it anyway | no |

The one question left was where the big picture lands relative to the verdict and the core
argument (OV-227, merged into OV-225). The recommendation was premise, verdict, big picture, core
argument.

**Decided by the owner, 9 Nov 2026: premise, big picture, core argument, verdict.** The ground
comes before the answer. **This relaxes the rule above on long sources**:
their note has a paragraph before the verdict. Recorded in `overview-generation-decisions.md`,
"The big picture".

### Three orienting fields that must not repeat each other

The failure mode of adding a big picture is three paragraphs that all read as summaries. The
distinction has to be stated in the prompt, not hoped for:

| Field | Answers | Never does |
|---|---|---|
| Premise | what this **is** | say what it argues |
| Big picture | the **ground** the argument stands on: what question is being engaged, why it matters, **and what else the source covers that the core argument cannot** | restate either of the others |
| Core argument | what it **answers**, singular | carry a second thread |

The thing, the ground, the answer.

**Asked 8 Nov 2026: are the premise and the big picture distinct enough to coexist?** The answer
is that they cannot merge, because they live in different places. The premise is a **list** field:
the library row, `search_overviews`'s light listing, `buildSearchHaystack`. Its 25-word cap exists
so a hundred rows stay scannable, and a paragraph cannot do that job.

**But on the note page both would appear in sequence and read repetitively**, which the 71% figure
below is evidence of. So the proposal is to keep both fields and **stop showing the premise on the
note page**: the big picture opens the note, the premise fills in where a short source earns no big
picture, and the two never appear together. The repetition is then prevented structurally rather
than by asking the prompt to avoid it. The distinction that makes it hold is that **the premise is
about the artefact and the big picture is about the subject.** The owner adopted this on 9 Nov
2026, then put the premise back first the same day: the two now sit next to each other, the
premise saying what the source is and the big picture the ground under it, and the prompt's
three-way split keeps them apart. The deletion test passed 97% on the harness (OV-225).

**Decided 8 Nov 2026: a recipe gets no big picture.** A recipe has no argument to set up, and
its premise is already its orientation. Articles get one on the same rule as video, or the fork
drifts further.

**Decided 8 Nov 2026: the big picture is structural**, like the premise and the key points,
rather than one of the four sections a reader can switch off
(`overview-generation-decisions.md`, "The composable prompt"). A note without it is a note with
no ground under its claim.

**The third column of the big picture's row is the part that was nearly missed, and the example
proves it.** Decomposing the 101-word "big picture" the outside conversation wrote for a real
note on the Rieseberg interview:

| | Words | |
|---|---|---|
| Restates the premise | 23 | already a field |
| Restates the central argument | 48 | already a field |
| **The second thread: software gets cheaper, so customer empathy becomes the advantage** | **30** | **genuinely new** |

**71% of it duplicated fields that already exist.** The 30 words that did not are the interview's
*other* subject, which `coreClaim` cannot carry because it is deliberately singular: "the single
most important thing to take from this video". In the original note that thread had nowhere to
live but key point 7, which is exactly why the rewrite kept promoting it into sections of its own.

So the big picture earns its place by carrying scope, not by restating substance. **A big picture
that could be deleted without losing anything the premise and the core argument do not already
say is a failed one**, and that is a testable property rather than a matter of taste.

**The central argument needs no new work.** `coreSection.ts` already gives `coreClaim` 60 words
and the right scoping. The outside framework's version of it is 48 words saying the same thing.
The only open question is whether it should grow on very long sources, and OV-227 asks it.

### Evidence: the model points, code quotes

**Do not ask the model to write quotations.** Have it name the one or two transcript segments
inside a key point's existing range that carry the claim, and have code lift the text verbatim.

- **Fabrication becomes structurally impossible** rather than checkable after the fact. It is the
  same discipline as `docs/prototype/constraints.md`'s "never let a model count": the model
  points, code quotes.
- **Output barely moves.** It emits indices, not prose.
- **It reads aloud**, because the quote is a real sentence someone said, introduced naturally.
  A model-written pseudo-quote is not.
- **It works unchanged for articles and recipes**, which already position by paragraph.

This supersedes the "if it is a new field" half of OV-216, which left open the possibility of
generated quotations.

### How much evidence, and how long: the two budgets that fight

Added 8 Nov 2026, from the owner's own statement of the promise and from measuring the
worked example the outside conversation produced.

**The promise, in the owner's words:** a reader should trust they are getting a very good
understanding of what the source was about without consuming the whole thing, **and** the
overview has to be short enough that listening to it is considerably easier than listening to
the original. Those two pull against each other, and every rule below exists because of it.

**The worked example overshot its own target, measured.** Asked to improve a real note on the
Rieseberg interview, the conversation produced a version it estimated at 4 to 5 minutes of
listening. At `noteTiming.ts`'s own `SPOKEN_WORDS_PER_MINUTE` of 150 it is **7.2 minutes against
the original's 3.2**: 1,088 words against 488.

Counted, not estimated, the extra 600 words went to:

| Added | Words | Worth it |
|---|---|---|
| Six "Why it matters" lines | 165 | **no**, see below |
| "The bigger business lesson" | 132 | **no**, it is the original's key point 7 promoted to a section |
| A note apologising for a quotation it could not supply | 44 | no |
| Fuller explanation inside the insights | ~260 | **yes**, this is the part the owner liked |

So roughly 340 words, over two minutes of the increase, bought no understanding at all. **A
framework that measures only coverage will do this every time**, which is the next point.

**Do not add a "why it matters" per key point.** It is the single largest source of the bloat,
it duplicates How to apply, which already answers it and is personalised, and it breaks the
conversation's own rule against repeating an insight across the points, the takeaways and the
verdict. Where a point's significance genuinely is not obvious, that belongs in the big picture,
which is the field that exists to carry it.

**Evidence is budgeted, not templated.** The conversation's own numbers are 3 to 5 quotations a
note, with timestamps, used "as proof points" rather than one per insight. That is right, and it
answers what OV-216 left open: not every key point gets evidence. The budget belongs on the same
dial as everything else (OV-87), and the quotations go where the claim would otherwise have to be
taken on trust.

**Where the quotation lives, decided 8 Nov 2026: inside the key point it supports**, not in a
section of its own. The owner's call, and it is right for listening as much as for reading: a
claim and the words that back it belong together, and a separate evidence block would be the
"list of six summaries and six quotations" the conversation itself warns against.

**A quoted point may carry one short line on what the quotation adds, and only then.** This is
narrower than the "why it matters" line rejected above, and the difference is the test: that line
said why the *point* mattered, which duplicates How to apply. This says what the *quotation* adds
that the paraphrase cannot, which is a real thing when the speaker hedged, contradicted
themselves, or put it more bluntly than a summary would dare. **If the honest answer would restate
the point, there is no line, and probably no quotation either.** The owner's rule: only if it
does.

`standsOut` is already the "standout moment" the conversation asks for as a separate element, and
under point-not-quote it gains its quotation for nothing.

**It applies across every source kind**, since the mechanism is positional and all three already
position: video and podcasts by transcript segment, articles by paragraph. **Recipes are the
exception**: a recipe has no argument to evidence, and a quoted line from a method step would be
the step itself.

**The owner's wording for the gate, 8 Nov 2026: "why it matters, only if it adds value to the key
point to help understanding."** The line is permitted on any quoted point and earns its place only
by adding understanding the point does not already give. It should be **optional in the schema**
rather than required with a permitted empty string, because a required field is an instruction to
fill it, and it will get filled with restatement. At a ten-point ceiling and about four
quotations, roughly a third of points carry evidence, which is the right density for proof points
rather than a template.

**OV-202 needs a brevity counterweight, or it optimises one way forever.** The five-question test
the conversation ends on includes one nobody has encoded: *have we avoided spending their time on
details that do not materially improve their understanding?* OV-202 measures how much of the
source a note represents. **Coverage alone is trivially gamed by writing more.** The number that
matters is coverage against the note's own spoken length, which `noteTiming.ts` already computes,
so the measure should report a ratio rather than a share. Then OV-87's budget changes can be
judged on whether they bought understanding or merely spent minutes.

### Structure the data, compose the narration

The outside conversation ends by contradicting its own format, and it is right to:

> Rather than making every key point follow a rigid template of insight, quotation, why it
> matters, I'd make the quotation part of the narrative wherever it naturally strengthens
> understanding. The ideal experience is not someone listening to a list of six summaries and six
> quotations. It's someone hearing a coherent, intelligent explanation.

That matters more here than it did there, because listening is the realistic use case rather than
a bonus feature (`README.md`), and a structured note read straight out does sound like a form
being filled in.

**It is not a reason to abandon structure, and the mechanism to have both already exists.**
`spokenScript` composes the narration from `NoteLine`s, and each line carries `line.spoken ??
line.text`, so a line may read differently aloud from how it renders. `coreSection.ts` already
uses this, telling the model never to number its own points because each is read after a linking
word such as "First," or "Then,".

So: **the fields stay structured**, which is what the page, the filters, the migrations and the
MCP connector all need, **and the spoken form introduces evidence in prose** rather than
announcing it. An evidence line's `spoken` is "He puts it this way, …"; its `text` is a
quotation block. Neither the schema nor the reader has to choose.

The audio rules the conversation lists are mostly already in `WRITING_RULES`. Two are not, and
both are worth adding when evidence lands: do not read headings aloud excessively, and do not say
the same insight in the key points, the takeaways and the verdict. The second is checkable.

### Trust: what was said, what we read into it, how good it is

The owner brought this in on 8 Nov 2026 as a non-negotiable editorial standard. It asks every
overview to keep three things apart: **what the source said**, **what we read into it**, and
**how valuable it is**, with six rules under it.

**Most of it is already the standard here, and two parts are stronger than the rule asks.**

| The rule | Here |
|---|---|
| Never invent quotations or make a paraphrase look like one | **Structurally impossible** once evidence lands: the model names segments, code lifts the text (OV-216). A rule can be broken; this cannot |
| Preserve important qualifications and uncertainty | `coreSection.ts`: "always keep any caveat, criticism or counter-argument the video itself raises" |
| Don't omit a significant counterargument because it complicates the summary | the same rule, and it is **stricter than the framework**, which only asks for this at its longest tier |
| Attribute opinions and disputed claims to the person making them | `coreSection.ts`: "keep who claims something when the video presents it as one person's claim rather than settled fact". Naming *which speaker* needs diarisation and is not available on auto-captions (OV-226) |
| Include timestamps or source references | every key point already carries a segment range; articles carry paragraph positions |
| **Don't present an anecdote as proof of a general claim** | **not covered anywhere** |

**The three-way split already exists as fields**, and ours is richer than the one proposed:

- **How valuable it is** is the verdict, and it is two axes rather than one: novelty judged
  against the field, and `similarTo` against the reader's own library (`novelty-scale.md`),
  plus `dubious` and what the source sells.
- **What the source said** is what evidence becomes (OV-216).
- **What we read into it** is the key point's own prose and the big picture.

**What is genuinely missing is one rule and one shape.**

1. **The anecdote rule. Decided 8 Nov 2026: it stands apart from `dubious`, and it is an
   extension of a rule that already exists rather than a new field.** A source that tells one
   story and generalises from it should have that noted, not laundered into a key point that
   reads as established.

   It is not `dubious`, because `dubious` means the claim contradicts mainstream evidence or is
   conveniently self-serving. "Generalises from one story" is **unevidenced rather than wrong**,
   and folding it in would make the flag noisier, which costs exactly what makes the flag worth
   having: it is rare, so a reader believes it.

   **The shape to follow is already in `coreSection.ts`**, which says to "keep who claims
   something when the video presents it as one person's claim rather than settled fact". The
   anecdote rule is the same move one step further: keep the fact that it rests on one case. So
   it belongs in the key-points instruction beside that sentence, not as a field of its own.
2. **A reader cannot tell report from reading inside a key point.** The prose blends both.
   Evidence fixes it for the points that carry a quotation, and leaves the rest as they are.

**The precedent to follow for both is `dubious-reasons.md`,** which already gives each claim
behind the flag **its basis, a reason and its moment in the video**. That is exactly the
report-against-reading split, already designed and shipped for one section. Evidence should match
its shape rather than invent a second vocabulary for the same idea.

### Depth: length plus chapter count, one budget, invisible

**Built in OV-87, 10 Nov 2026, without the chapter count**: `noteBudget.ts` sizes every source,
keyed on spoken or written. Short rows are unchanged, long sources rise to ten points of 60 words
and twenty chapters, and video's long sources get the final-stretch and too-big-to-skip checks.
Density from chapter count stayed on OV-203. The decision and its numbers are in
`docs/features/overview-generation-decisions.md`, "One note budget". What follows is the
reasoning as it stood before.

**Depth by length is already built on one side of a fork and missing on the other.**
`articleNoteBudget.ts` scales key points, words per point and the chapter ceiling from a measured
word count, and `articleChaptersSection.ts` takes its schema `.max()` from it. Video has none of
it: `coreSection.ts` says flatly "Seven is the ceiling however long the video is."

Two article-side mechanisms matter more than the table and video has neither:
**`paragraphsInTheFinalStretch`**, which holds a note to the end of the piece, and
**`chaptersTooBigToSkip`**, which forces any section holding more than a quarter of the source
into the key points. Those are the anti-loss-in-the-middle rules.

**Density is the open question, and the answer is already in OV-203:** a 900-word checklist and a
900-word opinion column are not the same note and no word count tells them apart, so **let the
number of chapters the model found raise the allowance**, since chapters are already its own
reading of how many distinct things the source does. A measured proxy from data the note already
holds, and no second model call. That should be the general rule across all three media rather
than an article fix.

**Checked against the outside framework's three tiers, 8 Nov 2026.** Its quick, standard and
deep briefs map onto the budget more closely than they look, and the differences are worth
naming:

| | Its short | Its medium | Its long | The budget today |
|---|---|---|---|---|
| Key insights | 2 to 3 | 4 to 6 | 6 to 9 | 3 at 400 words, rising to 7 beyond 6,000 |
| Whole-note length | 1 to 2 min | 3 to 5 min | 6 to 10 min | **not budgeted at all** |

**Two of its tier rules should be rejected.**

- **It drops the verdict from the short tier.** Here the verdict is the triage, it is cheap, and
  a two-minute clip is exactly where a reader most wants to be told not to bother. It stays at
  every length.
- **It saves "important disagreements and nuances" for the long tier.** `coreSection.ts` already
  demands them at every length: "always keep any caveat, criticism or counter-argument the video
  itself raises". We are stricter, and should stay stricter.

Its "some content won't have practical takeaways, don't force content that isn't there" is
already the rule: `summary-prompt.md` says write "Nothing actionable" rather than inventing
something.

**Three things are genuinely not covered, and one of them matters a lot.**

1. **The note has no whole-length target, only per-field budgets, and fields multiply.** This is
   the gap that produced the 7.2-minute example above: every field can sit inside its own
   allowance while the note as a whole is twice as long as it should be. The budget should carry
   **a target spoken length per tier**, checkable after generation with `noteTiming.ts`, which
   already computes listen minutes. OV-202's counterweight *measures* total length; nothing
   *targets* it.
2. **Richer should mean longer points, not more of them.** The framework's top tier goes to nine
   insights "grouped into themes". Nine is too many for a flat list and grouping them would be a
   third structure beside points and chapters. **Chapters already are the grouping**, which is
   what `coreSection.ts` means by "let the chapters carry the rest of the structure". So prefer
   raising the words-per-point ceiling over raising the count: that is also where the one
   genuinely good part of the rewritten example went, about 260 words of fuller explanation
   inside the insights.
3. **The ceiling is a number nobody has picked.** OV-87 says raise it for long sources without
   saying to what. Given (2), the answer is probably a modest rise in count and a larger rise in
   words per point.

**The budget governs the big picture too**, or every short video grows a preamble, which is the
padding this product exists to strip.

**It stays invisible.** The outside framework names three depths for the reader ("Quick brief",
"Deep brief"). A label like that tells someone they got the cheap version. The article budget is
invisible today and that is correct.

### What scales and what does not, and the arithmetic that decides it

Worked out with the owner on 8 Nov 2026, from the question: is 6 to 9 key points enough for a
two-hour interview?

**Chapters cost nothing.** An earlier version of this section budgeted chapter summaries into the
note's length and concluded the budget was tight. That was wrong, and the owner caught it.
Chapters are the reader's third tab (`chapters.md`); in `overviewNoteLines.ts` they appear only
as a `chapterIndex` link on a key point, and `noteTiming` counts note lines. **So chapter titles
and summaries are never read aloud and never counted in the read or listen time.** They cost
output tokens and nothing else.

**With chapters out of it, the budget is roomy.** A two-hour source against a 6 to 10 minute
target, at `noteTiming.ts`'s 150 words a minute:

| | Words | Listen |
|---|---|---|
| Today: 7 points at 40, no big picture | 605 | 4.0 min |
| Plus the big picture, core argument at 80 | 775 | 5.2 min |
| 9 points at 60, 4 quotations | 1,155 | 7.7 min |
| 12 points at 60, 5 quotations | 1,365 | 9.1 min |
| 15 points at 60, 6 quotations | 1,575 | 10.5 min |

So **a two-hour source can afford twelve richer points with evidence and still sit inside nine
minutes.** The count was never the constraint it looked like.

#### The real consequence: for a listener, the key points are the whole note

`coreSection.ts` justifies its seven-point ceiling by saying "let the chapters carry the rest of
the structure". **For a listener that promise is empty**, because chapters are never spoken. A
reader can open the third tab; someone walking the dog cannot.

Since listening is the realistic use case (`README.md`), it follows that:

- **Key points plus their evidence have to stand alone.** They are the entire substance anyone
  hears. Nothing downstream rescues a point that was cut.
- **Long sources should get more points, not merely longer ones.** The earlier version of this
  section argued the opposite, on the strength of the wrong arithmetic.
- **Chapters are the reader's map, and the dial to turn is the count, not the length of each
  summary.** See below.

#### Chapters: scale the count, hold the summary

Chapters cost the note nothing, which makes it tempting to let their summaries grow. **That would
break them**, because navigation and coverage want opposite things. A coverage summary tries to
save you the trip; a navigation summary helps you choose where to go. Twenty chapters of rich
prose is not a map, it is a second document nobody can scan.

**The prompt already asks for the right thing**, and should be left alone on this point.
`chaptersSection.ts`: "A chapter is a stretch a reader would skip to, not a paragraph", with a
title of at most 8 plain words and "a summary of one or two sentences (40 words at most) on what
that stretch covers, **so that reading the list down is a map of the video**". It also already
forbids the two ways a chapter list goes wrong: "never split a stretch to make the list longer,
and never merge two subjects to make it shorter".

So, concretely:

- **The count scales, and it needs to scale a lot.** "Most videos have 3 to 8" is the hint at
  every length today. For a two-hour interview that is nowhere near enough to navigate by; the
  right number is more like fifteen to twenty. At 40 words each that is 800 words of output,
  which costs tokens and **zero** reading or listening time.
- **The 40-word ceiling stays**, at every length. It is what keeps a long list scannable, and
  holding it is a positive choice rather than a saving.
- **There is no schema `.max()` on video chapters**, where articles take theirs from the budget
  (`articleChaptersSection.ts`). That is OV-87's to fix.
- **One rule is missing and is the specific navigation failure:** two adjacent chapters whose
  summaries could be swapped without anyone noticing. "Reading the list down is a map" implies
  each entry is distinctive, but nothing says so, and nothing checks it. On a long source with
  twenty chapters this is the failure that will actually happen.
- **Chapters do not get evidence.** Quotations belong in the key points (OV-216). A quotation in
  a chapter summary would turn the map back into a document.

#### Decided 8 Nov 2026: ten points, and no grouping

The budget allows twelve to fifteen. **The ceiling is ten**, because that is where a list read
aloud still works as an explanation rather than an inventory. The remaining budget goes to
evidence and to longer points, not to more of them.

**Grouping is dropped.** An earlier draft allowed key points grouped into themes where the budget
permitted. It is a new output shape: a grouping the model must produce, schema, migration, and an
audio form to design and test, for a problem nobody has demonstrated at a cap of ten. The existing
linking words cycle through five middles, so a ten-point note thins out but does not collapse.
**If a ten-point note on a two-hour source listens like an inventory, OV-228's blind listen is
where that shows up**, and grouping can come back as a card with evidence behind it.

#### Which sections scale

Nothing in the budget says this today, and it is the missing half of OV-87's dials.

| Scales with the source | Fixed at every length | Why fixed |
|---|---|---|
| the big picture | **the premise** | it is a library row, 25 words, and widening it wrecks the list |
| the core argument, modestly | how to apply | three good actions beat seven; a longer source does not yield more things worth doing this week |
| key points: count **and** words each | what it sells | a fact, not a summary |
| the evidence count | watch or listen it anyway | a judgement and a reason |
| chapter count **and** summary length | | both are free of the note's length |
| the verdict's reasoning, modestly | | |

**The core argument rises modestly and no more**, from 60 words towards about 80 at the deep tier.
It stays singular, because the big picture now carries the surrounding ground and the second
thread, which is what it was being stretched to hold before.

**The verdict's reasoning should scale a little too.** "One or two sentences" is thin justification
for a judgement on two hours of material, and the verdict is the field a reader is most likely to
act on.

### Medium is the wrong axis, form is

**The library already contains podcasts, treated as video.** OV-92's transcript set is chosen for
format spread and includes talking heads, interviews, podcasts, narrated explainers, skits, a
whiteboard lesson, screen shares, a product review and reaction commentary. A YouTube video can be
a monologue or a three-way argument; so can a podcast; an article can be an essay or a reference
doc. Forking per medium produces prompts that drift, and there are already two forks with a third
coming.

So: **one framework, and only the differences that are real capability differences rather than
editorial taste.** There are three.

1. **Who said what.** The one genuine difference, and it is gated on data rather than wording.
   Auto-captions carry no speaker labels, and 19 of OV-92's 20 videos are auto-captions only, so
   attribution is unavailable on the path that produces almost every note today. OV-106's speech
   to text can produce diarisation. Until it does, asking for attribution makes the model guess,
   which is the OV-120 failure.
2. **What the note cannot carry.** Articles have `ReadAnyway.leftOut` naming code samples or a
   table. Video has watch it anyway for when the visual is the claim. **A podcast has nothing
   visual to lose, so listen it anyway needs a different meaning or it will answer No on every
   episode**: the case is a moment where the delivery carries what the words do not. Decide it
   before OV-106 builds it.
3. **Resources.** Articles link out, video descriptions carry the links an episode mentions,
   podcast show notes carry them too. One mechanism, three places (OV-203).

Everything else the framework asks for is already in `coreSection.ts`, which demands names,
numbers, dates and studies, and says to "always keep any caveat, criticism or counter-argument
the video itself raises, and keep who claims something when the video presents it as one person's
claim rather than settled fact."

## What the changes cost

Measured baseline, from `model-comparison.md` and `cost-model.md`, on GPT-6.1 Sol over 20
real videos: **$0.0381 an overview**, median 8,389 prompt and 1,636 output tokens, about
$0.033 per 20 minutes of video, and $0.1118 for the 2 hour 22 minute hearing.

| Change | Cost shape | Rough effect |
|---|---|---|
| Significance over sequence | prompt only | free, possibly negative |
| Depth tiering by length (OV-87, OV-203) | more output on long sources only | +20% to +40% on a long video, under +10% on a short one |
| The big picture | more output, scaled by the budget | +6% to +12% of output on a long source, nothing on a short one |
| Evidence, as segment indices | **indices, not prose** | close to free |
| Completeness check against the source (OV-202) | **a second call carrying the transcript** | close to 2x an overview |

**The structure above is the cheap half.** The big picture and evidence together are about
+10% on output, which is the highest comprehension gain per penny on this list. The completeness
check is the expensive half, and it is separable: the structure can ship without it.

So an overview with the whole framework lands somewhere near **$0.07 to $0.09**, and the
2h22 hearing near $0.22. These are extrapolations from the measured baseline, not
measurements. Treat them as sizing, and replace them with a run.

**What that does to `tiers.md`:** Free's 5 a month goes from $0.19 to about $0.38, which is
nothing. BYO Plus's generation is on the reader's key, though whose key runs a completeness
check is then a real question. **Plus is the one that breaks.** Its 50 a month was sized to
about $2.50 and becomes about $3.80.

**The thing that rescues it is OV-124.** A completeness check is a check on the shared note,
not on anything personal, so it amortises exactly as the shared note does: at five readers
of one video the hybrid is already $0.0114 a reader against today's $0.0381, and a shared
check on top still lands well under today. The catch is the one `cost-model.md` names and
OV-124 repeats: the saving depends on overlap and nothing measures overlap yet. With
hand-picked testers and an unlisted listing (`first-release-scope`), overlap at launch is
near zero, so for the first release the check costs full price with nothing to amortise
against.

## A reading of the sequence

Not a decision, and deliberately not a plan. In dependency order rather than priority order:

1. ~~Answer the fork~~ (`open-questions.md` #6). **Done, 7 Nov 2026: comprehension with the
   triage kept inside it.** Everything below is now unblocked, OV-216 included.
2. **OV-202**, the coverage measure, which OV-87 already depends on and which is the only
   way to tell whether any of the rest worked.
3. ~~Significance over sequence~~. **Done, 8 Nov 2026 (OV-214).** Long sources reach more of
   their chapters, short ones are unchanged, and cost is the same
   (`overview-generation-decisions.md`).
4. **OV-87 and OV-203**, the depth budgets, tuned against OV-202's number.
5. **Log the overlap rate**, which is a precondition buried inside OV-124 and which decides
   whether a completeness check is affordable at all.
6. **The big picture and evidence**, the two new fields in "The structure" above. No longer
   gated: the fork went its way. Evidence matters more under a context layer than in a reader,
   because a claim an assistant carries into a conversation should be traceable to what was
   said, and as segment indices it is close to free.

## What this does not settle

- **Whether a reader wants a longer note.** Every number above is about cost and coverage.
  Nobody has asked whether a reader who opens a two-hour podcast wants six to ten minutes of
  reading or wants to be told to skip it. `open-questions.md` #4 is the related untested
  question and it is still untested.
- **Tone at length.** OV-87 already carries this as an open question from the owner on
  6 Nov 2026: a 40-word cap across seven points on a two-hour podcast reads clipped whatever
  the tone instruction says. Whether long-form notes are terse or wrong in register decides
  whether the budget work is one change or two.
- **Whether the completeness check earns its cost.** It should be run as a measurement over
  OV-92's 20 videos before it is a feature. If it catches what the judge already caught in
  OV-120, facts imported from outside the transcript, it has paid for itself. If it mostly
  agrees with the note it is checking, it has not.
