# Docs

Five folders, five different questions.

## `prototype/` — why the original build is the way it is

- `decisions.md` — why the product and the pipeline work the way they do. Read this before changing anything.
- `constraints.md` — what was hit and what it cost. The first half outlives the prototype; the second half is environment-specific.
- `open-questions.md` — unresolved, with the evidence attached.

## `architecture/` — the real build's system-level architecture

- `architecture-options.md` — the models considered for a real build, and the trade-offs between them.
- `v1-architecture-decisions.md` — what was actually decided: the free/paid split, the stack, hosting, data layer, and the monorepo layout.

## `conventions/` — how code gets written here, day to day

- `frontend-architecture-guide.md` — routing, state, and query conventions for the frontend, written for this project's real stack.
- `frontend-testing-guide.md` — the testing conventions built on top of that stack.
- `naming-conventions.md` — file and folder naming, authoritative for this repo.
- `commenting.md` — near-zero comments, and how that differs from the general baseline in `reference/`.

## `features/` — feature-specific design, one file per feature

- `overview-generation-decisions.md` — the overview format's prompt composability, verdict-scale, novelty-retrieval, and topic decisions, with the reasoning.
- `overview-redesign.md` — what the editorial redesign changed, what it deliberately left out, and where the build departs from the design file.
- `chapters.md` — the reader's third tab: chapters as a structural prompt section timed
  from the transcript, why the model names a segment and never a time, what a range does
  on each surface, and how a chapter opens the transcript at its start.
- `capture-reason.md` — the optional "why you saved it": asked for while the overview is
  being made rather than before, read back as one line above the premise, edited in place
  from the ⋯ menu, and why the prompt never sees it.
- `error-state.md` — design turn 19's one dead-end screen: the six cases it serves, why the
  way out is the caller's to name rather than a fixed pair, and where the build departs from
  the design file.
- `extension-panel.md` — why the side panel is one video rather than a small library:
  the layout seam, its three screens, and what it drops.
- `following-playback.md` — how the transcript follows the video, what now touches the
  YouTube page and how little, and why the follow scroll is the one movement that isn't
  eased.
- `injected-button.md` — the Overview button in YouTube's own action row: why it wears
  their pill, where each of its four states gets its facts, and the three-document
  conversation behind it.
- `plus-upsell.md` — the three places Plus is sold, why the plan is a local placeholder,
  and why Settings has no upgrade button.
- `reading-position.md` — the transcript tab opening where you had got to, per video:
  why it remembers a block's time rather than a scroll offset, why it lives in
  `localStorage`, and how a restored position takes precedence over the player.
- `record-migrations.md` — the versioned-record design that replaces reading stored records
  unvalidated: two version numbers doing two jobs, why migration happens on read rather than
  in the upgrade transaction, and why an unreadable record is quarantined rather than dropped.
  Built, apart from the screens that need a server to fire them.
- `sync-metadata.md` — the one field every synced record carries so that it can say when it
  last changed: why a date is insurance rather than mechanism, why it is the only piece that
  cannot be backfilled, which three numbers a synced record ends up carrying and which of them
  the server owns, and why transcripts are the store that gets none.
- `topic-filing.md` — how topics get made and assigned: the rail's New topic modal, and the
  single overview's topic editor.
- `transcript-retrieval.md` — why retrieval is a ladder of sources rather than a provider,
  what each rung costs, how a failure decides whether the next one is worth asking, and
  what `generated` actually means.
- `transcript-storage.md` — why a transcript is keyed by video rather than by note, how its
  captions are merged into readable blocks, and what the reader's tab does with the timings.
- `tts-pre-rendered-speech.md` — a designed and measured feature that was not built.
- `watching-detection.md` — how the side panel learns which video is in front of it, why it
  offers that link rather than filling it in over the top of yours, and where the line
  between fetching captions automatically and writing an overview on request sits.

## `reference/` — external background material, not all of it specific to this repo

Brought in from elsewhere rather than written for this project. Read each file's
own framing before treating it as a rule: some is generic and immediately
usable (`accessibility-checklist.md`, everything under `ai/`), and where a file
under `coding-conventions/` conflicted with a decision already made here
(state management, file layout), it's been trimmed to only what's still
relevant and points back to the doc that actually governs this repo.
