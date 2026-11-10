# Cost model: one shared note per video, a personal pass per reader

Decided on 19 Oct 2026 (OV-19), from a measurement on that day. **Not built yet.**

`open-questions.md` #2 put it as the central product tension: an overview is written for one
reader, so two readers of the same video pay for it twice, and cost grows with readers rather
than with videos. The decision is a hybrid:

- **Shared: one note per video,** covering everything the video decides on its own: the premise,
  the core claim, the key points, the verdict (novelty, what stands out, dubious claims and the
  reasoning), what it sells, whether to watch it anyway, and the chapters.
- **Personal: a short pass per reader,** written from the shared note **without the transcript**:
  how to apply it, the topics it's filed under (and any suggested topic), its tags, and which of
  the reader's past claims it repeats.
- **The first reader's overview seeds the shared note.** They get today's single pass, and nothing
  changes for them. Its shared part is kept. Every later reader of the same video gets the
  personal pass alone.

**Build it once readers actually overlap.** With one reader today, it saves nothing. The build
card is OV-124.

## What it measured

Run `ov19-2026-10-19`, on OV-92's 20 videos (`model-comparison.md`, "The transcript set"), on
GPT-6.1 Sol, the model on our key. Every cost comes from the provider's own usage report,
never a model's estimate (`docs/prototype/constraints.md`). $1.53 in all, judging included.

| | Mean cost | Per 20 min of video | Median prompt tokens | Median output tokens | Median wait |
|---|---|---|---|---|---|
| Shared note, no reader (OV-92's run `2026-10-12`) | $0.0379 | $0.0326 | 7,957 | 1,687 | 34s |
| **Single pass, personalised (today)** | **$0.0381** | $0.0328 | 8,389 | 1,636 | 41s |
| **Personal pass, from the shared note** | **$0.0047** | $0.0040 | 2,244 | 241 | 9s |
| Personal pass, with the transcript | $0.0193 | $0.0166 | 6,906 | 242 | 9s |

All 60 runs passed their schema first time.

**The personal pass from the note costs about the same at any video length:** $0.0035 to $0.0066
on every video, from 1 minute to the 2 hour 22 minute hearing. For that hearing it is 4% of a
single pass ($0.0044 against $0.1118). The pass with the transcript grows with length, as the
single pass does.

**The reader's own context costs almost nothing in the single pass.** The single pass with the
sample reader and OV-92's pass with no reader differ by 432 prompt tokens and $0.0002. So
"personalisation is expensive" was never about the reader's context. It's about writing the
whole note again for each reader.

### What it costs per reader of one video

| Readers of the video | Single pass | Hybrid, seeded by the first reader | Hybrid, separate shared pass |
|---|---|---|---|
| 1 | $0.0381 | $0.0381 | $0.0426 |
| 2 | $0.0381 | $0.0214 | $0.0237 |
| 5 | $0.0381 | $0.0114 | $0.0123 |
| 10 | $0.0381 | $0.0080 | $0.0085 |

"Seeded by the first reader" is the decision: the first reader's single pass becomes the shared
note, so their overview costs what it does today. A separate shared pass with no reader, then a
personal pass for everyone, costs the first reader 12% more and saves the later ones very little
over seeding.

## Quality: what the personal pass loses

A judge compared each video's personal parts (how to apply, filing and similar past claims)
from the single pass against each personal pass. Both sides sit on the same shared note, so only
the personal parts differ. Wins are the personal pass's:

| | From the note | With the transcript |
|---|---|---|
| How to apply | 6 wins, 6 ties, 8 losses | 5, 7, 8 |
| Filing | 5, 14, 1 | 3, 16, 1 |
| Similar past claims | 0, 20, 0 | 0, 20, 0 |
| **Overall** | **8, 4, 8** | 5, 7, 8 |

- **From the note, it comes out level overall.** Filing is a little better, and how to apply a
  little worse.
- **Most of its how-to-apply losses are steps the video doesn't give.** The judge marked down
  4 of the 20 from the note and 2 of the 20 with the transcript for that: a schedule, a
  duration or a trial length fitted to the reader. For the arms video it suggested "a 6-week
  trial" and measuring the arms before and after, where the video teaches a weekly split.
- **That is allowed (decided 19 Oct 2026).** How to apply is the reader's way of acting on
  what the video teaches, so a step the video doesn't spell out is fine as long as it
  sensibly applies what the video teaches. The judge's rubric was stricter than the product,
  so on the product's own standard the personal pass does better than 6 wins, 6 ties and
  8 losses. Facts are different: a name, number or claim stated *about the video* still has to
  come from the video (OV-120).
- **Giving it the transcript doesn't help.** It costs four times as much, does no better, and
  still adds steps the video doesn't give.

### What this doesn't show

- **Similar past claims weren't really tested.** The sample reader's five past claims share
  nothing with these videos, so every pair tied. Test it with a reader whose library does
  overlap.
- **One judge, of the same provider.** Sol judged two Sol outputs. Both sides come from the same
  model, so neither is favoured for its style, but there was no blind check by the reader as
  OV-92 had.
- **A made-up reader.** The reader context is a one-line stand-in (`SAMPLE_READER_CONTEXT`),
  and the topics, tags and past claims come from the five notes in `samples/`. A real library
  sends more past claims and tags, which both passes pay for. No real reader sends a context
  yet: the pipeline sends it, but nothing in the apps writes `readerContext` (OV-46,
  `docs/features/personalisation.md`).
- **The saving depends on overlap,** meaning how often two readers save the same video, and
  nothing measures that yet. Count it before building (OV-124).

## Rules the build has to keep

- **The shared note may carry nothing personal.** It's the first reader's overview with how to
  apply, topics, tags, similar past claims and the reason they saved it removed (`sharedPartOf`
  in `packages/model-comparison`). Check that the first reader's context doesn't bend the shared
  parts too: in a single pass the model sees the reader and the reason they saved the video while
  it writes the key points. If it does, the shared pass runs with no reader, and the first reader
  pays the 12%.
- **Trust what it's built from.** A shared note is served to readers who never saw its
  transcript, so build it only from a transcript the shared cache would accept
  (`docs/features/shared-transcript-cache.md`), never from one reader's unchecked upload.
- **Key it by prompt and model.** A shared note made with an older prompt or another model isn't
  the note a new reader would get. A change to either starts a new shared note rather than
  serving the old one.
- **Every shared section is written, whatever the reader has turned off.** Sections a reader has
  disabled (`sectionsEnabled`) are hidden when shown, not left out of the shared note.
- **Quotas still count overviews, not tokens** (`tiers.md`). A reader can't see or predict
  whether someone else saved the video first.

## Running it again

```sh
# needs OV-92's transcripts and its stage-one run in packages/model-comparison/.local
task secrets:evals -- npm run cost-model --workspace packages/model-comparison -- \
  --run <name> --stage-one-run 2026-10-12 --budget 2 [--limit <videos>] [--model provider:model]
```

It runs the single pass with the sample reader, both personal passes from each single pass's
note, then the judge, all under one budget. A settled run isn't paid for twice. The report is
written to the run's folder as `report.md`. The pieces are in `packages/model-comparison/src`:
`ReaderProfile.ts`, `personalisePrompt.ts`, `runPersonalPass.ts`, `judgePersonalPair.ts`
and `costModelMarkdown.ts`.

## The kind check (OV-275)

Measured on 10 Nov 2026, not estimated (`docs/prototype/constraints.md`). Every figure comes from
the providers' own usage reports at the list prices in `modelPrices.ts`, through the comparison
harness, as the sample reader. `main` (runs `main-275-*`) against the branch (runs `ov-275-*`), two
samples a side, on OV-92's 20 videos and OV-122's recipe set of six (four recipes, a taste test
and a talk). $9.16 in all.

**What it is.** Since OV-275 a video's overview is two calls: a small check that reads the title,
channel, description and about four minutes of the transcript and answers the note's kind, then
the note, whose schema now carries only that kind's sections (`overview-generation-decisions.md`,
"The kind check").

**The 20-video set** (no recipes), mean cost per overview:

| | Before | After: the note | After: the check | After: in all | Change |
|---|---|---|---|---|---|
| GPT-6.1 Sol, our key | $0.0333 | $0.0301 | $0.0019 | **$0.0319** | **−4%** |
| Claude Sonnet 5.5 | $0.0552 | $0.0553 | $0.0044 | **$0.0597** | **+8%** |

| | Note input tokens, median | Note output tokens, median | Check input / output | Median wait |
|---|---|---|---|---|
| Sol, before → after | 9,500 → 8,578 | 1,570 → 1,638 | 1,317 / 12 | 35.5s → 38.1s |
| Sonnet, before → after | 14,921 → 14,130 | 1,712 → 1,851 | 2,084 / 13 | 13.6s → 16.2s |

- **Taking the recipe block out saves about 800 to 900 input tokens on every video.** On Sol that
  more than pays for the check, so an overview on our key costs slightly less than before. On
  Sonnet the saving was cancelled by longer output in this sample (139 tokens, within the
  run-to-run spread OV-87 saw), so the check's cost shows through.
- **The check is about 6% of an overview on Sol and 8% on Sonnet.** Its output is a dozen tokens;
  its cost is its input, most of it the description and the opening. A shorter opening is the
  dial if that share matters.
- **It adds about two and a half seconds**, since the note can't start until the kind is known.

**The recipe set**, mean cost per overview:

| | Before | After, in all | Change |
|---|---|---|---|
| Sol | $0.0325 | $0.0290 | −11% |
| Sonnet | $0.0654 | $0.0464 | −29% |

A recipe video's note no longer pays for key points, a verdict and the rest it never showed, so
its note costs far less and the check is more than paid for.

**Detection.** Every recipe video was a recipe note in all four of its runs (16 of 16), the taste
test and the talk were the default note in all of theirs, and none of the 80 overviews of the
20-video set was routed as a recipe. Before, the shortest recipe video errored on Sonnet twice and
Sonnet needed three retries on the set; after, every recipe run passed first time.

**What it means for the tiers.** On our key an overview is $0.0319 against `tiers.md`'s $0.038,
so nothing the allowances were sized on moves. On a reader's own key the check is theirs to pay,
at most a fraction of a cent. The Unit economics dashboard counts the check in its measured cost
per overview and shows its share (`unit-economics.md`), so the live figure can be read against
these.

## Quotations under key points (OV-216)

Measured on 10 Nov 2026 through the comparison harness, as the sample reader, at the list prices
in `modelPrices.ts`, not estimated. Video: the 20-video set, two samples a side, against the
OV-275 runs (`ov-275-*` → `ov-216-*`). Articles: the coverage set's five articles, two samples a
side, from just before sentence numbering against after (`main-216-articles-*` →
`ov-216-articles-*`). $6.91 in all, the judge included.

**Dollars moved more than tokens, because of the prompt cache.** Sol's cached share of input fell
from 55% to 33% between the video runs, which is timing rather than the change, so the honest
comparison is the same tokens priced with nothing cached:

| | Input tokens | Output tokens | Cost, nothing cached |
|---|---|---|---|
| Video, GPT-6.1 Sol | +10% | +18% | **+13%** |
| Video, Claude Sonnet 5.5 | +2% | +14% | **+6%** |
| Article, Sol | +4% | +8% | **+6%** |
| Article, Sonnet | +14% | +14% | **+14%** |

- **Output grows because quotations carry an added line**, and a model writes more around them.
  The quotation text itself costs nothing: code lifts it.
- **Input grows with the instructions**, and for articles with the sentence markers, which the
  articles' +4% on Sol bounds. Sonnet's article input rose more because it needed the correction
  pass on 8 of 10 articles on both sides (OV-277), so its prompt was sent twice either way.
- On our key a video overview is now about $0.036 at the cache rates of the OV-275 run, against
  `tiers.md`'s $0.038, so the allowances still hold, though with less room than OV-275 left.

**What a reader hears.** Quotations add about 30 seconds to a video note's narration, 13–14% of it
(223 → about 250 seconds on Sol), and 6–10% to an article's. Sol quotes 2.5 points a note and
Sonnet 1.5, against a budget of 3 on most notes; one note in 80 went over. What stands out was
quoted on 37% of notes. No video quotation was dropped for falling outside its point (0 of 156
named), and 2 of 23 article ones were.

**The added line.** Sol wrote one beside 25% of its quotations and Sonnet beside 63%. A judge of
another provider (Gemini 3.1 Pro) read each against its point: **Sol's added something in 62% of
cases and restated the point in 33%; Sonnet's added something in 54% and restated in 46%.**
`overview-generation-decisions.md`, "Evidence", has what was decided about it.

## Search by meaning (OV-229)

Measured on 9 Nov 2026, not estimated (`docs/prototype/constraints.md`). OpenAI's own usage report
for embedding 111 of the owner's overviews (826 claims and key points) and 29 searches with
`text-embedding-3-small` came to **37,702 tokens**, about **335 tokens an overview**.

| | Tokens | Cost at $0.02 per million |
|---|---|---|
| Embedding one overview, once | ~335 | **~$0.0000067**, 0.02% of the $0.0381 single pass |
| One search | ~10 | ~$0.0000002 |
| A million searches | ~10M | ~$0.20 |
| Re-embedding a million overviews, if the model ever changes | ~335M | ~$6.70 |

The price is OpenAI's published rate for `text-embedding-3-small` as of November 2026; check
it before relying on these figures. Every embedding is paid on our key, whichever key wrote the
overview, and is not counted against any quota (`tiers.md`): it is too small to be worth a
reader's thought. The embedding worker logs the tokens each overview cost (`api.meaning.embedded`),
so the real figure can be read back from the logs. The spike behind the choice of model is in
`docs/features/search-by-meaning.md`, "Why OpenAI".
