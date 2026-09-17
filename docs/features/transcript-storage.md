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

## What the tab does with the timing

Each caption row prints its own start time and links out to the video at that second.
`formatTimestamp` floors rather than rounds, so a link lands just before the words rather
than just after them; `formatTimeRange` (the "Jump to 3:20–5:10" pointer in the reader's
rail) is built from the same function so the two can't drift apart.

The timings are Supadata's own caption offsets, never a number a model produced — the rule
in `docs/prototype/constraints.md` about never letting a model measure anything.

A transcript that came from the ASR fallback (`mode=generate`, used only when a video has
no caption track at all) is labelled `Machine-transcribed` in the tab's accent slot, for
the same reason the placeholder rows were labelled: machine-heard text is not the video's
own words, and the reader should be able to tell.

## What this does not do

- **Chapters.** Still placeholder, and still blocked on generation work rather than on
  data: titling each stretch of a video is a new prompt section, not a UI change.
- **Following playback.** The transcript does not move with the read-along, and the
  read-along still paces the *note*, not the video. That belongs with the extension's
  playback-following work (`docs/architecture/v1-architecture-decisions.md`, v1 feature scope).
- **Highlighting the "watch it anyway" range** inside the transcript, which is now
  possible for the first time — both the range and the segment timings are in the same
  units — but was left out to keep this change to storage and display.
- **Reading the cache before fetching.** The pipeline writes the store and never reads it,
  so a second note on the same video still spends a credit. Skipping that fetch needs the
  video id *before* the transcript call, which means resolving metadata first and
  restructuring `fetchTranscript` around it.
