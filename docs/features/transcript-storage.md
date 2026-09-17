# Transcript storage, and the reader's transcript tab

The generation pipeline already fetched a timed transcript for every note and threw it
away the moment the overview was written. This keeps it, and the reader's Transcript tab
reads it back instead of the placeholder rows it shipped with
(`docs/features/overview-redesign.md`, "What was not built").

## Keyed by video, not by overview

A transcript belongs to the video, not to the note taken from it. Two things follow:

- **Regeneration.** An overview record is replaced wholesale on a re-run — the reason
  read/favourite state lives in its own table (`docs/prototype/decisions.md`). A transcript
  stored on the overview would be rewritten on every re-run for no reason, and a re-run
  that mints a new overview id would strand the old copy.
- **The shared cache.** `docs/architecture/architecture-options.md` §Ideas 2 already
  decided transcripts are "their own resource which we could use again if another user
  requests the same video… saved with a date, youtube video id". `TranscriptStore` keyed
  by `VideoId` is the local-only shadow of exactly that interface. When the paid tier's
  shared cache arrives, it is a second implementation of this interface rather than a
  migration.

So a transcript gets its own interface (`packages/types/src/TranscriptStore.ts`), its own
IndexedDB object store, and its own conformance suite — a third store alongside
`OverviewStore` and `SettingsStore` rather than a few more methods on either.

## Where the video id comes from

`VideoSource` gained an `id`, taken straight from Supadata's `Metadata.id` — the
platform's own id for the video, not something derived by parsing the URL. Two URLs for
the same video (`youtu.be/X`, `watch?v=X&t=30`) would otherwise key two copies of the same
captions, and the stored `url` is whatever the reader happened to paste.

It is nullable, like `durationMs` and `thumbnailUrl` before it, because notes generated
before this existed have no id to offer. Those notes can never find a transcript, so the
tab says so rather than showing an empty list — the degrade-visibly rule in `CLAUDE.md`.
Nothing backfills them: as `docs/prototype/open-questions.md` #3 already notes about timing,
an existing note cannot be given one without re-fetching its video.

## Stored before generation, not after

`runOverviewGeneration` saves the transcript immediately after the fetch, before the model
is called. The Supadata credit has already been spent by that point, so a generation that
fails, errors, or is cancelled should not make the next attempt pay for the same captions
again. The IWFT `a generation that fails still leaves the transcript stored` is what holds
that ordering in place.

## Captions are merged into blocks before they are shown

A YouTube caption cue is three to five seconds and a handful of words, broken wherever the
line filled up. That is a data format, not a reading format, and one row per cue made the
tab a caption file on screen. `transcriptBlocks` merges them into paragraphs.

The algorithm is ported from `zarazhangrui/youtube-digest`'s `groupTranscriptEntries` — the
same reference repo `docs/architecture/architecture-options.md` cites for extension UX. It
splits each cue into clause pieces on `.!?;:,`, then accumulates pieces until a rule fires:

| Limit | Value | What it does |
|---|---|---|
| `minChars` | 180 | a sentence end closes the block once it is at least this long |
| `idealChars` | 180 | a *clause* end counts as a boundary past this |
| `maxChars` | 320 | splits a single over-long piece; nothing else |
| `impatientMs` | 8_000 | a sentence end closes the block under `minChars` once this long has passed |
| `clauseMs` | 20_000 | a clause end counts as a boundary past this elapsed |
| `runOnChars` | 384 | closes the block with no boundary at all |
| `runOnMs` | 25_000 | the same, on elapsed |
| `silenceMs` | 4_000 | a gap this long starts a new block |

Three things here will look like mistakes to anyone diffing against the reference, and are
not:

**`minChars` is 180, not the reference's 60.** At 60 a block ends at the first sentence
boundary past sixty characters, which for ordinary speech means one sentence per block — an
improvement on one caption per block, but still a list rather than prose. 180 is the point at
which a block reads as a paragraph. Note what it does *not* change: `impatientMs` still ends
a block at any sentence boundary eight seconds in, so a slow speaker's blocks stay shorter
than 180 characters. That rule, not `minChars`, is the one to move if blocks ever need to be
longer again.

**Three of its five flush conditions are gone.** They are implied by the other two:
`reachedGuardrail` is `atNaturalBoundary && (len >= maxChars || elapsed >= clauseMs)`, but
320 chars implies 180 and 20s implies 8s, so the first condition already covers it;
`atNaturalBoundary && reachedIdeal` is covered the same way; and inside `atNaturalBoundary`,
the `len >= maxChars` leg is covered by `len >= idealChars`. Two conditions, identical
behaviour. Do not restore them.

**The time and silence checks run before a piece is appended, not after.** The reference
glues the far-away piece onto the open block and only then notices the block is too old, so
two cues an hour apart become one block spanning an hour, labelled `0:00` — which is exactly
what this project's own IWFT fixture contains. Checking first is what makes a block's
`startMs` and `endMs` actually bound its words.

Two additions the reference does not have: `silenceMs`, which extends that same reasoning to
ordinary pauses, and a block break before any cue that opens with `>>`, because a speaker
change is the strongest paragraph boundary there is. The markers themselves are stripped at
display rather than at fetch — `mapTranscriptContent` stays 1:1 with Supadata because that
stored text is what the model is given, and stripping at display also fixes every transcript
stored before this. A `>>` in the middle of a cue is left alone.

Dropped: the reference's CJK whitespace-joining rules, which exist because that extension is
bilingual by design and ours is not. Its CJK sentence and clause punctuation stays in the
character classes, because without it a Chinese transcript would never find a boundary.

## The reading grain of a machine-heard transcript

ASR captions carry no punctuation, so no sentence or clause boundary ever fires and only the
run-on guardrails are left: a block every 384 characters or 25 seconds, cut mid-sentence.
That is still around seventy words at a normal speaking rate, so it reads as a paragraph —
but an arbitrary one, which is part of what the `Machine-transcribed` label in the tab's
accent slot is telling the reader. Restoring punctuation would mean a model re-emitting the
video's own words, which is not a trade worth making.

## What the tab does with the timing

A block prints the start of the caption its first words came from, and links out to the
video at that second. Never a position interpolated inside that caption, which is what the
reference does: `formatTimestamp` floors rather than rounds precisely so a link lands just
before the words rather than just after them, and an interpolated offset is as likely to
overshoot as to undershoot. It would also sit in the same slot as the measured ones with
nothing to tell them apart, where today every number in that column is Supadata's own
caption offset — the rule in `docs/prototype/constraints.md` about never letting anything
fabricate a measurement. `formatTimeRange` (the "Jump to 3:20–5:10" pointer in the reader's
rail) is built from the same function so the two can't drift apart.

The cost of that choice: when one caption contains a whole short block, the next block
starts inside the same caption and the two print the same second. That is true rather than
tidy, and `transcriptBlocks.test.ts` pins it.

## Display-only, and why that matters

Only the tab merges; the store keeps cues. That is not a preference —
`packages/generation/src/composePrompt.ts` numbers the raw segments for the model and
`assembleOverview.ts`'s `resolveRange` maps the indices it returns back to real `startMs`
and `endMs` for the watch-it-anyway range. Renumbering segments before the prompt would
silently point that range at the wrong part of the video: a measurement quietly wrong rather
than visibly missing, which is the class of bug `docs/prototype/constraints.md` is about. The
IWFT that asserts three stored captions rendering as two blocks is what holds the two apart.

Keeping the store raw also means the limits above can be retuned without re-fetching a
single transcript.

## What this does not do

- **Chapters.** Still placeholder, and still blocked on generation work rather than on
  data: titling each stretch of a video is a new prompt section, not a UI change.
- **Following playback.** The transcript does not move with the read-along, and the
  read-along still paces the *note*, not the video. That belongs with the extension's
  playback-following work (`docs/architecture/v1-architecture-decisions.md`, v1 feature scope).
- **Highlighting the "watch it anyway" range** inside the transcript. Closer than it was:
  a block carries `endMs` as well as `startMs`, so the range and a block are now in the same
  units and comparable directly.
- **Restoring sentences in a machine-heard transcript**, and **filtering `[Music]` or
  `[Applause]` cues**. Both would put something between the reader and the video's own words.
- **Reading the cache before fetching.** The pipeline writes the store and never reads it,
  so a second note on the same video still spends a credit. Skipping that fetch needs the
  video id *before* the transcript call, which means resolving metadata first and
  restructuring `fetchTranscript` around it.
