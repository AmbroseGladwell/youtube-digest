# Chapters

The reader's third tab, and the last of the three to hold real content. A chapter is a
stretch of the video with a title and a two-line summary, timed from the transcript, and
what a chapter *does* when pressed depends on which surface is showing it: the panel moves
the player it is beside, the wide reader links out to YouTube, and both can open the
transcript at that point.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The shape: title, summary, `startMs`, `endMs`, in order and not overlapping | `packages/domain`: `Chapter`, `Chapters` |
| The record field, null for a note made before this existed | `Overview.chapters`, and migration 4 in `overviewMigrations.ts` |
| The prompt section, and the output shape the model fills in | `packages/generation/src/sections/chaptersSection.ts` |
| Segment indices resolved to the transcript's own times | `assembleOverview.ts`, `resolveChapters` |
| The tab, and the three things a range can be | `ChaptersPanel` |
| The transcript opening at a point rather than at the top | `TranscriptPanel`'s `openAtMs`, wired in `ReaderPage` |
| The behaviour, end to end | `chapters.iwft.ts` |

## Structural, not a toggle

The prompt is a registry of sections, and the four opinionated ones — verdict, selling,
how to apply, watch it anyway — are the ones a reader can switch off
(`docs/features/overview-generation-decisions.md`, "The composable prompt"). Chapters
join the other side of that line. Where a video's subject changes is a fact about the
video rather than a judgement for one reader, which puts it in the objective, cacheable
half alongside the core claim and the key points; and the tab is drawn whether or not the
section ran, so a toggle would only ever produce an emptier screen. It runs every time
there is a transcript to split.

## The model names a segment, never a time

`docs/prototype/constraints.md` is the rule that produced the shape: the model is not
allowed to measure anything. It says where each chapter *begins* as `startSegmentIndex`
into the numbered transcript it was shown — the same device the watch-it-anyway range
uses — and code does everything with time:

- a chapter starts where its segment starts;
- it ends where the next chapter begins, so the list is contiguous and reads as a map of
  the whole video rather than a set of highlights with gaps between them;
- the last one ends where the last caption ends.

**Chapters span the words, not the video.** The first build ran the last chapter out to
`video.durationMs`, on the reasoning that a map of the video should reach its end. It was
changed on the first real run: a video often has an outro with nothing said in it, and an
intro with no words before the first caption, and neither is part of any chapter. So the
first chapter starts wherever the first caption starts, which may not be 0:00, and the
last ends with the final caption, which may be short of the video's length. The
transcript tab already prints the same times, so the two tabs agree on where the words
are. `video.durationMs` is not consulted at all, which also sidesteps the fact that a
Supadata duration is caption-derived and was measured falling short of the captions
(`docs/architecture/v1-architecture-decisions.md`).

The schema carries the ordering as a refinement — the first chapter starts at segment 0,
each starts after the one before it — which is not expressible in the JSON Schema the model
sees, so it is enforced the way the word caps are: `generateOverview` parses, names the
violation, and asks once more. An index past the end of the transcript is a plain
`max` on the integer and is caught before that. `resolveChapters` still refuses an
out-of-bounds index with a `GenerationError` rather than clamping, for the same reason
`resolveRange` does: a chapter that silently snapped to the last caption would look
right and be wrong.

There is a count in the prompt — "most videos have 3 to 8" — and it is guidance, not a
constraint. The schema requires at least one, because a video with a transcript has at
least one stretch, and sets no upper bound: an hour-long lecture is allowed to have
fifteen. Titles cap at 8 words and summaries at 40, checked on the record as well as on
the way out of the model, as `CoreFields` does.

## Null is a state the reader is told about

Every note written before this existed has no chapters, and nothing in such a record can
produce them: where a subject changes is not derivable from a claim and five key points
(`docs/features/record-migrations.md`, "Not every schema change is a migration").
Migration 4 therefore fills `chapters: null` — the honest value, and one the type can
name — rather than `[]`, which would mean the section ran and found one video with
nothing in it. The tab distinguishes the two on screen: a note made before chapters says
that generating it again would add them; a note whose transcript had nothing to split
says that instead. An empty transcript is the only way to the second, and the schema
forces `[]` there rather than letting a chapter be invented for a video with no words.

## What a range is, on each surface

The range is the control, as the transcript's times are, and for the same reason: the
title and the summary are things you read, and a row that was one big button would take
the click that selects a word (`docs/features/transcript-storage.md`). The same printed
range is one of three things:

| Where | The range is | Because |
|---|---|---|
| The panel, beside the video it is about | a button that seeks the player | `useSeekPlayback` reports a player playing this video (`docs/features/following-playback.md`) |
| The wide reader — the web app, or the extension's own page | a link to YouTube at that second, in a new tab | there is no player to move, and the rail's jump link already sends the reader out this way |
| The panel, whose tab has moved on to another video | plain text | seeking would move the wrong video, and a link out from beside a YouTube tab is the thing the transcript's rows deliberately stopped doing |

`ChapterRange` reads the layout (`useIsPanel`) rather than the surface: the extension's
full-page document is a library with no player next to it, and it should link out exactly
as the web app does.

Beside the range, **Transcript** opens the transcript at the chapter's start. It is drawn
only when a transcript is stored for the video — the query is already cached by the time
the tab opens — because a note whose captions were never kept would land on the tab's
"nothing stored" line, and a control that leads to a dead end is worse than none
(`CLAUDE.md`, "Degrade visibly").

## Opening the transcript somewhere

`TranscriptPanel` gained `openAtMs`. When set, the block the position falls inside
(`blockAtPosition`, now over anything timed) is marked and scrolled to the centre, and the
following stands down, exactly as searching stands it down: opening the transcript at a
chapter is scrolling away from the video, and two things fighting for the scroll was the
failure `docs/features/following-playback.md` designed against. The reader gets
`↓ Follow playback` back the moment they want it.

The mark is the current block's wash without its edge. It says *here is where you asked
for*, where the edge says *here is where the video is*, and the two can be different rows
at once in the panel.

The target belongs to the route that set it. `ReaderPage` clears it on every other change
of tab, so choosing Transcript yourself after coming back from a chapter opens it at the
top with nothing marked, rather than jumping to a point you asked for a minute ago. The
panel is keyed on the tab and remounts, so there is no stale scroll to undo.

## The chapter the video is inside

In the panel, while the player reports, the chapter containing its position carries the
transcript's current-block treatment — an accent edge and the faintest wash — and moves
with playback. It does not scroll: a chapter list is short and fits, and an auto-scroll on
a list you can see whole is a wobble rather than a service. `docs/features/extension-panel.md`
noted Chapters as the one tab where the panel's chrome could not be observed because it
had nothing to scroll; that is still nearly true, and is now by design rather than by
absence.

## What this does not do

- **Speak the chapters.** The read-along paces the note and the chapters are a map of the
  video, not part of the note. `overviewNoteLines` is unchanged.
- **Search them, or put them in the export.** Both are the transcript's tools and act on
  its blocks. Chapter titles as search terms in the library is a reasonable idea and is
  not built.
- **Let the reader edit a chapter.** A wrong boundary is regenerated, not corrected.
- **Highlight the watch-it-anyway range against the chapters.** The two are in the same
  units now, which makes it cheap, and it is still parked with its sibling in
  `docs/features/transcript-storage.md`.
