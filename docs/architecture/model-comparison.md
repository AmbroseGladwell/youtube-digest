# Model comparison: which model writes the best overview for the least

OV-92. Started 12 Oct 2026. `tiers.md` and OV-19 need two numbers this file exists to
produce: what an overview costs us on our key, and which model that is. This file holds
the method, how to run it, and (once the full run has been done) the results and the
recommendation: the best quality, the best value, and the cheapest model that is still
acceptable.

**Status:** decided 15 Oct 2026. **Generation on our key should use GPT-6.1 Sol** (see
Recommendation). The harness, checks, judge and blind check (`packages/model-comparison`)
stay for reruns when models or prices change.

## What is compared, and how fairly

Every run goes through production's own `generateOverview`, with the same composed prompt
and schema and the same single corrective retry, and through the same provider adapters
the app uses (`packages/generation/src/providers`). The harness changes nothing in them.
It wraps two things from outside:

- **the `fetch` the adapter is given** (`meteredFetch.ts`, in `packages/generation` since
  the server meters generation on our key the same way), which times each call to the
  end of its body and reads the token usage the provider itself reports;
- **the client `generateOverview` calls** (`runOne.ts`), which keeps every raw attempt.
  One attempt means it was valid the first time, two mean the retry was needed. The last
  attempt is what the automatic checks read.

The reader is a blank one: no reader context, no capture reason, no topics, tags or past
claims, and every optional section switched on. Personalisation would vary from reader to
reader. Leaving it out keeps the comparison about the model.

That blankness hid OV-246: the schema only reaches the shape Claude refused once a reader has
a topic. `--reader sample` runs every overview as the reader built from `samples/records/`
(five topics, their claims and tags, a reader context), the one `cost-model` already uses.
`--refuse-enforced-schema` answers Claude's enforced-schema request with the grammar refusal,
without sending it, so the run measures what the schema-in-prompt fallback writes
(`overview-generation-decisions.md`, "The schema has to fit Claude's grammar").

### Models

The default set (every model priced in `modelPrices.ts`) is eight models from the three providers whose keys
the experiment has: Anthropic's Opus, Sonnet and Haiku 5.5; OpenAI's GPT-6.1 Sol and
GPT-6 Luna; and Google's Gemini 3.1 Pro Preview, 3.8 Flash and 3.6 Flash. `--models`
takes any `provider:model` the app has an adapter for. A model without a price in the table
is refused, because its spend could not be capped.

`gemini-3.6`, the app's first Gemini model in `KNOWN_MODELS`, is not on Google's pricing
page as of 12 Oct 2026. Its most capable listed model is `gemini-3.1-pro-preview`, so that
is the one compared.

### Prices

`packages/generation/src/modelPrices.ts`, shared with the server's cost log for our key,
per million tokens, checked on 12 Oct 2026 against each provider's
pricing page, which is named beside each entry. Cached input, cache writes and long-prompt
tiers are priced separately: Haiku 5.5 costs more above 100,000 prompt tokens, and Gemini
3.1 Pro above 200,000. **Gemini's Flash prices double on 1 Jan 2027.** The table holds the
2026 prices, and any recommendation that rests on Flash has to say so.

## Reliability and cost: measured, never estimated

Each run records, from code: every call's HTTP status, its latency and its usage
(uncached input, cached input, cache writes, output, with Gemini's thinking tokens counted
as output because that is how they are billed); the wall time of the whole overview,
retry included; and the cost from the price table. A run with a call that reported no
usage is **unpriced**, and is counted apart rather than averaged in as free
(`docs/prototype/constraints.md`, "Never let a model count, measure or time anything").

Each run ends in one of four outcomes:

| Outcome | Meaning |
|---|---|
| `passed-first` | valid against the schema on the first attempt |
| `passed-after-retry` | the corrective retry was needed |
| `failed` | still invalid after the retry, or not JSON at all: the model's doing |
| `errored` | the provider or the network failed, such as a 429, a 5xx or a refused key. Not held against the model, and tried again on the next run |

Cost per overview is reported two ways: the mean over the set, and the cost per 20 minutes
of video, which is total spend over total video length. The second is the one a quota is
set from, since the same set favours no model.

## Quality: the automatic checks

`checkOverview.ts`, run on the last raw attempt rather than the assembled overview,
because assembly quietly drops a key-point range that doesn't fit, and that would hide the
fault. Most of the format's hard limits are already enforced by the schema, so these check
what it does not:

| Check | Area | Fails when |
|---|---|---|
| `keyPointRangesInside` | overview | a key point's range runs backwards or past the last segment. The schema caps neither |
| `standsOutRangeInside` | overview | the same, for what stands out |
| `watchAnywayRangeInside` | overview | the same, for the part worth watching |
| `inOneLineWithinTarget` | overview | the one-liner is over its 25-word target. The schema allows 35 (OV-252) |
| `bigPictureWithinTarget` | overview | the big picture is over the target for the transcript's length (`bigPictureBudget.ts`). A source too short to earn one is never counted, since code drops it (OV-225) |
| `keyPointsWithinTarget` | overview | a key point is over its 40-word target. The schema allows 50 |
| `dubiousClaimsWithinTarget` | overview | a dubious claim is over 25 words, or its reason over 30 |
| `reasoningDoesNotOpenWithNovelty` | overview | the reasoning begins with the novelty word, the prototype's parser bug (`docs/prototype/constraints.md`) |
| `inOneLineOpening` | overview | the one-liner opens "This video" or "A video about", or names the channel |
| `noEmDash` | overview | any prose holds an em dash |
| `numbersInTranscript` | overview | a number in the prose appears nowhere in the transcript, title or description: a cheap hallucination check. Auto-captions sometimes spell numbers out, so a failure here is a lead to read, not a verdict |
| `chaptersSpreadAcrossVideo` | chapters | in a video of 10 minutes or more, one chapter is over half its length |

Chapter starts landing on real segments, ascending from zero and staying inside the
transcript are already guaranteed by the schema and by segment indices, so they are not
checked again.

## Quality: the judge

`judgePair.ts` and `judgeRubric.ts`. The checks above catch rule-breaking. They can't say
which note is better, so a model compares notes pairwise.

**Against one baseline, pair by pair.** Every candidate's note for a video is compared with
Opus 5.5's note for the same video, the model the format was built and judged on. A pair is
judged only when both notes passed, so the 20 videos give up to 20 pairs per candidate.
Pairwise is used rather than absolute scores, because a model asked "which is better" is
more consistent than one asked "how good is this out of 10".

**What the judge sees:** the transcript with a timestamp on every segment, and both notes as
the reader would read them (`overviewMarkdown`, minus the links). It never sees a model
name. Which note is A is decided by a hash of the video and the candidate, so it is
effectively random across pairs and stays the same on a rerun.

**What it answers:** for each of faithfulness, verdict, how-to-apply, chapters and reads
aloud, and then overall, a one-sentence reason followed by A, B or tie. The reason comes
first so it is written before the call. The rubric's wording follows `summary-prompt.md`'s
rules: an invented specific is worse than a missing one, a verdict is right to say common
knowledge, and dubious is only for certainty that hasn't been earned. Length is not
quality.

**Who judges:** never a model from either note's provider, because a model tends to
prefer its own family's writing. The baseline is Anthropic's, so GPT-6.1 Sol judges the
Anthropic and Gemini candidates and Gemini 3.1 Pro judges the OpenAI ones (`JUDGES`, first
eligible wins). This means two judges with possibly different tastes, so a win rate is
compared across candidates with the same judge first, and the blind check is what
calibrates the two against each other.

**Win rate** counts a tie as half a win, so 50% means level with Opus. Judging has its
own budget, counted the same way as a run's, and errored judgments are retried on the next
run like errored runs.

## Quality: the blind check

`npm run blind` serves a local page (`cli/blindCheck.ts`, `blindPageHtml.ts`) showing one
pair at a time, the same pairs the judge sees, as A and B with no model names. The browser
is sent only an opaque token and the two notes. The server keeps which model is which, and
picks a fresh random side every time a pair is shown, independently of the judge's order.
Pairs the judge has already decided are offered first, because a pick is only useful
for calibration when there is a judgment to compare it with. Each pick is saved as it is
made, so the page can be closed at any time and picks up where it left off.

**Pick only what decides something.** `--candidates` and `--limit` narrow the page to a
fixed set: the same pairs every time it is started with the same flags, chosen by a hash
rather than a shuffle, with progress counted within the set. The decision rests on Sol
against Opus, so that is the set worth picking: ten of its nineteen pairs, about fifteen
minutes. Three Gemini 3.8 Flash pairs are an optional second set, a check on the judge's
strongest claim, that Gemini imports facts from outside the transcript.

The report then shows, per candidate, your win rate for it and how often you agreed with
the judge on the same pairs. If you mostly agree on Sol's ten, the recommendation stands.
If you don't, the judge's numbers should not decide it.

## The transcript set

Twenty videos from the reader's own library, chosen on 12 Oct 2026 for spread rather than
at random, and listed with the reason for each in `transcriptSet.ts`. They run from a
1-minute clip to a 2 hour 22 minute parliamentary hearing, and cover nine topics plus the
unfiled, and every format: talking heads, interviews, podcasts, narrated explainers, skits,
a whiteboard lesson, screen shares, a product review and reaction commentary. Three of them
the library judged worth watching anyway. Nineteen have only auto-captions and one has
creator captions, which matches what the app actually sees. About 186,000 prompt tokens
per model for the whole set.

**The recipe set** (`RECIPE_SET`, OV-122): four recipe videos and two that only touch on
recipes (several creators' chopped cheese compared, a business talk about a recipe channel),
fetched with `--set recipes` and compared with `npm run compare -- --set recipes`. Measured on
`openai:gpt-6.1-sol` on 9 Nov 2026, two runs a side against the prompt before recipes: every
note gains about 750–960 prompt tokens (the recipe section, and the whole description); a
recipe video adds about 900–1,500 output tokens, roughly 40–75% more per overview (about
$0.010–0.015 at uncached prices); a video that isn't a recipe costs the same as before. All four
came back as recipes and both others as notes, in both runs.

The transcripts are the creators' content and never enter the repository. They are fetched
with the app's own InnerTube fetcher into `packages/model-comparison/.local/`, which is
gitignored, along with every run's records and reports.

## Running it

It runs locally and never in CI, because it spends money. The unit tests run in CI, and
call nothing.

```sh
# once: the transcripts, free
npm run fetch-transcripts --workspace packages/model-comparison

# a small subset first; --limit takes the shortest videos
task secrets:evals -- npm run compare --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 1 --limit 3

# then the full set under the same run name: settled runs are not paid for twice
task secrets:evals -- npm run compare --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 10

npm run report --workspace packages/model-comparison -- --run 2026-10-12

# the judge: a few pairs first, then the rest under the same run name
task secrets:evals -- npm run judge --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 1 --limit 4
task secrets:evals -- npm run judge --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 6

# the blind check: the ten pairs that decide it, then open http://127.0.0.1:4792/
npm run blind --workspace packages/model-comparison -- --run 2026-10-12 \
  --candidates openai:gpt-6.1-sol --limit 10
```

`--candidates provider:model,...` limits judging to some candidates.

`--against <earlier run>` judges a prompt rather than a model. It sets each model's note in
`--run` against the same model's note from the earlier run, and the judge is chosen as usual,
never from the provider that wrote the notes:

```sh
task secrets:evals -- npm run judge --workspace packages/model-comparison -- \
  --run ov-214-after --against ov-214-before --budget 4
```

`judge-key-points` judges only the key points, between two runs that already exist. It
generates nothing, and reads videos from the main set and the coverage set:

```sh
task secrets:evals -- npm run judge-key-points --workspace packages/model-comparison -- \
  --run ov-214-after --against ov-214-before --budget 3
```

- **What the judge sees:** the transcript, plus each note's premise, core claim and key points
  with their places. The premise and claim are there only so it can tell a point that repeats
  them. It never sees chapters, the verdict or the sponsor section.
- **Both orders:** every pair is judged twice, once each way round. A side wins a dimension only
  when both orders agree; a split is a tie.
- **Dimensions:** choice, completeness, faithfulness and overall (`keyPointsRubric.ts`).
- **The trust standard is in the rubric, from rubric 2 on.** A point that says what a claim rests on (one person's story, a single case, no figures given) counts as faithful reporting, as long as it is true of the transcript. It isn't marked down as editorialising or wasted space. Outside facts are still unsupported.
- **Where it goes:** the report lands in `.local/key-point-judgments/<run>--against--<run>--rubric-<n>/report.md`. `KEY_POINTS_RUBRIC_VERSION` goes up whenever the wording changes, so judgments under different rubrics are never mixed or counted as already done.
- **Cost:** about $0.08 a pair.

`judge-big-picture` runs OV-225's deletion test on every big picture in a run that already
exists, and generates nothing:

```sh
task secrets:evals -- npm run judge-big-picture --workspace packages/model-comparison -- \
  --run ov-225-a --budget 1
```

- **What the judge sees:** In one line, the big picture and the core claim, and nothing else, not
  even the transcript. The test is whether removing the big picture loses anything the other two
  don't say, which needs only the three.
- **Labels:** the deletion test (loses something or nothing), and whether it names the question,
  names another thread, or describes the source rather than the subject, which is a fault.
- **The judge is from another provider than the writer**, as for the actions.
- **Where it goes:** `.local/big-picture-judgments/<run>/report.md`, per model, with every video's
  target, words, verdict and reason.

Keys are read as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY`, injected by
`task secrets:evals` from the `overview-evals` Bitwarden project (`docs/conventions/secrets.md`),
and listed in `scripts/evals.env`. They are the harness's own keys, never dev's or prod's, so
eval spend shows up in each provider's bill under its own project or workspace.
A model whose provider has no key is skipped with a line saying so.

**The budget** is measured spend under the run's name, including earlier invocations of
it. Once it is reached, no new overview is started. Models run in parallel and a video
already started is allowed to finish, so a run can go over by at most one overview per
model. On this set that is under $1 in the worst case, the 2 hour hearing on Opus.

The report is two files in the run's folder: `report.md`, with the table per model of
reliability, latency, cost and check pass rates, and, once there are judgments or picks,
the judge's win rates and the blind check's agreement; and `sideBySide.html`, which shows each
video's notes and chapters from every model in one row, with any failed checks marked.

## Different readers

OV-230. The same harness asks a different question of How to apply: does it change with the
reader? `npm run readers` runs production's own single pass, on one model, over the
transcript set five times, differing only in `readerContext`:

- **parent**, **founder** and **retiree**, written as About you entries and composed by
  `composeReaderContext`, as the app sends them, and chosen to share as little as possible
  (`spreadReaders.ts`). `--readers specific` runs two far more detailed readers instead,
  with learned items, and `--readers all` both; readers already settled under the run's
  name aren't paid for again
- **nobody**, twice, with no context: the **noise floor**. A model rewords the same advice
  from one run to the next, so two readers' actions differing proves nothing until they
  differ by more than two runs for nobody do

Everything is measured by code over the saved records (`readerSpread.ts`), never asked of a
model. A video counts only when all five passed, so a failure can't pass for a difference.
Per pair of readers the report gives how many videos had identical actions, ignoring case
and punctuation, and the mean word overlap: shared words over all words in either list,
1 for the same words, 0 for none in common. Videos where both readers got nothing are
counted apart and left out of the overlap: saying nothing to two readers agrees, but isn't
evidence the context was ignored, and on the first run it alone lifted every pair of
readers to the noise floor. It says how many
videos had the same actions for everyone, counts each reader's 0 to 3 actions, and gives a
verdict: personalised where every pair of readers overlaps less than the noise floor. Its
"Context used" counts the actions naming one of a reader's cue words, from the sentence and
from the learned items apart, against how often nobody's actions hit the same words.

What it can't see is an action that **misreads** its reader, which says we know you and
gets it wrong. So the report ends with every video's actions for each reader, side by side,
for reading by eye.

```sh
task secrets:evals -- npm run readers --workspace packages/model-comparison -- \
  --run readers-2026-11-08 --budget 1 --limit 3
task secrets:evals -- npm run readers --workspace packages/model-comparison -- \
  --run readers-2026-11-08 --budget 3
```

The default model is GPT-6.1 Sol, production's on our key. `report.md` lands in the run's
folder. A rerun under the same name pays only for what hasn't settled.

### Results: first readers run, 8 Nov 2026

GPT-6.1 Sol, all 20 videos, 100 overviews, all passed (4 retried after a dropped
connection), $3.39.

**The actions change with the reader.** Every pair of readers overlaps less than two runs
for nobody: 0.20 to 0.26 against a noise floor of 0.39. One video of 20 gave everyone the
same actions, and two or three gave a pair nothing to do.

| Reader | 0 actions | 1 | 2 | 3 |
|---|---|---|---|---|
| nobody (each run) | 2 | 0 | 4 | 14 |
| parent | 3 | 1 | 9 | 7 |
| founder | 2 | 3 | 4 | 11 |
| retiree | 3 | 3 | 7 | 7 |

**A reader gets fewer actions.** Nobody got three on 14 videos; the parent and the retiree
on 7. The model trims what doesn't fit rather than padding.

**The parent is served least.** Counting actions that name something from the reader's own
context (the report's "Context used", a keyword count by code): founder 21 of 44 on 11
videos, retiree 17 of 38 on 9, parent 8 of 40 on 5. Nobody hits those words 0 to 4 times in
50, so the counts aren't the videos' own vocabulary. The prompt's one example is a parent's ("school nights"), yet the
parent's night shifts and young children reach the fewest actions. The founder's count is
flattered by a set heavy with business videos.

**No misreading found.** A keyword scan for actions contradicting their reader (children
for the founder, a job for the retiree) found one, a harmless conditional ("If you market a
business") for the parent. Read by eye, the best use the context precisely: "On your next 5
sales calls…" for the founder on an app-ideas video, "without sacrificing sleep" for the
parent on a marriage video, "If you draw from investments, ask your pension provider to
model an early market fall" for the retiree. The weakest stretch it: the retiree's
app-ideas actions become a library-volunteer task.

### Results: specific readers, 8 Nov 2026

The same 20 videos for two readers who filled in every part of About you and have four
learned items each (`--readers specific`): an A&E nurse and dad of twin three-year-olds on
night shifts, and a solo founder of an invoicing app for UK plumbers. 40 overviews, all
passed, $1.51.

| Reader | Word overlap with nobody | Actions using their context | From the sentence | From learned |
|---|---|---|---|---|
| parent | 0.26 | 8 of 40 (20%) | 8 | 0 |
| specific-parent | 0.22–0.24 | 19 of 44 (43%) | 10 | 13 |
| founder | 0.21 | 21 of 44 (48%) | 21 | 0 |
| specific-founder | 0.26–0.27 | 18 of 46 (39%) | 17 | 2 |

**More detail doesn't move the actions further from nobody's.** Overlap stays in the band the
broad readers sit in. The video bounds what there is to do; the context changes how it's
put, not what it is.

**Learned items are what reached the parent.** 13 of the specific parent's 44 actions draw on
them (the budget spreadsheet, strength training, Sunday cooking), and they lift a parent from
the least served reader to level with the others. The founder's are used twice, both where
the video is about the thing (an ISA on compound interest, LinkedIn on what to post), which
is the restraint wanted, not a miss.

**The keyword count undersells the specific founder.** By eye its actions are the most fitted
in the run: "Ask 5 paying plumbers to walk through their latest invoice…", "Rewrite your
invoicing app's upgrade screen around 1 concrete plumber outcome…", "Before changing your £20
monthly price…". The broad founder's say "prospects" and "customers", which the count rewards
just the same. A keyword proxy can't tell naming the reader's world from fitting it; that
needs a judged measure.

**Little shoehorning.** The weakest uses of a learned item: "For your next household budget
decision, ask an artificial intelligence assistant for 3 competing options…" on a video about
AI at Shopify.

### Judged: practical and helpful

`--judge` asks whether the actions are any use (`judgeActions.ts`). A judge from another
provider than the writer's (`--judge-model`, else the first of `JUDGES` that qualifies)
reads each video's transcript with every reader's actions at once. The readers are named
"Reader 1" and so on, in an order shuffled per video. It labels each action: concrete or
a principle; from the video, a sensible extension of it, or contradicting it; for a known
reader, whether it fits, is generic or misreads them; doable within a couple of weeks; and
helpful, marginal or unhelpful. For a reader given nothing, it says whether nothing was right.
Code counts the labels (`summariseActionJudgments.ts`). **Practical and helpful** is
concrete, not contradicting the video, not misreading the reader, doable, and helpful. An
answer that skips, repeats or invents an action is a failure, not a partial count.

Every reader chose to save the video, so the judge takes their interest in its subject as
given. Without that line, the first trial marked down any action whose video didn't match
the reader ("this nurse has no interest in apps"), which a real reader never meets.

```sh
task secrets:evals -- npm run readers --workspace packages/model-comparison -- \
  --run readers-2026-11-08 --readers all --judge --judge-model anthropic:claude-opus-5-5 --budget 8
```

#### Results, 8 Nov 2026

Opus 5.5 judging the GPT-6.1 Sol actions of all seven readers over 20 videos, 312 actions.
It cost $1.96. One answer labelled 3 of 13 actions and was rerun.

| Reader | Actions | Practical and helpful | Marginal | Fits | Generic | Misreads |
|---|---|---|---|---|---|---|
| nobody | 50 | 48 (96%) | 2 | – | – | – |
| nobody-again | 50 | 46 (92%) | 4 | – | – | – |
| parent | 40 | 28 (70%) | 12 | 11 (28%) | 28 | 1 |
| founder | 44 | 40 (91%) | 4 | 23 (52%) | 21 | 0 |
| retiree | 38 | 26 (68%) | 12 | 19 (50%) | 18 | 1 |
| specific-parent | 44 | 31 (70%) | 13 | 22 (50%) | 22 | 0 |
| specific-founder | 46 | 42 (91%) | 4 | 26 (57%) | 20 | 0 |

**The advice is practical.** 95% to 100% of every reader's actions are concrete and
doable. None contradicts its video. None was judged unhelpful. Every empty list was judged
right. The only shortfall is "marginal": harmless, but little difference.

**Readers who aren't founders get more marginal actions, 30% against 4–9%.** The judge's
reasons fall into three kinds:

- **Forced into the reader's life.** For example, filming "a real workplace problem" for an
  A&E nurse, asking a nursery whether it uses AI tutoring, or a library volunteer's
  "project decision". The writer reaches for the context where the video gives it nowhere
  to go.
- **Generic, where the judge knows better.** For example, a headphone case check for a
  reader with "no known travel needs". The same action for nobody is helpful. So part of
  the gap is the judge holding a known reader to a higher bar, not worse advice.
- **Repeats.** A second action that restates the first.

**Founders match nobody because the videos suit them.** The set is heavy with business
and tech. Among the readers, fit is the clearer signal. Detail and learned items take the
parent from 28% fitted to 50%, at the same 70% practical and helpful. The specific founder
fits best of all, at 57%, which is what the keyword count missed.

**What it says for How to apply:** personalising makes the actions fit better without
making them less practical. Where it costs anything, it's a step that drags the reader's
life into a video that has nothing to say about it. The prompt could say so: when the
video doesn't bear on what we know of the reader, give the plain action and leave their
life out of it.

#### Tried: a rule against forcing the reader in, 8 Nov 2026

This run tried exactly that rule, added after the fit line, and reverted it:

> Use what you know of me only where the video bears on it. Where it doesn't, give the
> plain step and leave my life out of it: don't invent a workplace, a project or an
> occasion to hang the step on.

The no-reader runs never see the fit line, so they were copied from the run above and
only the five readers were written again (run `readers-fit-rule`, $3.80 to write, $1.96 to
judge). Then every action was judged afresh.

**The judge isn't steady from run to run.** The 100 no-reader actions were word for word
the same in both runs, yet 17 of them got a different helpfulness label. Their practical and
helpful share fell from 94% to 81%. It judges each video's readers side by side, so its bar
moves with what it's comparing. **Compare a reader against no reader within a run, never
one run's percentage against another's.**

| Reader | Gap to no reader, before | After | Fits, before | After |
|---|---|---|---|---|
| parent | −24 | −21 | 28% | 11% |
| founder | −3 | −12 | 52% | 39% |
| retiree | −26 | −30 | 50% | 13% |
| specific-parent | −24 | −19 | 50% | 23% |
| specific-founder | −3 | −9 | 57% | 47% |

The gap is each reader's practical and helpful share minus no reader's, in points.

**It over-corrected.** The readers got more actions, closer to no reader's count. Those
actions were more generic: fit halved or worse for the parent, the retiree and the specific
parent. They were no more helpful against no reader: the gap moved a few points either
way, which is within the judge's own wobble. The model didn't learn to tell a forced step
from a fitted one. It just used the reader less. **Personalised steps that occasionally
over-reach serve a reader better than plain ones, so the prompt is unchanged.** A fix
for forcing has to keep the fitted steps, for example an example of each in the prompt,
and be judged on the same terms (OV-236).

### OV-236: fit what they do, don't invent, 8 Nov 2026

**Judging two prompts side by side.** `--against <run>` adds an earlier run's readers to
this run's, named `parent@before` and so on. Both versions are labelled in the same judge
calls, so they're held to the same standard; the report's "Before and after, judged
together" sets them side by side. Only readers with a context are added, because the
no-reader prompt has no fit line and can't differ.

**More readers and videos.** `parent-two` is a second parent, a mum of a four-year-old
who does part-time bookkeeping. It has one role where the first parent has two, to tell
"parents" apart from "that sentence". `--videos parenting` adds seven parenting videos the
owner saved (`PARENTING_SET`), fetched with `npm run fetch-transcripts -- --set parenting`
into their own folder. The model comparison's 20 videos are unchanged. A parent saves
parenting videos, and the 20 were business-heavy.

**The prompt.** After the fit line, How to apply now says:

> Fit each step to what they already do and the limits they live with: their time, the
> people around them, the work and plans they already have. Never give them a new project,
> role or occasion just to hang a step on. "On your next 5 sales calls, ask how they handle
> this today" fits a founder; "Film a problem on your ward" forces a nurse.

It's built from the judge's own reasons. Fitted steps applied the video to something the
reader already does (sales calls, a colleague after a hard shift, troponin tests).
Marginal ones invented something new for them to do (filming in A&E, a library "project
decision", a side project).

Run `readers-fit-v2`, judged against `readers-2026-11-08` on 24 of 27 videos (17 main, 7
parenting):

| Reader | Practical and helpful, before | After | Fits, before | After | Marginal, before | After |
|---|---|---|---|---|---|---|
| parent | 71% | 87% | 48% | 72% | 16 of 56 | 5 of 39 |
| parent-two | 74% | 88% | 53% | 76% | 15 of 57 | 5 of 42 |
| specific-parent | 78% | 89% | 68% | 89% | 13 of 59 | 5 of 46 |
| founder | 82% | 88% | 56% | 75% | 8 of 45 | 5 of 40 |
| specific-founder | 67% | 87% | 38% | 85% | 20 of 61 | 5 of 39 |
| retiree | 53% | 71% | 47% | 68% | 23 of 49 | 9 of 31 |

- **Every reader is better on both counts.** Misreads fell from 11 to 3.
- **The parenting videos found forcing the other way round.** Before, the specific founder
  got parenting advice as if they had children ("If planning a third child…"), all
  marginal. After, they get nothing on a video about a third child, and fitted steps
  elsewhere.
- **Parents aren't served worse.** `parent-two` scores level with `parent`. The parent's
  low numbers in the first run were the business-heavy videos, not parents.
- **The cost is fewer actions.** Readers get about 30% fewer. Counted rather than as a
  share, every reader has a few fewer practical and helpful steps: about 238 before, 203
  after.
- **More readers get nothing where the judge saw a plain step:** 17 times, against 5,
  out of about 144 reader-videos. Examples are the headline-reading check on the EU news
  video and checking before you build on the app-ideas video. Some of that is the
  side-by-side judging: "an identical reader got one".

**Tried and reverted: "give the plain step anyway".** Run `readers-fit-v3` added "Where
none of that connects to the video, give the plain step anyway: an empty list is only for
a video with nothing to do". It was judged against `readers-fit-v2` on 25 videos.

| Reader | Practical and helpful, v2 | v3 | Fits, v2 | v3 | Misreads, v2 | v3 |
|---|---|---|---|---|---|---|
| parent | 84% | 75% | 68% | 52% | 1 | 1 |
| parent-two | 85% | 80% | 73% | 61% | 0 | 5 |
| specific-parent | 88% | 88% | 91% | 67% | 0 | 0 |
| founder | 80% | 76% | 78% | 73% | 1 | 0 |
| specific-founder | 91% | 74% | 85% | 67% | 1 | 1 |
| retiree | 65% | 56% | 61% | 53% | 1 | 3 |

It never left a list empty, even where empty was right. Readers got about 50% more
actions, but more of them were marginal and misreads rose from 4 to 10. The worst gave a
mum erection advice, and the third-child advice came back for the founder. Steps padded
out like that are what loses a reader's trust, so **v2 is the prompt**. Fewer, sharper
steps beat more, padded ones.

**The judge drops more as calls grow.** With 12 or more readers in one call, 3 or 4 of 27
answers skipped an action or an empty verdict, on the same videos on a retry. They are
left out as failures rather than counted part-way.

**Articles share the rule, unmeasured (OV-238).** `readerFit` in `howToApplySection.ts`
puts the reader's context and the rule into both the video and the article prompts, so
they can't drift apart. The owner chose to apply it without an article run: the readers
harness only runs YouTube transcripts, and an article runner, an article set and a
judged run would cost more than the risk is worth. The rule is about the reader, not the
source, and the article prompt keeps its own "Most news has nothing to apply" line. What
to watch for, if articles are ever measured: readers getting an empty list where a plain
step was right, which on news is already common.

## Coverage

OV-202. The checks catch broken rules and the judge picks the better of two notes, but
neither says whether a note **covers its source**. A note can pass every check and still
skip the middle hour of an interview. OV-87's budget and OV-214's selection rule both need
a number to move, so `npm run coverage` measures it.

**It is positional, counted by code, and never asks a model** (`measureCoverage.ts`). Each
key point already names where it comes from: a segment range for a video, one paragraph
for an article. So does the start of each chapter. Every position is weighted by the
words it holds, so a video and an article are measured the same way. Recipes would be
measured the same way too, but none are in the set yet. Per note:

| Figure | What it counts |
|---|---|
| In a point's range | the share of the source's words inside some key point's range |
| In a reached chapter | the share of words in chapters that at least one key point lands in |
| Largest gap | the longest stretch, by words, that no key point lands in, and where it is |
| By third | key points whose middle falls in the first, middle and last third of the words |
| Unplaced | key points with no position, which the prompt asks for when a point is built across the source. Counted beside the measure, never scored as uncovered. A note with no placed point is **unmeasurable**, not 0% |

**Compare like with like.** An article's key point names one paragraph, not a range, so
its "in a point's range" reads low by design. Across kinds, the chapter share and the
largest gap are the figures to compare.

It reads the last raw attempt, as the checks do. The judged half of the card, whether the
note says the *important* things, is not built. Positions are enough to show a budget
change moving coverage, and a judge can be added later if they turn out not to be.

### The coverage set

Twelve sources rather than the twenty, to keep each rerun cheap (`coverageSet.ts`). There
are seven videos from 1 minute to 2 hours 22 minutes, including **the Diary of a CEO
episode OV-87 and OV-202 name** (James Talarico, 18,563 words), and five articles from 290
to 6,210 words. They cover fitness, politics, finance, technology, interviews, a hearing,
news, opinion, a practical guide, a data explainer and a long essay. The sources are fetched
into `.local/coverage/`, outside the main set's folder, so the model comparison's set never
changes.

```sh
task secrets:evals -- npm run coverage --workspace packages/model-comparison -- \
  --run coverage-2026-11-08 --budget 1.5
# the same report again, free, from what the run already holds
npm run coverage --workspace packages/model-comparison -- --run coverage-2026-11-08 --measure-only
```

`coverage.md` lands in the run's folder. A rerun under the same name pays only for what
hasn't settled, so a prompt or budget change gets a new run name and is compared beside the
old one.

### Results: baseline, 8 Nov 2026

GPT-6.1 Sol, a blank reader, the prompt as of OV-236. All 12 notes passed, 4 articles after
the retry. It cost **$0.61**.

| Source | Length | Key points | In a point's range | In a reached chapter | Largest gap | By third |
|---|---|---|---|---|---|---|
| fitness clip | 1:05 | 3 | 90% | 100% (3 of 3) | 7%, 1:00–1:06 | 1 / 1 / 1 |
| EU news explainer | 9:15 | 5 | 53% | 59% (5 of 7) | 24%, 0:00–2:18 | 1 / 3 / 1 |
| compound interest | 16:58 | 5 | 79% | 82% (5 of 6) | 18%, 0:00–2:52 | 1 / 3 / 1 |
| app animations, screen share | 22:50 | 7 | 70% | 93% (6 of 7) | 11%, 0:00–2:39 | 2 / 2 / 3 |
| Shopify CEO interview | 1:04:49 | 7 (1 unplaced) | 37% | 68% (7 of 13) | 29%, 40:00–59:07 | 3 / 2 / 1 |
| **Diary of a CEO, Talarico** | 1:36:47 | 7 (2 unplaced) | 37% | 59% (5 of 10) | 22%, 0:00–20:37 | 1 / 3 / 1 |
| Education Committee hearing | 2:22:15 | 7 (2 unplaced) | 25% | 26% (5 of 20) | 41%, 1:10:10–2:06:08 | 2 / 2 / 1 |
| Reddit news report | 290 words | 3 (1 unplaced) | 17% | 100% (1 of 1) | 43%, paragraphs 1–5 | 0 / 1 / 1 |
| LLM Voice essay | 1,102 words | 4 (1 unplaced) | 20% | 83% (3 of 4) | 35%, paragraphs 6–10 | 2 / 0 / 1 |
| ADHD design guide | 1,401 words | 5 (3 unplaced) | 6% | 30% (1 of 5) | 69%, paragraphs 1–42 | 0 / 0 / 2 |
| living conditions explainer | 4,500 words | 6 (3 unplaced) | 7% | 50% (3 of 7) | 49%, paragraphs 20–59 | 2 / 0 / 1 |
| startup ideas essay | 6,210 words | 7 (3 unplaced) | 6% | 37% (4 of 10) | 47%, paragraphs 57–116 | 2 / 1 / 1 |

**Coverage falls with length, as OV-87 says.** Videos under 25 minutes reach 59% to 100% of
their chapters. The three over an hour reach 26% to 68%. The hearing is the clearest case:
seven key points for 20 chapters, and nothing at all from the 56 minutes between 1:10 and
2:06. Seven points is the ceiling, and the long sources all hit it.

**The Diary of a CEO episode: 37% of its words sit inside a key point's range, and 5 of
its 10 chapters are reached.** It doesn't lose the middle. It loses the ends: the
opening 20 minutes on family and vocation, and the last 22 minutes on faith and the Texas
campaign, are only touched by the two unplaced points. That is the number OV-87's budget
change has to move.

**Articles leave far more key points unplaced: 11 of 25, against 5 of 41 for videos.** The
measure still works on what is placed, but for an article it sees only half the note. And
an unplaced point also has no "go to it" link for the reader. OV-240 changed that (below).

### Results: a run names where it begins, OV-240, 8 Nov 2026

All 11 nulls were honest under the old rule: each point drew on two or more paragraphs. The
article prompt now asks for the paragraph where such a run begins (`docs/features/article-notes.md`,
"Positions are paragraphs"). Run `coverage-ov-240` regenerated only the five articles. The seven
video notes were copied from the baseline, since no video prompt changed. It cost **$0.19**.

| Article | Unplaced, before → after | In a reached chapter | Largest gap |
|---|---|---|---|
| Reddit news report | 1 of 3 → 0 of 3 | 100% → 100% | 43% → 24% |
| LLM Voice essay | 1 of 4 → 0 of 5 | 83% → 100% | 35% → 24% |
| ADHD design guide | 3 of 5 → 0 of 5 | 30% → 62% | 69% → 31% |
| living conditions explainer | 3 of 6 → 0 of 6 | 50% → 78% | 49% → 25% |
| startup ideas essay | 3 of 7 → 0 of 7 | 37% → 85% | 47% → 27% |
| **mean** | **11 of 25 → 0 of 26** | **60% → 85%** | **48% → 26%** |

These are fresh notes, not the same notes with numbers added, so some points differ from
the baseline's. A change from 11 nulls to none is well beyond that noise. The chapter and gap
figures move mostly because points the measure couldn't see before now count. The notes didn't
start covering more of their articles. What they do show is that the article measure now
sees the whole note.

### Results: significance over sequence, OV-214, 8 Nov 2026

The key-points rule now says how to choose (`overview-generation-decisions.md`, "key points
are chosen by significance"). It was measured two ways, both on GPT-6.1 Sol: coverage on the
coverage set, and the judge on the 20 videos. In all it cost **$3.69**.

**One run per prompt isn't enough.** A control run of the unchanged prompt
(`coverage-ov-214-control`) moved Talarico from 37% to 50% of words inside a point's range, with
nothing changed. So each side has two samples:

- **Old prompt:** the baseline (videos from `coverage-2026-11-08`, articles from
  `coverage-ov-240`) and the control.
- **New prompt:** `coverage-ov-214` and `coverage-ov-214-b`.

| Source | Length | In a reached chapter, old | New | Largest gap, old | New |
|---|---|---|---|---|---|
| fitness clip | 1:05 | 100%, 100% | 100%, 70% | 7%, 19% | 15%, 30% |
| EU news explainer | 9:15 | 59%, 59% | 59%, 59% | 24%, 24% | 24%, 24% |
| compound interest | 16:58 | 82%, 82% | 100%, 82% | 18%, 18% | 6%, 18% |
| app animations | 22:50 | 93%, 96% | 79%, 60% | 11%, 9% | 14%, 22% |
| **Shopify CEO interview** | 1:04:49 | 68%, 63% | 71%, 51% | 29%, 21% | 13%, 21% |
| **Diary of a CEO, Talarico** | 1:36:47 | 59%, 70% | 72%, 72% | 22%, 22% | 22%, 22% |
| **Education Committee hearing** | 2:22:15 | 26%, 45% | 58%, 66% | 41%, 41% | 28%, 29% |
| articles, mean of 5 | | 85% | 88% | 28% | 26% |

**The three long sources are where it moves, and the change held on both new samples.**

- Across those three, the mean share of words in a reached chapter rose from 55% to 65%.
- The mean largest gap fell from 29% to 22%.
- The hearing moved most. Its 56-minute gap from 1:10 to 2:06 shrank to 40 minutes in one
  sample (1:26:30–2:06:08) and 37 in the other (1:10:10–1:46:51).
- Short videos and articles are level within the noise above.

The app-animations note is lower in both new samples. In sample b it dropped the opening
point, that animation gives agent-built apps their craft. That is the video's thesis, already
in the core claim, so the rule against points a reader could get from the premise is doing what
it says.

**Talarico, read by hand.** Before and after cover the same six subjects. The closing point on
faith and burnout is now placed (1:17:03–1:27:30) rather than left unplaced, and the first point
gains its concrete example, a $12 million donation. **The opening 20 minutes are still not
represented.** That is a matter of how many points the note gets, OV-87's dial, not of which.

**The judge called it level, and couldn't have seen the change.** Run `ov-214-after --against
ov-214-before` on the 20 videos, judged by Gemini 3.1 Pro:

- **The result:** the new prompt won 11 and lost 9.
- **Its reasons:** nearly all are about chapters, the verdict or the sponsor section. Every field
  is written again from scratch, so the note as a whole varies from run to run, and that decides
  the call.
- **Position bias:** it picked whichever note came first in 14 of 20 pairs.
- **Faithfulness:** the new prompt won 2, tied 12 and lost 6.
  - **Three of the six losses are in fields this change doesn't touch:** the verdict twice and
    the sponsor once.
  - **One is the anecdote rule doing what it was added for.** The fitness clip is marked down
    for "a critique of the evidence" in its last point, which notes that four years of one
    man's training is the only evidence.
  - **Two are about key points.** The small-talk note lost a minor caveat, that asking about
    someone's hours isn't wrong, when it swapped the point that carried it for another. And the
    app-animations note's "pointer-driven tilt" was called invented. It comes from the video's
    description, which the model sees and the judge doesn't.

**A whole-note judge can't isolate a change to one field**, so a judge that sees only the key
points was built (`judge-key-points`, above) and run on notes that already existed. Nothing
new was generated for it. These figures are rubric 1, before the trust standard was added. Judging cost $7.00, and the 12 notes from the stopped run had cost
$0.35 to write.

| Pair | Prompts | Pairs | Wins | Ties | Losses | Win rate |
|---|---|---|---|---|---|---|
| `ov-214-after` against `ov-214-before` | new against old | 20 | 5 | 4 | 11 | 35% |
| `coverage-ov-214` against `coverage-2026-11-08` | new against old | 6 | 1 | 3 | 2 | 42% |
| `coverage-ov-214-b` against `coverage-ov-214-control` | new against old | 7 | 1 | 2 | 4 | 29% |
| `ov-214-before-b` against `ov-214-before` | **old against old** | 12 | 0 | 5 | 7 | **21%** |
| `coverage-ov-214-control` against `coverage-2026-11-08` | **old against old** | 7 | 3 | 2 | 2 | 57% |
| `coverage-ov-214-b` against `coverage-ov-214` | **new against new** | 7 | 2 | 1 | 4 | 36% |

The overall call is shown, with a tie counting as half a win. `ov-214-before-b` is 12 notes from
an old-prompt run that was stopped part way, kept because they already existed. One coverage
pair errored on the network and wasn't retried.

**This judge can't tell the prompts apart from writing the same note twice.** The same prompt
run twice scored from 21% to 57%. Every new-against-old figure falls inside that range. Two
writes of one note differ by more than the prompt change does. So this measure shows neither
that the new key points are better nor that they are worse.

**Where it does lean, it marks down the note's own judgment of the evidence.** In old against
old as well as new against old, its reasons call a caveat about evidence "editorial critique",
"external fact-checking" or a waste of space. On the hearing it held "presents no quantitative
results" against the new note. On Shopify it wanted back the affirmations point, which the new
rule dropped because it rests on one anecdote. That pulls against the trust standard decided on
8 Nov 2026 (`overview-quality.md`, "Trust"): keep what a claim rests on, and don't present an
anecdote as proof. So part of the new prompt's lean is the anecdote rule doing what it was
asked to do, judged by a rubric that doesn't share that value.

**Rubric 2, with the trust standard, on the five long videos, 9 Nov 2026.** These five already had
three notes from each prompt (two each for Talarico), so nothing was written. The videos are the
hearing, Shopify, app animations, compound interest and Talarico, chosen with `--videos`. It cost $4.52.

| Pairs | Prompts | Wins | Ties | Losses |
|---|---|---|---|---|
| 14 | new against old, three pairings | 4 | 5 | 5 |
| 5 | old against old | 2 | 2 | 1 |
| 5 | **new against new** | 0 | 0 | **5** |

- **Level.** New against old is 46%, and the three pairings alone scored 13%, 80% and 40%.
- **Writes still swamp the prompt.** Two writes of the new prompt came out 5–0, a wider gap than
  anything between the prompts.
- **The hearing, where coverage moved most, leans new:** 2 wins, 1 loss. At three pairs that is a
  hint, not a finding.
- **The trust standard took hold.** The reasons now credit notes for applying the editorial
  standard to a speaker's unsupported claims, where rubric 1 marked the same caveats down.

**What a sharper test would need:** several notes per video for each prompt, so the comparison
is between prompts and not between two single writes. Or the reader's own blind picks, which
OV-228 runs on the whole note.

**Cost didn't move:** 1,690 output tokens a note before, 1,716 after. Key points total about
205 words either way.

**The automatic checks hold, with one point a word over.** All 20 notes were valid first time
on both prompts. `keyPointsWithinTarget` went from 20 of 20 to 19 of 20: one note has two points
of 41 words against the target of 40. The schema's limit is 50, and the length instruction
didn't change.

### Results: one note budget, OV-87, 10 Nov 2026

Long sources get up to ten key points of 60 words and twenty chapters, and a long video's points
must reach its last third and every chapter holding over a quarter of it
(`overview-generation-decisions.md`, "One note budget"). Measured on the coverage set, GPT-6.1
Sol, two samples a side: `coverage-main-a`/`-b` on `main` and `coverage-ov-87-a`/`-b` on the
branch.

**The three long videos**, where the budget changed:

| Source | Length | Key points, old → new | In a point's range, old | New | Largest gap, old | New |
|---|---|---|---|---|---|---|
| Shopify CEO interview | 1:04:49 | 7 → 8 | 47%, 30% | 86%, 82% | 29%, 26% | 12%, 12% |
| Diary of a CEO, Talarico | 1:36:47 | 7 → 10 | 54%, 44% | 59%, 70% | 19%, 22% | 20%, 17% |
| Education Committee hearing | 2:22:15 | 7 → 10 | 16%, 25% | 51%, 35% | 33%, 20% | 11%, 28% |
| **mean** | | | **36%** | **64%** | **25%** | **17%** |

"In a point's range" is the share of words that is used, because it doesn't depend on the chapter count, which itself rose
(from 9 to 15 chapters, to 14 to 20). "In a reached chapter" is in each run's `coverage.md` but
compares lists of different lengths.

- **Coverage rose clearly on two of the three.** OV-214's control moved Talarico 13 points with
  nothing changed. Against that, the Shopify interview moved about 45 points on average and the
  hearing about 22. Talarico's 15 is within the noise on this number, and its largest gap barely
  moved; the hand read below is what shows its change.
- **The Talarico note now reaches the end.** Read by hand: `main`'s points stopped at 1:27 and left
  out the closing ten minutes (incentives, his term limit, the campaign). The branch's last point
  covers 1:32 to 1:36. It also separates what `main` crammed together (wealth tax and healthcare,
  Trump and immigration) and keeps more of his hedges. One loss: `main`'s point on campaign money
  and gerrymandering (0:24 to 0:27) is not in this sample. Both skip the first 15 minutes.
- **Points use some of the room, not all of it.** Long-source points ran 44 to 51 words against a
  target of 60, as the big picture stops under its targets. Key points on Talarico went from 235
  words to about 465, roughly a minute and a half more listening.
- **No long video needed the retry.** The two new coverage checks passed first time on all six
  long-video notes.
- **Output rose on long sources only:** about 2,100 to 2,800 output tokens before, 2,700 to 3,400
  after. About 1,000 tokens more, roughly a cent a note on Sol. Run costs here vary with the prompt
  cache (a run's first notes write it), so compare tokens, not dollars.

**The essay over 6,000 words** (startup ideas, 6,210) went from 7 points to 8 and 10 chapters to
12, with coverage within noise (9%, 10% → 13%, 11% in a point's range; an article's point names
one paragraph, so this reads low by design).

**Short sources were unchanged.** The other four videos and four articles wrote the same number of
points within the run-to-run spread, at the same output, and the same two articles needed the
retry on both sides (the ADHD guide and the living-conditions explainer).

**The automatic checks hold on the 20-video set** (`ov-87-checks` against `main-checks`, the
sample reader). OpenAI calls began hanging for up to an hour around 03:00 UTC, on both sides, so
three branch notes and five `main` notes never came back. On the 15 both wrote, every check gave
the same result note for note, except one In one line opening on the branch, a field this change
doesn't touch. The branch's Shopify note, a long source, passed every check, including
`keyPointsWithinTarget` against its 50-word target.

## Results: first full run, 12 Oct 2026

Run `2026-10-12`: 8 models on all 20 videos, every run settled, **$7.91** in all. The
OV-118 fix to the OpenAI adapter was applied for this run, since without it Luna could not
run at all. Quality here means the automatic checks only. The judge and the blind check
come next, so **this is not yet the recommendation.**

| Model | Valid first time | Retried | Failed | Median latency | Cost per 20 min of video | The app's own estimate | Median output tokens |
|---|---|---|---|---|---|---|---|
| Claude Opus 5.5 | 50% | 9 | 1 | 31.2s | $0.130 | $0.050 | 2,077 |
| Claude Sonnet 5.5 | 35% | 9 | 4 | 20.1s | $0.070 | $0.025 | 1,930 |
| Gemini 3.1 Pro Preview | 100% | 0 | 0 | 31.5s | $0.062 | (not in the app) | 4,115 |
| GPT-6.1 Sol | 100% | 0 | 0 | 33.9s | $0.033 | $0.025 | 1,728 |
| Gemini 3.6 Flash | 100% | 0 | 0 | 16.9s | $0.019 | $0.009 | 3,303 |
| Gemini 3.8 Flash | 100% | 0 | 0 | 27.5s | $0.018 | (not in the app) | 3,201 |
| Claude Haiku 5.5 | 85% | 3 | 0 | 13.6s | $0.003 | $0.001 | 2,209 |
| GPT-6 Luna | 95% | 0 | 1 | 21.8s | $0.002 | $0.001 | 2,356 |

"The app's own estimate" is `estimatedOverviewCents`' figure, from `OVERVIEW_TOKENS`
(5,000 in, 1,500 out). The full tables, the check pass rates and every note side by side
are in the run's `report.md` and `sideBySide.html`.

**What the run shows:**

- **The app underestimates an overview's cost by two to three times.** Every model cost
  more per 20 minutes than `estimatedOverviewCents` says. Output is longer than the
  1,500 tokens it assumes: Gemini's figures include its thinking, which it bills as output,
  and even the leanest model, Sol, wrote a median of 1,728 output tokens. Retries add more on top.
- **Opus and Sonnet pay for the retry about half the time, and almost always for the same
  rule.** 9 of Opus's 10 retries and 13 of Sonnet's 13 first-attempt violations were the
  one-line premise going over 25 words. Sonnet's 4 outright failures were that too. A retry
  is a second full call, so Opus's $0.13 is about $0.08 with no retry.
  Getting the one-liner right the first time is the largest cost lever this run found,
  ahead of any change of model.
- **Gemini and Sol never needed the retry.** Opus, Sonnet and Luna went over the 40-word
  key-point target in half or more of their notes. Gemini and Sol never did.
- **Prompt caching earned nothing.** Cached input was 0% on every provider, so no cached
  discount applied anywhere. Anthropic caches only when asked, and OpenAI's and Gemini's
  automatic caching did not trigger: the system prompt is short and the transcript, which
  comes after it, is different every time.
- **The number check finds real slips once captions are read properly.** It reads numbers
  spelled out ("forty") and with scale words ("51 thousand"). What it still flags are
  mostly inferences, such as "$103,000" from "100k plus three", and rounding. One was a
  small error: on the Dr K clip the captions give testosterone as "about 612 to 690", Opus
  wrote "about 650" and Haiku wrote "about 600", which is outside the range.
- **Operational:** the OpenAI account's first tier allows 10,000 tokens a minute, which
  refused the two longest transcripts outright until funding raised it. Gemini 3.6 Flash
  answered 503, "high demand", on 18 of its first 20 calls, and passed on a later pass. A
  server-side queue has to expect both.

### Judged against Opus 5.5, 12 Oct 2026

All 128 pairs judged (every pair where both notes passed), for **$4.73**. One judgment
errored on a network failure and was retried.

| Candidate | Judge | Overall win rate | Record (W–T–L) | Faithfulness | Verdict | How to apply | Chapters | Reads aloud |
|---|---|---|---|---|---|---|---|---|
| GPT-6.1 Sol | Gemini 3.1 Pro | **58%** | 11–0–8 | 50% | 55% | 37% | 47% | 63% |
| Claude Sonnet 5.5 | GPT-6.1 Sol | 40% | 6–0–9 | 50% | 53% | 30% | 30% | 50% |
| Claude Haiku 5.5 | GPT-6.1 Sol | 16% | 3–0–16 | 29% | 34% | 16% | 13% | 47% |
| Gemini 3.6 Flash | GPT-6.1 Sol | 11% | 2–0–17 | 18% | 34% | 8% | 0% | 58% |
| GPT-6 Luna | Gemini 3.1 Pro | 6% | 1–0–17 | 22% | 19% | 17% | 11% | 47% |
| Gemini 3.1 Pro | GPT-6.1 Sol | 6% | 1–0–18 | 17% | 28% | 14% | 0% | 58% |
| Gemini 3.8 Flash | GPT-6.1 Sol | 5% | 1–0–18 | 21% | 34% | 13% | 0% | 50% |

50% is level with Opus. The judge never called an overall tie.

**What the judging shows:**

- **Only GPT-6.1 Sol holds its own against Opus.** At 11–8 over 19 videos it is level with
  Opus rather than proven better, since a split that close is well within chance. It does
  this at a quarter of the cost ($0.033 against $0.130 per 20 minutes) and was valid first
  time on every video.
- **Every Gemini model loses heavily, and the reasons are specific.** Gemini wrote fewer
  chapters (a median of 5 against Opus's 8) and about half the words in its key points
  (115 to 138 against 233). The judge's reasons name chapters that merge distinct
  subjects, and **facts imported from outside the transcript**: a surname the video never
  says, a "correction" of a politician's remarks, a free tier the video doesn't mention.
  The format checks passed Gemini everywhere, so this is exactly what they cannot see.
  Its 100% reliability bought nothing, because the notes were thinner and less faithful.
- **Reading aloud is the one dimension nobody loses badly** (47% to 63%), so the format's
  spoken-text rules hold across every model.
- **The cheap models are not acceptable stand-ins.** Haiku wins 16% and Luna 6%. Luna's
  notes also write "First," and "Then," into key points, which the narration adds a second
  time.
- **The judge has a mild first-position bias.** A candidate shown as A won 25% of its
  pairs, and as B 14%. The hash put 59 candidates first and 69 second, so the totals are
  only slightly affected, but a close result like Sol's should not be read finer than this.
- **Two judges, so one caveat.** Sol's own result comes from Gemini 3.1 Pro, and everyone
  else's from Sol. Gemini 3.1 Pro is not lenient towards OpenAI in general, since it gave
  Luna 6%. The blind picks are what settle whether the two judges, and your taste, agree.

### Blind picks, 15 Oct 2026

Ten Sol-against-Opus pairs, the fixed set from `--candidates openai:gpt-6.1-sol --limit 10`,
plus two Gemini pairs picked earlier.

| | Sol's record against Opus (W–T–L) | Sol's win rate |
|---|---|---|
| **The reader, blind** | 6–1–3 | **65%** |
| The judge, on the same ten pairs | 5–0–5 | 50% |

- **The reader prefers Sol more strongly than the judge does.** On Sol's ten pairs, the
  reader's blind preference for Sol over Opus is clearer than anything the judge showed.
- **Pair by pair, the reader agreed with the judge on 4 of 10.** On close pairs the
  judge's taste is not the reader's, so its calls should not be read one pair at a time,
  nor used to split two models it rates as close.
- **On big gaps it held:** both Gemini picks agreed with the judge. Its Gemini results,
  1 win in 19 or worse for every Gemini model, are far outside what a judge that is merely
  noisy on close pairs would produce.

## Recommendation

Decided 15 Oct 2026, on the run and judging above and the reader's blind picks.

| | Model | Why |
|---|---|---|
| **Best quality** | **GPT-6.1 Sol** | preferred over Opus blind, 6–1–3, and level with it on the judge. Nothing else came close to Opus on the judge |
| **Best value** | **GPT-6.1 Sol** | at a quarter of Opus's cost, valid first time on all 20 videos, and the shortest output of any model |
| **Cheapest acceptable** | **GPT-6.1 Sol** | nothing cheaper is acceptable: Sonnet costs twice as much for a 40% win rate, and every cheaper model loses at least four pairs in five |

**Generation on our key should use GPT-6.1 Sol.** On this set it costs about **$0.033 per
20 minutes of video**, measured, and the 2 hour 22 minute hearing cost $0.11. For
OV-102's Plus allowance of about $2.50 a month on our key, that is roughly 75
twenty-minute overviews. Plan for more than one call's cost per overview anyway: GPT-6.1
Sol never needed the retry here, but rate limits and network failures on a busy queue will
still mean some repeated calls.

**What this does not decide:**

- **The reader's own key.** A reader who brings an Anthropic key still starts on Opus
  (`DEFAULT_MODEL`). Opus is only narrowly worse: blind, the reader preferred Sol 6 to 3 with one tie,
  which is not a large margin over ten videos. Changing what own-key readers start on is a
  product call, not something this result forces.
- **Gemini for readers who choose it.** Gemini readers get thinner notes, and facts
  imported from outside the transcript. That is a prompt problem worth its own card
  before it is a reason to remove Gemini.
- **Prices move.** Prices were checked on 12 Oct 2026. Rerun the comparison under a new
  run name whenever a provider releases a model or reprices one. The harness, the
  transcripts and the judge are all reusable, and a full run with judging cost $12.64.
