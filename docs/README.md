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
- `tts-pre-rendered-speech.md` — a designed and measured feature that was not built.

## `reference/` — external background material, not all of it specific to this repo

Brought in from elsewhere rather than written for this project. Read each file's
own framing before treating it as a rule: some is generic and immediately
usable (`accessibility-checklist.md`, everything under `ai/`), and where a file
under `coding-conventions/` conflicted with a decision already made here
(state management, file layout), it's been trimmed to only what's still
relevant and points back to the doc that actually governs this repo.
