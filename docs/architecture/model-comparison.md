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
task secrets:run -- npm run compare --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 1 --limit 3

# then the full set under the same run name: settled runs are not paid for twice
task secrets:run -- npm run compare --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 10

npm run report --workspace packages/model-comparison -- --run 2026-10-12

# the judge: a few pairs first, then the rest under the same run name
task secrets:run -- npm run judge --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 1 --limit 4
task secrets:run -- npm run judge --workspace packages/model-comparison -- \
  --run 2026-10-12 --budget 6

# the blind check: the ten pairs that decide it, then open http://127.0.0.1:4792/
npm run blind --workspace packages/model-comparison -- --run 2026-10-12 \
  --candidates openai:gpt-6.1-sol --limit 10
```

`--candidates provider:model,...` limits judging to some candidates.

Keys are read as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY`, injected by
`task secrets:run` (`docs/conventions/secrets.md`), and listed in `scripts/sanityCheck.env`.
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
task secrets:run -- npm run readers --workspace packages/model-comparison -- \
  --run readers-2026-11-08 --budget 1 --limit 3
task secrets:run -- npm run readers --workspace packages/model-comparison -- \
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
task secrets:run -- npm run readers --workspace packages/model-comparison -- \
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
