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

The record later grew the `VideoSource` the captions were fetched with, so the metadata
call is cached by the same key rather than paid for twice — see
`docs/features/watching-detection.md`, "Both halves of the purchase are cached, in one
record".

## Where the video id comes from

`VideoSource` gained an `id`, taken straight from whichever rung answered — the
platform's own id for the video, not something derived by parsing the URL. Two URLs for
the same video (`youtu.be/X`, `watch?v=X&t=30`) would otherwise key two copies of the same
captions, and the stored `url` is whatever the reader happened to paste.

It is nullable, like `durationMs` and `thumbnailUrl` before it, because notes generated
before this existed have no id to offer. Those notes can never find a transcript, so the
tab says so rather than showing an empty list — the degrade-visibly rule in `CLAUDE.md`.
Nothing backfills them: as `docs/prototype/open-questions.md` #3 already notes about timing,
an existing note cannot be given one without re-fetching its video.

## Stored before generation, and read before fetching

`runOverviewGeneration` saves the transcript immediately after the fetch, before the model
is called, so a generation that fails, errors, or is cancelled still leaves the captions
behind. That ordering only saves money if something reads them back, and originally nothing
did — the pipeline wrote the store and never queried it, so a retry, and a second note on
the same video, each bought the same captions again.

The obstacle was that the video id arrives from a metadata call while the credit is spent by
a separate transcript call, with no gap between them to ask a question in. That split is now
internal to the rung that needs it: a source billing the two halves separately probes the
store between them, and one returning both in a single free call has no such gap to fake
(`docs/features/transcript-retrieval.md`). Metadata is still resolved on every run: the overview needs the title, channel,
duration and thumbnail, and `StoredTranscript` holds none of those — it is captions keyed by
video, not a copy of the video.

Two IWFT scenarios hold this in place, and both assert the caption endpoint's
call count rather than only the stored record, because the call count is the thing that costs
money: `a generation that fails still leaves the transcript stored` now retries to completion
and expects that count still at one, and `a second note on a video already in the library`
expects zero.

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

Two additions the reference does not have. `silenceMs`, which extends that same reasoning to
ordinary pauses. And a block break before any cue that opens with `>>`, YouTube's own
speaker-change marker, because a change of speaker is the strongest paragraph boundary there
is — in an interview it is what gives a two-word answer its own block instead of burying it
in the middle of the interviewer's next question.

That break is only half of it: a block that opens a new turn is printed with an em dash, so
the reader can see why a line as short as "Thank you." stands alone. The reference strips the
markers and keeps neither the break nor the mark. We keep both — the dash *is* the `>>`,
in the punctuation a reader already knows for dialogue.

The markers are stripped from the text at display rather than at fetch, because
the store keeps the platform's own caption text — that stored text is what the model is given
— and stripping at display also fixes every transcript stored before this. A `>>` in the
middle of a cue is left alone.

What a `>>` does *not* carry is who is talking. The convention is a bare "someone else now";
a captioner may write `>> ALICE:` instead, and where they have, the name is part of the
caption text and is displayed as they wrote it. Machine-heard captions carry no markers at
all, so a transcript with no dashes anywhere is the normal case rather than a failure.

## Noise in brackets is dropped; names in brackets are not

`[Music]`, `[Applause]`, `[MUSIC PLAYING]`, `[laughter]` and the rest are annotations of the
soundtrack, not of anything anyone said, and they read as litter in the middle of a
paragraph. They are dropped at display, alongside the speaker markers and for the same
reasons.

Only bracketed text that actually names a non-speech sound is dropped, never every bracket,
because the other thing a captioner puts in brackets is a speaker's name — `[Alice]` is the
alternative to `>> ALICE:`, and deleting it would take away the very thing the em dash exists
to supply. `[inaudible]` survives for the same reason: it marks something a reader should
know is missing. A caption that is nothing but an annotation drops out entirely, which leaves
a gap in the timings — and a long enough musical interlude then breaks the block on
`silenceMs`, which is the right thing for it to do.

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

A block prints the start of the caption its first words came from. Never a position
interpolated inside that caption, which is what the reference does: `formatTimestamp` floors
rather than rounds precisely so a time lands just before its words rather than just after
them, and an interpolated offset is as likely to overshoot as to undershoot. It would also
sit in the same column as the measured ones with nothing to tell them apart, where today
every number there is the platform's own caption offset — the rule in
`docs/prototype/constraints.md` about never letting anything fabricate a measurement.
`formatTimeRange` (the "Jump to 3:20–5:10" pointer in the reader's rail) is built from the
same function so the two can't drift apart.

A block is a paragraph you read, not a control — still true now that the time beside it
sends the video there, because only the **time** takes the click and never the paragraph.
The reference extension shows both sides of why: a whole row that seeks swallows the click
that selects its words, which it has to guard with a text-selection check, and a row made
clickable by a listener on a `div` cannot be reached by keyboard at all. A timestamp that
is a button is reachable, is labelled, and breaks no selection.

Where there is no player to move, the time is printed exactly as it was. See
`docs/features/following-playback.md` for what draws that line.

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

## Reading the transcript, rather than only looking at it

The tab's head is one line — the label, and what you can do with the whole transcript
against the far edge — over the search box, with room above it so the label is not
pinned against the tab strip it comes to rest under.

The tab grew three tools, all of which work on the merged blocks rather than the stored
cues, and none of which is panel-specific:

- **Search.** A literal, case-insensitive substring match — the box says "words or
  phrases", and a transcript is full of characters a regular expression would read as
  syntax. Every hit is marked, the current one is marked differently, and `↑`/`↓` walk
  them and wrap. Searching also stands down the playback following, for the reason in
  `docs/features/following-playback.md`.
- **Copy** and **Export** produce the same text, from one function, so a pasted
  transcript and a saved one cannot disagree. It opens with the title, channel and URL —
  a transcript with no video attached to it is hard to place a week later — then one
  block per paragraph against the time its first words were said, keeping the em dash a
  change of speaker is printed with. Copy hides itself where `navigator.clipboard` has no
  `writeText`, which an insecure context does not.

All three render only when there are blocks to act on, so the error, empty and loading
states carry no tools.

## What this does not do

- **Chapters.** Still placeholder, and still blocked on generation work rather than on
  data: titling each stretch of a video is a new prompt section, not a UI change.
- ~~**Jumping to the video from a block.**~~ Settled, once there was one answer for all of
  it: the time seeks the video already playing beside the panel. Opening YouTube in a new
  tab — what these rows linked to for one commit — is the half this was waiting to avoid,
  and moving the read-along stays a separate clock
  (`docs/features/following-playback.md`).
- ~~**Following playback.**~~ Built — see `docs/features/following-playback.md`. The
  transcript moves with the *video*, off the player's own `currentTime`, in the side
  panel only. The read-along still paces the note rather than the video, and the two are
  deliberately separate clocks.
- **Highlighting the "watch it anyway" range** inside the transcript. Closer than it was:
  a block carries `endMs` as well as `startMs`, so the range and a block are now in the same
  units and comparable directly.
- **Restoring sentences in a machine-heard transcript.** It would put a model between the
  reader and the video's own words, and cost a call per transcript to do it.
