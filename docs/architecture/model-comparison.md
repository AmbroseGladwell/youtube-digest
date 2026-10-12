# Model comparison: which model writes the best overview for the least

OV-92. Started 12 Oct 2026. `tiers.md` and OV-19 need two numbers this file exists to
produce: what an overview costs us on our key, and which model that is. This file holds
the method, how to run it, and (once the full run has been done) the results and the
recommendation: the best quality, the best value, and the cheapest model that is still
acceptable.

**Status:** the harness, the automatic checks, the judge and the blind check are built
(`packages/model-comparison`). The first full run and its judging are recorded under
Results. Still to come: the blind picks that calibrate the judge, and the cost-lever
variants.

## What is compared, and how fairly

Every run goes through production's own `generateOverview`, with the same composed prompt
and schema and the same single corrective retry, and through the same provider adapters
the app uses (`packages/generation/src/providers`). The harness changes nothing in them.
It wraps two things from outside:

- **the `fetch` the adapter is given** (`meteredFetch.ts`), which times each call to the
  end of its body and reads the token usage the provider itself reports;
- **the client `generateOverview` calls** (`runOne.ts`), which keeps every raw attempt.
  One attempt means it was valid the first time, two mean the retry was needed. The last
  attempt is what the automatic checks read.

The reader is a blank one: no reader context, no capture reason, no topics, tags or past
claims, and every optional section switched on. Personalisation would vary from reader to
reader. Leaving it out keeps the comparison about the model.

### Models

The default set (`modelPrices.ts`) is eight models from the three providers whose keys
the experiment has: Anthropic's Opus, Sonnet and Haiku 5.5; OpenAI's GPT-6.1 Sol and
GPT-6 Luna; and Google's Gemini 3.1 Pro Preview, 3.8 Flash and 3.6 Flash. `--models`
takes any `provider:model` the app has an adapter for. A model without a price in the table
is refused, because its spend could not be capped.

`gemini-3.6`, the app's first Gemini model in `KNOWN_MODELS`, is not on Google's pricing
page as of 12 Oct 2026. Its most capable listed model is `gemini-3.1-pro-preview`, so that
is the one compared.

### Prices

`modelPrices.ts`, per million tokens, checked on 12 Oct 2026 against each provider's
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

The report then shows, per candidate, your win rate for it and how often you agreed with
the judge on the same pairs. A few dozen picks across candidates is enough to tell whether
the judge's taste is yours. If it isn't, the judge's numbers should not decide the
recommendation.

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

# the blind check, then open http://127.0.0.1:4792/
npm run blind --workspace packages/model-comparison -- --run 2026-10-12
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

### Recommendation, pending the blind picks

| | Model | Why |
|---|---|---|
| **Best quality** | Claude Opus 5.5 and GPT-6.1 Sol, level | Sol is level with Opus on the judge, and nothing else comes close |
| **Best value** | **GPT-6.1 Sol** | Opus's quality at a quarter of the cost, valid first time on every video, and the shortest output |
| **Cheapest acceptable** | GPT-6.1 Sol | nothing cheaper is acceptable: Sonnet costs twice as much for a 40% win rate, and every cheaper model loses at least four pairs in five |

**For OV-102 and OV-19:** an overview on our key costs about **$0.033 per 20 minutes of
video** on Sol, measured. The 2 hour 22 minute hearing cost $0.11. Opus, at about $0.13 per 20 minutes,
falls to about $0.08 if OV-119 removes its retries, which would still leave it at more
than twice Sol's cost.

This becomes a decision once a few dozen blind picks agree with the judge. If they
don't, these win rates should not decide it.
