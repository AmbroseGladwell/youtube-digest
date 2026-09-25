# Reading position

The transcript tab remembers where you had got to, per video, and opens there next time.
`docs/features/following-playback.md` recorded this as the one thing the reference
implementation did better than ours, and as a feature in its own right; this is that
feature, on both surfaces.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The shape: a video id and the start of a block | `features/transcripts/types/ReadingPosition.ts` |
| Most recent first, one per video, twenty kept | `util/readingPositions.ts`, with its unit test |
| `localStorage`, and every failure swallowed | `features/transcripts/readingPositionStorage.ts` |
| Measuring, saving, restoring | `TranscriptPanel/useReadingPosition.ts` |
| The follow standing down for a restore | `useFollowPlayback`'s `held` option |
| The behaviour, end to end | `readingPosition.iwft.ts` |

## What is remembered

**A time, not a scroll offset.** The position is the `startMs` of the block that was
across the middle of the window, and the same block is put back in the middle on return.
A pixel offset would only be right in the layout that wrote it: the panel and the wide
reader set the same blocks at different heights, and a machine-heard transcript re-merges
into different blocks if the merge rules move. A block's start time survives all of that,
and `blockAtPosition` already answers "which block holds this time" for the follow.

**Measured off the rows, not derived from the scroll.** On each scroll, at most once per
frame, the hook reads the rows' own boxes and takes the one nearest the middle. Nothing
estimates where the reader is from `scrollY` and an average row height, which is the
kind of number `docs/prototype/constraints.md` exists to forbid.

**The top is nothing to remember.** If the first block is in the middle, the entry is
removed rather than written. A transcript opened at the top is the default, and on the
panel it means the following resumes rather than being held off for a position that is
nowhere.

## Where it lives, and for how long

`localStorage`, in the same way the API keys are kept and for the same reason: it is
per device and per origin, which is exactly what a reading position is. The extension and
the web app are two libraries already, and where you had got to in one does not belong
in the other. It is not on `OverviewState`, which is keyed by overview rather than by
video and is the kind of user state a sync will one day carry, and a field that changes
on every scroll would be a bad thing to give an outbox.

Twenty videos are kept, most recent first. A reading position is a convenience rather
than a record, and the cap is what stops a convenience growing without bound. Every read
and write is wrapped: a browser that refuses site data costs the reader the memory and
nothing else, and a stored value that does not parse is simply no memory.

## Restoring, and the follow

**The restored position wins over the player.** In the panel, a transcript you had
scrolled ahead in is put back where you left it, with the following *off* and
`↓ Follow playback` already offered. This is the reference implementation's behaviour,
kept for its reason: being yanked from the paragraph you were reading to the one being
spoken is the follow doing the wrong thing at the wrong moment.

It takes a small piece of mechanism to get right, because the follow and the restore
would otherwise both scroll in the same frame and the last one would win. The restore is
known before anything scrolls, from the stored time and the blocks, so `useFollowPlayback`
takes a `held` flag for as long as one is pending: it neither scrolls nor observes while
held, and it sets its own state to *not following* when it is held, so nothing resumes
when the hold is lifted. The row refs settle the other half: a row that is both the
restore target and the player's current block gives its ref to the restore, and the
follow gets it back once the restore is done.

**Following forgets.** While the transcript follows the video the position is not
written, and the moment following comes on the stored one is removed. A position the
player chose is not one to come back to, and pressing `Follow playback` is the reader
saying so.

**A chapter's ask beats the memory.** Opening the transcript from a chapter goes to the
chapter (`docs/features/chapters.md`), and the remembered position is ignored for that
visit. The scroll that follows is remembered as usual.

## The panel is keyed by the video

`ReaderPage` keeps the same tab across *Previous* and *Next*, so moving to another note
on the Transcript tab used to hand the same panel a different video. That was harmless
until the panel held state read once at mount. It is now keyed by the video id, so a
different video is a fresh panel: the memory, the search and the follow all start again,
which is what a different transcript deserves.

## What this does not do

- **Remember the note.** The read-along paces the overview and has its own position;
  the overview tab opens at the top as it did.
- **Survive across the two libraries.** Two origins, two memories, by the same
  reasoning as two libraries.
- **Restore the exact pixel.** The block goes back to the middle of the window, which is
  within a paragraph of where the eye was and identical between layouts.
