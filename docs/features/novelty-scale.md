# The novelty scale

A verdict's novelty answers one question: **how much of this would a well-read person in
the video's field already know?** The model judges it against what it knows of the field,
never against the reader's own library. Whether the reader has already saved something
like it is a separate, personal signal, `similarTo`, drawn from their past claims.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The three levels, and what the line naming the fresh part is called | `packages/domain`: `Novelty`, `NOVELTY_LABEL`, `STANDS_OUT_LABEL` |
| The sentence that says what novelty was judged against | `NOVELTY_BASIS`, shown under every verdict |
| The rubric, one example per level, and the rule that the library is not the yardstick | `packages/generation/src/sections/verdictSection.ts` |
| What stands out kept only above common knowledge, a blank one read as missing, and its stretch timed from the transcript | `assembleOverview.ts`, `resolveStandsOut` |
| The time at the end of a timed line, and the menu it opens | `LineRangeTag`, rendered by `ReadAlongNote` after any line with a `range` |
| Every overview from before this change read as common knowledge | migration 5 in `overviewMigrations.ts` |
| Shared copies made before it, likewise | `apps/api/migrations/V0013__shares_on_the_new_novelty_scale.sql` |
| The spread of levels, and how often what stands out is named | `capture.newOverview.finished`'s `novelty` and `standsOut` |
| The behaviour in the reader | `noveltyScale.iwft.ts`, `keyPointRanges.iwft.ts`, `watchAnywayRange.iwft.ts` |

## Why the old scale went

Across the first 36 overviews, the old scale gave 29 Established, 3 Recycled, 2 Novel and 2
with no verdict. A label that gives the same answer about 80% of the time can't help a reader
triage. It also mixed two questions. Recycled meant both "repackaged advice" and "you have
saved this before", and some Established reasoning cited the reader's own library. The
reader's own view is that a note on something they already know is still useful, because it
confirms they know it. That is a personal signal and doesn't belong in a general label.

## The levels

| Level | Means |
|---|---|
| Common knowledge | Standard knowledge in the field, however well explained. |
| Fresh angle | Mostly common knowledge, with one fresh part: a method, a number or a demonstration. |
| Original | The central claim, method or evidence is something most people in the field would not know. |

The names are chosen to stay clear of each other and of the line under them. "Familiar"
was rejected because it suggests "you've seen it", which is the personal question this
scale gave up. "Established" was rejected because it suggests "well supported", which is
what `dubious` judges. None of the three names says "new", so the line naming the fresh
part can't echo a label.

Recycled has no successor on this scale. "You already have this" belongs to claim overlap
(`similarTo`). "Mostly a sales pitch" is already covered by What it sells and by
`dubious`.

## What stands out

There is one line for Fresh angle and Original: the fresh part itself, not praise of it.
Common knowledge never has one, even when the model writes one, because a line there would
contradict the label. A Fresh angle or Original verdict that comes back with a blank line is
kept with `standsOut: null` rather than failing the overview, and the analytics count it as
missing.

It also carries the stretch of the video where the fresh part is shown, so the reader can go
to it. The model names that stretch as transcript segment numbers and code turns them into
times, as watch-anyway's range does (`docs/prototype/constraints.md`). A range that doesn't
fit the transcript is dropped instead of failing the overview: the line still stands, just
without the jump. The Markdown export links the range to
the video.

Key points carry a stretch the same way, with the same handle, and for the same reason: a
reader who wants the part behind a point can go straight to it. A point the video builds
across several places has no range, and so no jump. Both kinds are counted as
`readAlong.rangeFollowed`, with which kind of line it was and how the reader went there.
Key points written before this change keep their words and have no range (migration 5,
and `V0013` for shares).

In the read-along note the novelty label is a chip beside the Verdict heading, shown but
not spoken. The fresh part comes first under the heading, under its own sub-label, What
stands out, and is spoken with the sub-label in front of it. The reasoning comes next under a sub-label of its
own, Why, which is the only one on a Common knowledge verdict (design "OV-94 Verdict
Basis", 94a). Sub-labels are `NoteLine.label`: shown above the line's words, never tinted
with them. The basis sentence closes the Verdict section, after the reasoning, small and
muted, and isn't spoken: it's there to read once, not to hear on every narration.

## The time is the handle

The design (Claude Design, "OV-83 Novelty") keeps the note reading as plain text. Each
timed line ends with its start time in small muted figures, like a footnote mark, and that
time is the only control. Pressing it opens a short menu: the range, then **Watch from**
(a link to YouTube at that time) or **Skip to** (where the video is playing beside the
side panel), then **Read in transcript**. Nothing appears or moves on hover, so touch,
keyboard and mouse all get the same thing. Hovering a line still gives it the soft tint
it always had, and lifts its time onto a pill so there is visibly something to press.

- **The line stays the control for listening.** Each line is a row holding an inline
  "listen from here" control, with the time as a sibling after it, never nested inside
  it. Pressing the time never moves the reading mark. Tab goes to the line, then to its
  time. The menu has arrow keys, and Escape or a press outside closes it and puts focus
  back on the time.
- **Placement.** On a desktop and in the side panel, the menu hangs under the time,
  aligned to the line's right edge. It opens upward when the player bar would cover it
  and there is room above the sticky chrome; otherwise it opens downward and scrolls
  into view. On a phone it is a bottom sheet that repeats the line at the top, so it's
  clear which point it's for.
- **The line being read** puts its time on the card colour, so it stands off the tint and
  the jump for what you're hearing is one press away.
- **Watch it anyway** uses the same tag, filled at rest and showing the whole range,
  because there the jump is the point of the section. It replaced the row of buttons at
  the foot of the note.
- **The ▷ start time that narrated lines showed on hover is gone.** Pressing the line
  already listens from it, and two different clocks beside one line would have to be told
  apart.
- On the shared page, **Read in transcript** is left out when the share carries no
  transcript.

## What it is judged against

"Judged by the AI against what it knows of the field. Very recent work may be missed and it
can make mistakes." This sits under every verdict in the note, in plain text, so it can be read without a hover.
It comes last, after the reasoning, in the reader, on the shared page and in the Markdown
export alike. It was first placed just under What stands out, as the design had it, but
the design had no reasoning paragraph: against a real verdict it split the label from the
reasoning it explains (OV-94). Its last clause is OV-86's "can make mistakes" notice, folded
in so the verdict carries one notice rather than two. It is a caption (`overviewNoteCaptions`), not a `NoteLine`,
so it can't be tapped, tinted or timed, and the spoken script has no entry for it.
Novelty is the model's judgement from its training, with no search behind it, so a
genuinely recent development can come out as common knowledge, and the reverse can
happen too. The sentence says so instead of implying a check the app never makes.

## Overviews from before the change

The split isn't derivable: nothing in an Established record says which side of Fresh angle
it falls on (`record-migrations.md`, "Splits are not derivable"). Only the developer's own
overviews were written on the old scale, so migration 5 reads every old verdict, whatever
its value, as Common knowledge with nothing named as standing out, and the overview stays
readable. Regenerating one gives it a real verdict on the new scale. Shared copies are frozen
JSON on the server, so `V0013` applies the same rewrite to them. A copy rewritten that way no
longer hashes to the note it was made from, so its owner is told they have edited it since
sharing. That is true, if not by their own hand.

`CLIENT_VERSION` moved to 2 with this migration. A client still on 1 holds back overviews
saved at version 5 instead of reading them loosely. What it writes is stored at version 4,
old scale and all, and a current client reads it as Common knowledge through the same
migration.
