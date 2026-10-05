# The capture queue

Design: "OV-27 2 Queue" (27i–27o). Card: OV-27. What fills it is `playlists.md`.

Generation is the reader's own key, on the reader's own device, so nothing makes an
overview while the app is closed (`docs/architecture/v1-architecture-decisions.md`,
"Headless queue draining"). The queue is the list of videos waiting for the app to be
open: it makes them one at a time, oldest first, while it is.

## On this device, for now

The queue is the device's own until OV-11 syncs it (`CaptureQueueStore`, not journaled).
Its copy says where it runs: *on this computer*, *on this phone*, *while this panel or the
extension is open*. Followed playlists do sync, so another signed-in device checks the
same playlists and fills its own queue (`playlists.md`, "New entries").

Paused, and folded into the strip, are this device's choices too, kept per account in
`localStorage` (`captureQueuePreferencesStorage`).

## One at a time, oldest first

`useCaptureQueue`, owned by the `AppShell` like the reader's own run, makes the first
waiting video whenever nothing else is being made, the queue isn't paused, and the shell
can generate. A run the reader starts goes first; the queue resumes after it. Oldest
first is the order videos were added to their playlist, then the order they were queued
in (`oldestFirst`, `capturesFor`).

Each video goes through the same pipeline as a run the reader starts
(`useRunOverviewGeneration`), with the playlist it came from written onto the overview.
The one difference: a queued overview does not ask for its narration straight away, so a
large backfill doesn't queue as many renders on the server.

Just before making a video, the queue checks the library for it. One that another device
made and synced, or that the reader made by hand, is taken out of the queue unmade.

Pausing stops the video being made at its next step and leaves it unmade at the top of
the queue. Whatever it had spent on that video is spent, as with Cancel on a run.

## Where it lives

**In the library (27i).** A recessed group above the finished tiles: what is being made
and the next two, with *See queue* and the count of what needs attention. Pending videos
don't pretend to be overviews: no raised tile but the one being made, a faded thumbnail,
no verdict or topic, and a text status (*Making now*, *Next*, *Waiting*) so the difference
never rests on colour. The chevron folds the group into the strip (27i-2), which then
carries the attention count and *Show queue*. The group shows above the first-run hero
too, so following a playlist before making anything still shows what waits.

**The queue page (27j, `/queue`).** Making now, then the waiting list in order, numbered,
each with a labelled Remove, then Needs attention. Pause or Resume and Clear queue, which
asks once, inline, and says the playlists stay followed. The heading takes focus on
arrival. The panel has the same page, reached from its strip (27o).

## The strip

The generation strip's slot and shape (3c), one state at a time (`captureQueueStrip`):

| State | Says | Offers |
|---|---|---|
| making | *Making 3 of 12* · the step · the title, with progress | Details, Pause, Queue |
| no key | *10 videos are waiting for an API key* | Add a key, Queue |
| paused | *Queue paused* · *10 waiting · nothing is made until you resume* | Resume, Queue |
| checked | *Checked 2 playlists* · *3 new videos queued · starting with the oldest*, for 8 seconds | Queue |
| attention | *Queue done · 2 need attention* · *1 failed, 1 skipped*, until dismissed | See queue, × |
| done | *Queue done · 12 made*, for 10 seconds | × |

*Making 3 of 12* counts this sitting's batch: made, this one, and what waits. Progress is
the batch's, with the current video credited only for steps that have happened. Problems
left from an earlier sitting don't announce themselves on opening; the library group and
the page still carry them.

A reader-started run takes the slot first, then the queue, then the move notice, the
usage prompt and the account strips. Its text is a polite live region. On a phone it
goes compact, with 44px icon buttons; in the panel it sits on the home screen (27o).
*Details* opens the current video's steps in a dialog of its own (`QueueRunDialog`).

## Needs attention

A video the queue can't make stays, with a reason, until the reader dismisses it:

| | Why | Offers |
|---|---|---|
| Skipped | made private, or deleted, on YouTube: known before anything was tried | Dismiss |
| Failed | no captions, YouTube won't show it here, or something else went wrong making it | Try again, Dismiss |

The reason is named by kind from the ladder's last answer (`queueProblemOf`), never in a
provider's own words. *Try again* puts the video at the back of the queue. Each failure is
reported as the `queuedCaptureFailed` client warning.

## No API key

Never a spinner: every waiting video says *Waiting for an API key*, and the strip and a
note on the page point to Settings › API keys. Pause is hidden, because nothing is running.

## Analytics

`queue.controls.*` and `queue.item.*`: pausing, resuming, opening, folding, clearing,
removing, retrying and dismissing, each a reader action. What the queue makes on its own
is not an event; the reader's action was following (`playlists.md`, "Analytics").
