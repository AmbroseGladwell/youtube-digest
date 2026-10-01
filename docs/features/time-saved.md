# Time saved

OV-34. The product's promise is to watch less and learn more, and until now nothing showed
the reader what that adds up to. The agreed designs are four pages in the design project:
*OV-34 1 Every Day*, *2 Milestones*, *3 Phone and Panel* and *4 Lines and Motion*. This
build covers parts 1, 2 and 3, and part 4's lines. It is free for everyone.

## Counted honestly

The figure is the one a reader would believe if they checked it, so it is arithmetic over
what is stored and never a model's estimate (`docs/prototype/constraints.md`).

- **Read overviews only.** An overview saved but not read hasn't saved anything yet.
- **Each one saves its video's length minus the reading time the reader is shown**: the
  `N min read` of the meta line, from `noteTiming` at 220 words a minute. Whole minutes,
  floored at zero, so the total is always the sum of the pills a reader has seen.
- **At 1×.** The breakdown says so: *Counted at normal speed. If you'd have watched faster,
  you saved less.*
- **Left out, and said so:** an overview with no video length (`durationMs` is null for
  older notes and live content) is never estimated, and one whose verdict said to watch it
  (`watchAnyway.answer === "yes"`) saved nothing.
- **A verdict that said to watch part of it** counts the video less that part, and the
  breakdown says how many were counted that way.
- **Time actually watched is not subtracted yet.** Nothing stores how much of a video was
  played; the design's *1 you partly watched* line waits for that.

`timeSavedSummary` in `@overview/domain` is the whole calculation. It is derived, not
stored: a pure function over the library, so it is right on every device once read state
syncs and can never drift from the data.

## Every day

**The total (34q).** One rolling figure in the library subtitle, `13 overviews · 5 unread ·
9h 47m saved`. A change rolls like a mechanical counter: minutes first, carrying into tens
and then hours (`odometerColumns`). The figure is a button whose accessible name is the
figure in words, *Time saved: 9 hours 47 minutes*; it opens the breakdown.

**The breakdown (34ai).** The figure, how it is counted, the way to the next milestone in
that milestone's colour, the ones already reached, what was left out, and the 1× caveat. A
bottom sheet on a phone and a centred card on a desktop, like the other dialogs. Part 3
draws only the phone; the desktop total is drawn as a button in parts 1 and 2 without saying
what it opens, and the breakdown is where the card's "says what it left out" lives, so the
desktop opens the same panel.

**The moment (34q, 34r).** *Mark read* brings in *Saved you N min* beside the reading line.
On a library row it leaves after about three seconds and nothing stays on the row; *Mark
read* and *Read* share one width so nothing shifts. In an overview it counts up from nought
and stays until the reader leaves, whichever control marked it read. The panel's overview
has its own *Mark read* beside *Listen* for this (34v), and the chip starts the next line
when the reading line has no room for it. An overview with no
length, a watch verdict or nothing saved shows no chip.

## Milestones

30 minutes, 1, 5, 10, 15, 20, 30, 50, 75 and 100 hours, the last for now (`MILESTONES`).

**The card (34za).** The milestone's colour as a tint (16% over the dark tile, 12% over
white, kept as tokens in `theme/tokens.scss`), a ringed pill naming it, the total rolling in,
and five lines that cycle. A light passes over it now and then.

**Where it sits.** On a wide screen, in the rail under the filters (34ab). Where the rail is a
sheet behind the filter button, below 62rem, it sits above the first overview instead (34ad),
since a card inside a closed sheet would never be seen. Verdict folded into *More filters*
at the foot of the rail to make room; closed, the row still says what is set (*Any verdict*,
*Dubious only*), so a hidden filter is never a surprise.

On the extension panel's home it sits under the hint below the primary action (34af). The
home is otherwise unchanged: the panel has no running total and no breakdown, only the card
on a milestone day. It is the same reader on the same account, so it records crossings and
dismissals by the same rules.

### When a milestone shows

- **For 24 hours from the moment it is crossed**, on every device opened in that time, and
  then it is gone, seen or not.
- **× hides it for good, on every device.** Undo is offered for a few seconds on the device
  that dismissed it.
- **Several at once stack**, shortest first, with the next ones peeking out underneath in
  their own colours and *1 of 3 new milestones* above. Each dismisses separately and keeps
  its own 24 hours.
- **Only while the total still reaches it.** Unreading below a milestone hides its card; it
  is not crossed a second time.

Each card shows the total as it stands. The design's stack draws each card with a figure
just past its own milestone, which no single save can produce.

The crossing time and the dismissal live on the account, in `Settings.milestones`, keyed
by milestone. That record already syncs, merges a patch one level deep the way
`sectionsEnabled` does (`mergeSettingsRecord`), so one device dismissing a milestone never
takes another's newly crossed one with it, and already carries one dismissal
(`plusNoticeDismissed`). Keys are any string rather than the ten known ids, so a milestone a
newer client adds survives an older one writing the record back.

A crossing is recorded the first time a device sees the total at or past it with no mark
yet. A signed-in device waits for its first sync of the session before recording anything,
so a library still arriving from the server is not mistaken for milestones crossed just now.
A reader whose library already passes several milestones the first time this ships sees
them as one stack, which the design anticipates ("or a first import").

### The lines

Five per milestone, three comedy then two facts, in the order part 4 lists them
(`milestoneLines.ts`). Each stays up for a time set by its length, between six and thirteen
seconds; the current dot stretches into a bar that fills meanwhile. Hovering or focusing the
card holds the line. A swipe, the arrow keys or a dot moves to another. Part 4 asks for the
facts to be checked before shipping.

## Motion

Every animation goes through `theme/global.scss`'s reduced-motion rule, and the two driven
from script (the rolling total and the chip's count-up) check `prefersReducedMotion` and
jump to their end. Lines still change under reduced motion, without the movement, and still
hold on hover and focus.

## What is counted

Analytics holds only what the reader did (`docs/architecture/analytics.md`, "Actions, not
logs"):

- `timeSaved.library.breakdownOpened`: the total pressed to open the breakdown.
- `timeSaved.milestoneCard.dismissed` and `timeSaved.milestoneCard.dismissalUndone`, with
  the milestone.
- `timeSaved.milestoneCard.lineChosen`, with the milestone and whether it was a swipe, the
  arrow keys or a dot: whether anyone reads past the first line.

A milestone being crossed, and so shown, is the app acting rather than the reader, so it is
a log line instead. The API logs `time-saved milestones changed` whenever a settings patch
crosses, dismisses or restores a milestone, with each milestone's change
(`milestoneChanges`). That covers signed-in readers; a device that is not signed in has no
server to log to, and nothing from the client is shipped anywhere until OV-61.

## Not built yet

- **Subtracting time actually watched.**
- **Sharing the total** (OV-30) and a weekly or monthly recap.
