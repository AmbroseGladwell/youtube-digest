# The capture queue

Design: "OV-27 2 Queue" (27i–27o); "OV-95 3 Waiting on a Pace", "OV-95 4 Make Now"
(95aa–95aj). Cards: OV-27, OV-95. What fills it is `playlists.md`.

Generation is the reader's own key, on the reader's own device, so nothing makes an
overview while the app is closed (`docs/architecture/v1-architecture-decisions.md`,
"Headless queue draining"). The queue is the list of videos waiting for the app to be
open: it makes them one at a time, oldest first, while it is.

## On this device, for now

The queue is the device's own until OV-11 syncs it (`CaptureQueueStore`, not journaled).
Its copy says where it runs: *on this computer*, *on this phone*, *while this panel or the
extension is open*. Followed playlists do sync, so another signed-in device checks the
same playlists and fills its own queue (`playlists.md`, "New entries").

Paused, folded into the strip, waiting at a limit, and which videos the reader chose to make
today are this device's too, kept per account in `localStorage`
(`captureQueuePreferencesStorage`).

## One at a time, oldest first

`useCaptureQueue`, owned by the `AppShell` like the reader's own run, makes the first
waiting video its playlist's pace allows ("Waiting on a pace", below) whenever nothing else
is being made, the queue isn't paused, it isn't waiting at a limit, the followed playlists
have loaded, and the shell can generate. A run the reader starts goes first; the queue resumes after it. Oldest
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
| signed out past the trial | *Sign up to keep going* · *10 videos wait for an account · a free one makes 15 a month* | Create account, Queue |
| no key | *10 videos are waiting for an API key* | Add a key, Queue |
| at the month's limit | *Queue waiting · 9 videos* · *This month's 5 are made. Resumes 1 November, or when you add a key.* | Add a key or See plans where either would help, Queue |
| paused | *Queue paused* · *10 waiting · nothing is made until you resume* | Resume, Queue |
| held | *Waiting for our server* · *9 waiting · these continue after 01:00, or now with the extension* | Queue |
| checked | *Checked 2 playlists* · *3 new videos queued · starting with the oldest*, for 8 seconds | Queue |
| attention | *Queue done · 2 need attention* · *1 failed, 1 skipped*, until dismissed | See queue, × |
| done for today | *Done for today* · *214 waiting for tomorrow, at each playlist’s pace* | Queue |
| waiting for you | *Queue done · 12 waiting for you* · *From Saved for later, made when you choose them* | Queue |
| done | *Queue done · 12 made*, for 10 seconds | × |

While videos are being made and others wait on a pace, *making* says so after its meta,
muted: *· 214 continue tomorrow* (compact: the meta becomes *214 continue tomorrow*). Its
*Making 3 of 12* counts only what can be made today.

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
moment it resumes, from the server's `Retry-After`, or the month's reset). Three reasons:

| Reason | When | Waits |
|---|---|---|
| `serverCap` | our server's daily safety cap (`daily-cap`) | until the server's `Retry-After`, or UTC midnight when it didn't say |
| `serverBusy` | our server's ordinary per-minute request limit (`rate-limited` from the `service` rung) | the `Retry-After`, or a minute when it didn't say |
| `monthSpent` | every key the next overview could use has made this month's quota | UTC midnight on the server's `resetsOn`, written as the reader's own date |

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
reason, how many were waiting, `reset`, `extension`, `key` or `plan`). They are logs rather than events
because the queue acted, not the reader (`docs/architecture/analytics.md`).

### At the month's limit

Built in OV-131 (designs 95p–95r, 95ad). The queue learns of the limit two ways: from the
month's counts (`GET /api/overview-usage`), when the next quota is spent, and from a
refusal mid-run (a `too_many_requests` naming `ours` or `own`), which `queueProblemOf`
answers as `monthSpent` and the queue keeps as a hold. Until the counts have answered the
queue makes nothing, so a queue opened at the limit never asks first; a server that can't
be asked still enforces the limit itself. The month wins over the other holds and over every
pace.

- **The strip:** *Queue waiting · 9 videos* · *This month's 5 are made. Resumes 1 November,
  or when you add a key.* Compact: *Queue waiting · 9* · *Resumes 1 Nov or with a key*, or
  *This month's 200 on your own key are made · resumes 1 Nov* where a key wouldn't help. It
  offers Add a key, or See plans, only where that would give more (`monthHoldCopy`, from the
  limit message's ways round it).
- **The queue page:** a note, *This month's 5 are made, so the queue is waiting. It carries
  on by itself on 1 November, as soon as you add a key or if your plan changes.*, with the
  same ways round; the list reads *Waiting · 9 · resumes 1 November*, and every row,
  including what would have waited on a pace, reads *Waiting for 1 November*. Pause, *Make
  now* and *Choose* are hidden, because nothing would run.
- **Resuming:** on the 1st (the queue asks for the counts again at the reset), as soon as a
  key is added or *Only ever use my key* changes, or when the plan changes.

A reader making one by hand past the cap is told the same thing in the run's own error:
*Our server has fetched as many transcripts for you as it can today. It can again after
01:00, or the extension can fetch this one now.*, and when asked to slow down, *Our server
asked us to wait a moment. It can again after 21:31, or the extension can fetch this one
now.* (`serviceTranscriptSource`).

## Waiting on a pace

Design 95aa–95ae, 95aj. A pace (`playlists.md`, "A pace for each playlist") holds only its
own playlist's videos: the queue keeps making everything else in its place. So it is a wait
on each video, not on the queue, and nothing about it is a failure. `pacedQueue` sorts what
waits, in order, into what can be made now (the reader's chosen videos first, then each
playlist's oldest up to what its pace has left today), what continues tomorrow, and what
waits for the reader. A playlist the device doesn't follow, or no longer does, reads as *As
they come*. At local midnight the counts start again by themselves.

**On the queue page**, after *Waiting* (which is only what can be made now), a *Continues
tomorrow · N* group says *These playlists have reached today’s pace. The rest of the queue
keeps going.* and splits by playlist: its name, then *Up to 5 a day · 5 made today · 7
waiting*. Rows read *Continues tomorrow*, muted, with *Make now* and Remove; never warning
ink, never *Try again*. A playlist shows four rows, or two for a backfill of more than 20,
then *N more from Psychology*. *Only when I choose* playlists have their own *Waiting for you
· N* group, *Made only when you choose them. They use none of your allowance until then.*,
rows *Waiting for you*. On a phone or in the panel, rows keep one action and Remove moves
into choosing (95ae).

**In the library**, the group's foot says *214 continue tomorrow · Psychology and Every
Lecture have reached today’s pace* (and *12 waiting for you · From Saved for later*), in
ink, linking to the queue page.

When more than one wait applies, the order is: the month, then our server's cap, then the
pace ("At the month's limit", above).

## Making waiting videos now

Design 95af–95ai. *Make now* on a row marks the video chosen (`QueuedCapture.chosenAt`) and
the queue makes it next, ahead of everything waiting, as *Next · you chose it*. A polite
notice says the pace is unchanged: *Making “How Sleep Cleans the Brain” next. Psychology
stays at up to 5 a day.* A chosen video never counts toward its playlist's pace for the
day (decided 26 Oct 2026), so making three now on a 5-a-day playlist still leaves its five.
It still counts against the month.

*Choose* turns the paced groups into labelled checkboxes (*Choose “…”*), with *Choose all
N* per playlist; *Cancel* or Escape leaves. A selection bar, a region with a live count,
says *3 chosen · Made next, oldest first. Psychology stays at up to 5 a day.* and offers
Remove and *Make 3 now* (`chooseCopy`). It works in the panel too, which holds its own
queue until OV-11. *Make now* and *Make N now* aren't offered without a key, signed out past
the trial, or while the queue waits at a limit, because they couldn't work; Remove always
is.

**More chosen than the month has left** (95ah): the bar says *You have 4 left this month,
so 4 are made now and the other 3 wait for 1 November.*, the button reads *Make 4 now*, and
the oldest 4 are made; the rest keep waiting. What's left counts every key the next overviews
could use (`leftThisMonthOf`).

## No API key

Never a spinner: every waiting video says *Waiting for an API key*, and the strip and a
note on the page point to Settings › API keys. Pause is hidden, because nothing is running.

## Signed out, past the trial

A device that has made the signed-out trial's 3 (`tiers.md`, "Counting") makes nothing
more, whatever key it holds, so the queue waits for an account the same way it waits for a
key: every waiting video says *Waiting for an account*, and the strip and a note on the page
offer Create account (`account.trial.createAccountChosen`, from `queue`). It comes before
the key state, because a key wouldn't get round it. Pause is hidden. Signing in starts the
queue again on the account's month.

## Analytics

`queue.controls.*`, `queue.item.*` and `queue.choose.*`: pausing, resuming, opening,
folding, clearing, removing, retrying, dismissing, making one now (with its playlist's
pace), and choosing several to make now or remove (with how many), each a reader action.
The queue reaching a playlist's pace is the app acting on the reader's choice, so it is not
an event: it is the `captureQueuePaced` client warning, with the pace, what was made today
and how many wait (`docs/architecture/errors-and-logs.md`, "Client warnings"). What the queue makes on its own
is not an event; the reader's action was following (`playlists.md`, "Analytics").

## Not built

Nothing from the designs this file follows.
