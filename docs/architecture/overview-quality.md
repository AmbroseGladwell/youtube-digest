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

## What the changes cost

Measured baseline, from `model-comparison.md` and `cost-model.md`, on GPT-6.1 Sol over 20
real videos: **$0.0381 an overview**, median 8,389 prompt and 1,636 output tokens, about
$0.033 per 20 minutes of video, and $0.1118 for the 2 hour 22 minute hearing.

| Change | Cost shape | Rough effect |
|---|---|---|
| Significance over sequence | prompt only | free, possibly negative |
| Depth tiering by length (OV-87, OV-203) | more output on long sources only | +20% to +40% on a long video, under +10% on a short one |
| Evidence and quotations | more output | small, and it rides on the same call |
| Completeness check against the source (OV-202) | **a second call carrying the transcript** | close to 2x an overview |

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
3. **Significance over sequence**, which is a prompt change measurable on OV-92's existing
   harness and good under either answer to the fork.
4. **OV-87 and OV-203**, the depth budgets, tuned against OV-202's number.
5. **Log the overlap rate**, which is a precondition buried inside OV-124 and which decides
   whether a completeness check is affordable at all.
6. **Evidence and quotations** (OV-216), which is the one new section. No longer gated: the
   fork went its way. It matters more under a context layer than it does in a reader, because
   a claim an assistant carries into a conversation should be traceable to what was said.

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
