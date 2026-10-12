# Model comparison: which model writes the best overview for the least

OV-92. Started 12 Oct 2026. `tiers.md` and OV-19 need two numbers this file exists to
produce: what an overview costs us on our key, and which model that is. This file holds
the method, how to run it, and (once the full run has been done) the results and the
recommendation: the best quality, the best value, and the cheapest model that is still
acceptable.

**Status:** the harness and the automatic checks are built (`packages/model-comparison`).
The model-as-judge, the blind A/B page, the cost-lever variants and the full run are still
to come. Each one adds its section here.

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
```

Keys are read as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `GEMINI_API_KEY`, injected by
`task secrets:run` (`docs/conventions/secrets.md`), and listed in `scripts/sanityCheck.env`.
A model whose provider has no key is skipped with a line saying so.

**The budget** is measured spend under the run's name, including earlier invocations of
it. Once it is reached, no new overview is started. Models run in parallel and a video
already started is allowed to finish, so a run can go over by at most one overview per
model. On this set that is under $1 in the worst case, the 2 hour hearing on Opus.

The report is two files in the run's folder: `report.md`, with the table per model of
reliability, latency, cost and check pass rates, and `sideBySide.html`, which shows each
video's notes and chapters from every model in one row, with any failed checks marked.

## Results

Not yet run on the full set. A smoke run on 12 Oct 2026, with Haiku 5.5 on the two
shortest videos, passed the schema first time on both and cost $0.0043 in all. It also wrote
4,259 output tokens for a 9-minute video, almost three times the 1,500 that
`OVERVIEW_TOKENS` in `KnownModel.ts` assumes for a 20-minute one. The full run will
show whether that figure needs revising.
