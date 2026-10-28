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

## Reader context has no field yet

Nothing in the apps writes `readerContext`, so it is `null` for every reader today and the
prompt leaves the line out. How to ask for it isn't settled: a free-text "About you" field,
picking from choices, a few guided questions, or inferring it from the library for readers
who skip it. That choice is made with onboarding. Wherever it is asked, say that on us it
goes through our server to OpenAI, as the Only ever use my key switch already does.

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

`settings.personalisation.sectionSwitched` with the section and whether it is now on. The
reader context's text is never logged.
