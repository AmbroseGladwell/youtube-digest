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
- **Its typical slip in how to apply is an invented protocol.** For the arms video it suggested
  "a 6-week trial" and measuring the arms before and after. The video teaches a weekly split and
  nothing like that. The single pass, writing while it reads the transcript, stayed with what the
  video teaches. The build should tighten the how-to-apply instruction for the personal pass
  ("only what the note says the video teaches"), and measure again.
- **Giving it the transcript doesn't help.** It costs four times as much, and it does no better.

### What this doesn't show

- **Similar past claims weren't really tested.** The sample reader's five past claims share
  nothing with these videos, so every pair tied. Test it with a reader whose library does
  overlap.
- **One judge, of the same provider.** Sol judged two Sol outputs. Both sides come from the same
  model, so neither is favoured for its style, but there was no blind check by the reader as
  OV-92 had.
- **A made-up reader.** The reader context is a one-line stand-in (`SAMPLE_READER_CONTEXT`),
  and the topics, tags and past claims come from the five notes in `samples/`. A real library
  sends more past claims and tags, which both passes pay for.
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
task secrets:run -- npm run cost-model --workspace packages/model-comparison -- \
  --run <name> --stage-one-run 2026-10-12 --budget 2 [--limit <videos>] [--model provider:model]
```

It runs the single pass with the sample reader, both personal passes from each single pass's
note, then the judge, all under one budget. A settled run isn't paid for twice. The report is
written to the run's folder as `report.md`. The pieces are in `packages/model-comparison/src`:
`ReaderProfile.ts`, `personalisePrompt.ts`, `runPersonalPass.ts`, `judgePersonalPair.ts`
and `costModelMarkdown.ts`.
