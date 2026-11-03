# Personalisation: what an overview is made for

Cards: OV-46 (the first of its stacked PRs), then OV-141, which replaced About you's chips.
Designs: "OV-141 1 The Sentence", "2 What It Changes and Settings", "3 Learning and the Reveal"
(141a–141q).

Two settings shape an overview before it is made, and both are now sent with every run,
on the reader's key and on us alike (`runOverviewGeneration` reads them from Settings):

- **`aboutYou`**, the reader's sentence in parts. `composeReaderContext` turns it into the line
  the prompt gives to how to apply only ("About the reader, for fit: …",
  `howToApplySection.ts`), so the steps fit the person reading. How to apply may go beyond what
  the video spells out as long as it sensibly applies it, and a context is what makes those
  steps fit. **It shapes How to apply and nothing else:** the right depth differs per video, so
  one stated level can't set it, and the verdict stays judged against the field.
- **`sectionsEnabled`**, which of the four optional sections the overview has: the verdict,
  what it sells, how to apply, and watch it anyway. The premise, key points, chapters and
  filing are always written.

Both are settings, so they sync and follow the reader to every device.

## About you

One sentence with three sections: "I'm [who you are], I spend my time on [work and fun], and
right now I'm focusing on [what you're focusing on]." It is asked in onboarding
(`onboarding.md`, 141a) and in Settings › Personalisation (141k, 141l), through one
`AboutYouEditor`. Reader copy calls the parts sections, never blanks.

A section takes as many entries as fit in 120 characters, measured as they join in prose, from
suggestions or in the reader's own words. Every group of suggestions ends with Your own.
Empty sections hold phrases that read naturally, so the sentence is whole at every step, and
none of it is required. Nothing measures how complete it is. "What you're focusing on" opens with
the suggestions of the topics the reader picked (`starterTopics.ts`), then general goals.

Entries are stored as chosen, in `Settings.aboutYou`, so Settings reopens the sentence as it was
left. Chips carry one or two words; `AboutYou.ts` adds the article for who you are ("a dad") and
leaves empty sections out of what is sent and read back.

Wide, the sheet is a popover under the sentence; on a phone, a bottom sheet; in the panel it takes
the panel over. An entry reaches the sentence on Done, or Escape, and focus returns to its
section. A chosen entry flies to its section and the pill settles (141i); reduced motion fades it
in instead. The sentence is repeated in a hidden polite status line.

Both places say that on us it goes through our server to OpenAI with each overview.

### A profile that learns

After onboarding the profile updates itself, like ChatGPT's memory. Every three overviews
(`profilePassIsDue`, counted by code against `overviewsAtLastProfilePass`) a small **profile
pass** reads the sentence, what's held, what was removed and the 12 newest overviews: title,
Premise, topics and capture reason. Capture reason is fine here because the profile only reaches
How to apply; `capture-reason.md` keeps it away from the verdict, and this doesn't change that.

The model says what it noticed and which overviews it rests on. **Code does all the counting:**
it dedupes the overviews, needs at least two behind an item, writes the source line ("From 4
overviews on app growth", from their commonest topic) and drops anything already held or removed
whatever the model says. At most two items a pass, sixty characters each.

It runs after an overview lands, on the key that made it, signed in only. On us it is
`POST /api/generations/profile`: **free, not counted against the plan or the day's overviews,**
held to 30 a day for an account by its own rate limit. Failing never touches the overview and
the reader isn't told; the schedule moves on regardless, so a broken key isn't retried on every
overview.

`Settings.learned` is keyed by item, merged one by one, so two devices adding and removing at once
both land. A removed item stays in the map with `removedAt` set, which is what keeps it from
coming back; Clear everything removes them all the same way. The reader context is the sentence,
then "Also: …" with the newest items for as many as fit under 600 characters.

**Telling the reader.** An item stays unnoticed until shown, so nothing joins the profile unseen.
The notice is on the library only (141n), so it can't cover a note or the read-along, and it
waits there if the reader was reading when the pass finished. It stays ten seconds, longer while
hovered or focused. Undo removes the item and says so for four seconds; See opens Settings. Items
already in use are used from the next overview.

**Settings › Personalisation** shows What we know about you: the sentence, Learned from your
overviews with each item's source and Remove, and Keep learning. Off, nothing new is learned and
what's held stays. Where no key can run the pass (`useCanLearn`), learning isn't offered, though
items already held stay readable and removable, because they are still sent.

### Written for you

On the reveal, and no other overview, How to apply carries Written for you / For anyone (141o), so
the reader sees what their sentence bought on their own video. For anyone is the same section's
prompt with no reader, written from the finished note with no transcript, once. It runs as the
reveal opens, on the key that made the overview if that's the reader's own, otherwise through
`POST /api/generations/how-to-apply`, free and sharing the profile pass's daily limit.

It's kept in the reveal's device-local state (`nextStepsStorage.ts`), so a reload doesn't pay
twice. While it's written the option spins and can't be chosen. If it fails the control goes, for
good, and the section reads as it always has. It's hidden too with nothing known about the reader,
or a note with no How to apply. The narration reads the note as written whichever side shows: For
anyone stands in for the lines on the page without moving them in the list the voice follows.

### The old line

`Settings.readerContext` used to be the line itself. Migration 3 turns it into an entry under
"What you spend your time on", where it can be seen and edited, and may exceed 120 characters
until the reader changes it. An older client can't read the parts, so the composed sentence is
still written to `readerContext` (`aboutYouPatch`) until the write floor passes client 10, as
`record-migrations.md` says of a rename. Generation never reads it. An older client writing the
line onto an empty sentence is taken up by the migration; a filled sentence is left alone.

## Settings › Personalisation

The section sits after Narration voice (`settings.md`) and is shown on every surface,
because every surface makes overviews. Its row leads with the first filled section, then says
how many sections are on: "A dad · Every section", "About you not set · 3 of 4 sections", or
"Summary and key points only" with all four off.

It has one switch per optional section, named as the reader sees the section on a note
("Verdict", "What it sells", "How to apply", "Watch it anyway?"), each with a line on what
it holds. A switch takes effect from the next overview. Overviews already made keep the
sections they have; nothing is regenerated.

A section switched off is **left out of the prompt**, not written and then hidden, so the
model spends nothing on it and the record holds `null` there, as a thin note's verdict does.
The library and reader already treat a missing section as absent. Turning the verdict off
also leaves those notes out of the novelty and dubious filters, since they have no verdict
to filter on.

This differs from the shared note in `docs/architecture/cost-model.md`, which writes every
section whatever the reader has switched off and hides the ones they don't want. That design
isn't built. When it is, a reader's switches decide what is shown rather than what is
written.

## Analytics

`settings.personalisation.sectionSwitched` with the section and whether it is now on, and
`settings.personalisation.aboutYouSaved` with whether it is now set. Onboarding counts the
entries in each section and how many were typed. The text is never logged.
