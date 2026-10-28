# Personalisation: what an overview is made for

Card: OV-46 (the first of its stacked PRs). Onboarding comes later on the same card.

Two settings shape an overview before it is made, and both are now sent with every run,
on the reader's key and on us alike (`runOverviewGeneration` reads them from Settings):

- **`readerContext`**, a line about the reader. The prompt gives it to how to apply only
  ("About the reader, for fit: …", `howToApplySection.ts`), so the steps fit the person
  reading. How to apply may go beyond what the video spells out as long as it sensibly
  applies it, and a context is what makes those steps fit.
- **`sectionsEnabled`**, which of the four optional sections the overview has: the verdict,
  what it sells, how to apply, and watch it anyway. The premise, key points, chapters and
  filing are always written.

Both are settings, so they sync and follow the reader to every device.

## About you

The reader context is asked as **About you**: in onboarding (`onboarding.md`, design 46f),
and above the section switches in Settings › Personalisation (46s). Both use the same
chips: one thing the reader does and up to two things to get better at, which build a line
("Works in healthcare, learning about cooking."), or their own words, at most 140
characters (`settings/util/aboutYou.ts`). The line is what is saved and sent; the chips are
not kept. Both places say that on us it goes through our server to OpenAI with each
overview.

In Settings it reads "Not set, so overviews are written for anyone." or the line, with Set
up or Edit. Editing opens the chips and the line in place; Done saves, Clear sets it back to
none.

## Settings › Personalisation

The section sits after Narration voice (`settings.md`) and is shown on every surface,
because every surface makes overviews. Its row says how many sections are on: "Every
section", "3 of 4 sections", or "Summary and key points only" with all four off.

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
`settings.personalisation.aboutYouSaved` with whether it is now set. The reader context's
text is never logged.
