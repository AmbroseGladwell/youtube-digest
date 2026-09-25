# Capture reason: why you saved it

The prototype's queue took an optional note beside each URL ("How to get massive arms",
"Why do mammals get 1 billion heart beats?"). It was written in the moment of saving and
read back hours later, when the note landed, as a reminder of what the reader had wanted
from the video. The rewrite carried the field (`Overview.captureReason`, see
`docs/architecture/v1-architecture-decisions.md`) but nothing in either client could
write it. Design turn 20 and 21 give it three places to be written and one to be read.

## Where it is written

**While the overview is being made (design 20a, 21a).** An underline field sits under the
progress steps, in the web dialog and on the side panel's working screen: *What are you
hoping to take away? Optional*. Capture stays one click; the wait is what gets used. The
field saves on blur or when the overview lands, and there is nothing to confirm. Whatever
is typed is kept through *Run in background*, through closing the dialog, and through
reopening it from the strip, because it lives on the run rather than on the form. The
field stays through the done state too, so a reason can still be added before pressing
*Read overview*.

**From the overview's own page (design 21c, 21d, 21e).** The ⋯ menu carries *Add reason*
when there is none and *Edit reason* when there is, under *Edit topics* because both are
"about this overview" edits. Either turns the read-back line into the field, with focus in
it: Enter or *Save* keeps it, Escape or *Cancel* puts the line back as it was, and *Remove
reason* is offered only when there is one to remove. Saving an emptied field is the same as
removing. Asked for from the Transcript or Chapters tab, the editor arrives on the
Overview tab, where the line lives.

**Not before Create (design 20b).** The design drew a text link ahead of the button and
recommended against it: it asks for the reason at the moment you most want to just press
the button, and it cannot work for the injected YouTube button at all without that button
stopping being one click. The injected button therefore takes no reason; the panel it
opens asks for one while the run is going, and the page offers to add one after.

## Where it is read

**One line above the premise (design 20c, 21b).** *You wanted to know*, then the reason in
italics, against a hairline of accent. It renders only when a reason exists; there is no
empty slot inviting one. It is the reader's own words, so it is not part of the note the
read-along paces through or the meta line that measures it.

## What it means for the prompt

The reason is typed *after* generation has started, so the prompt never sees it. The
`Why they saved it:` line in `composePrompt` is filled only by a caller that had the reason
before it began (the sanity-check scripts do), and reads "not said" for every overview
either client makes. That is deliberate rather than a gap: the verdict's worth is its
independence from what the reader hoped the video would be, and a model told to serve a
hope will find the video delivers on it. The five sample reasons are all restatements of
the title or a question the title poses, so there is little the transcript does not
already carry to set against that pull. If a later turn wants the reason to shape the
`howToApply` section, that section already has a reader-context slot built for fit, and
that is where such text belongs.

## How it is stored

`captureReason` stays on the `Overview` record: it is a fact about why the video was saved,
not a flag the reader toggles, and it travels with the record on export. Editing goes
through `OverviewStore.setOverviewCaptureReason`, a named read-modify-write like
`setOverviewTopics`, so that the write merges into the stored record rather than
replacing it and cannot drop a field a newer client wrote
(`docs/features/record-migrations.md`). The pipeline reads the draft at the moment it
writes the record; a keystroke that lands between that read and the run's completion is
written by the run's own success handler, so the two never disagree.

Empty and whitespace-only drafts become `null`, in one place (`captureReasonFromDraft`),
so "no reason" is one value everywhere it is read.
