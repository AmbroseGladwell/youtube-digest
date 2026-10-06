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

Paused, folded into the strip, and waiting at a limit are this device's too, kept per account
in `localStorage` (`captureQueuePreferencesStorage`).

## One at a time, oldest first

`useCaptureQueue`, owned by the `AppShell` like the reader's own run, makes the first
waiting video whenever nothing else is being made, the queue isn't paused, it isn't waiting
at a limit, and the shell can generate. A run the reader starts goes first; the queue resumes after it. Oldest
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
| held | *Waiting for our server* · *9 waiting · these continue after 01:00, or now with the extension* | Queue |
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
provider's own words. *Try again* keeps the video's place in the oldest-first order, so it
runs next rather than behind everything already waiting (decided 7 Oct 2026, OV-107). Each
failure is reported as the `queuedCaptureFailed` client warning.

A refusal that is about the reader's allowance rather than the video is not a failure, and
never lands here: see the next section.

## Waiting at a limit

Found on 6 Oct 2026 (OV-107): a 19-video playlist on a free account with no extension made
10, and the other 9 showed *Something went wrong making it. Try again*, where *Try again*
sent each to the back of the queue to fail again. The cause was our server's daily cap on
transcript fetches, which the queue could not tell from any other failure.

Now a refusal at a limit is the queue's to wait at, not the video's problem
(`queueProblemOf` answers a hold reason, which is never written onto a capture). The queue
stops asking, keeps every video *waiting*, and holds (`QueueHold`: the reason and the
moment it resumes, from the server's `Retry-After`). Two reasons so far:

| Reason | When | Waits |
|---|---|---|
| `serverCap` | our server's daily safety cap (`daily-cap`) | until the server's `Retry-After`, or UTC midnight when it didn't say |
| `serverBusy` | our server's ordinary per-minute request limit (`rate-limited` from the `service` rung) | the `Retry-After`, or a minute when it didn't say |

Another rung's rate limit is still the video's failure: only our own server's refusals say
anything about the rest of the queue. It shows why and when, written out in the reader's
clock and never counted down:

- **The strip:** *Waiting for our server* · *9 waiting · these continue after 01:00, or
  now with the extension*, or *9 waiting · it asked us to slow down · these continue after
  21:31*. Compact: *Waiting · 9 continue after 01:00*. The extension is named only at the
  cap, and only where it would be a way around, a shell with no free rung.
- **The queue page:** a note above the list, *Our server has fetched as many transcripts for
  you as it can today. These continue after 01:00, or now with the extension. Nothing has
  failed.* (or *Our server asked us to slow down for a moment. …*), and every waiting row
  reads *Continues after 01:00*. Pause and Clear still work. The words are together in
  `queueHoldCopy`.
- **The library group** shows the same rows.

*Try again* is not offered, because there is nothing to retry: a control that cannot work
is not shown ("degrade visibly"). The hold ends by itself at the resume time, or at once
when an extension connects and can fetch instead; a shell that always had one is not a
connection. In the web app that moment can't yet arrive: it needs the web-asks-extension
rung (`transcript-retrieval.md`, "What is not built"), and the queue will resume on it the
day that lands. It is kept with the device's other queue preferences, so a reopened app waits
without asking the server again, and a hold whose time has passed is not read back.

Each hold is reported as the `captureQueueHeld` client warning (the reason, how many were
waiting, seconds until it resumes) and each resumption as `captureQueueResumed` (the
reason, how many were waiting, `reset` or `extension`). They are logs rather than events
because the queue acted, not the reader (`docs/architecture/analytics.md`).

The same waiting state is meant for OV-104, where queued captures wait at the overview
limit with their own reason and resume time, and for OV-95's playlist caps: one pattern,
different reasons. Once transcripts ride on overviews (`docs/architecture/tiers.md`), the
limit a reader normally meets is OV-104's; this one is the safety cap behind it. A
heads-up before a big playlist run ("10 of these 19 can be made today") belongs to OV-104.

A reader making one by hand past the cap is told the same thing in the run's own error:
*Our server has fetched as many transcripts for you as it can today. It can again after
01:00, or the extension can fetch this one now.*, and when asked to slow down, *Our server
asked us to wait a moment. It can again after 21:31, or the extension can fetch this one
now.* (`serviceTranscriptSource`).

## No API key

Never a spinner: every waiting video says *Waiting for an API key*, and the strip and a
note on the page point to Settings › API keys. Pause is hidden, because nothing is running.

## Analytics

`queue.controls.*` and `queue.item.*`: pausing, resuming, opening, folding, clearing,
removing, retrying and dismissing, each a reader action. What the queue makes on its own
is not an event; the reader's action was following (`playlists.md`, "Analytics").
