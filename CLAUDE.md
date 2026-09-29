# Video Digest

Read `README.md` first for what this is and why it exists. This file explains what you are looking at and how to treat each part of it.

## What this repository currently contains

A **prototype's evidence**, not a codebase. The working version was built inside Claude Cowork over roughly a week and used daily by one person on around 30 real videos. Nothing here is production code, and most of it should not be ported directly.

```
README.md                    the concept, the note format, the design principles
docs/prototype/               retrospective evidence from the original build
docs/architecture/            the real build's system-level architecture
docs/conventions/              how code gets written, day to day
docs/features/                 feature-specific design, one file per feature
docs/reference/                external background material — not all of it applies here
prototype/summary-prompt.md  the note template. This IS the product logic.
prototype/digest_note.py     markdown note -> the record the UI renders and speaks
prototype/build_index.py     the prototype's build step
prototype/index_template.html the UI, including all styling
prototype/tokens.css         the design tokens, extracted
samples/notes/*.md           five real notes, unedited
samples/records/*.json       the same notes parsed into records
```

`docs/README.md` is the full index of every doc, folder by folder — read it for what's
in each one.

## How to treat each part

**`prototype/summary-prompt.md` is the product.** Everything else is delivery. It defines what a note contains, how blunt the verdict has to be, and the rule that "watch it anyway" defaults to no. It is plain text with no dependencies and should survive the rewrite essentially intact. If you change it, change it deliberately, and read `docs/prototype/decisions.md` first: most of its oddities are the result of something going wrong.

**`prototype/index_template.html` is the design reference.** The visual language, the card, the read-along, the filter panel and the palette are all worth keeping. The implementation is a single file of vanilla JS with the data injected at build time, which is a scaffold, not an architecture. Take the design, rebuild the code.

**`prototype/digest_note.py` contains genuinely reusable logic**, specifically the parsing and the sentence-safe chunking of the spoken script. Port the logic, not the file.

**`prototype/build_index.py` is scaffolding.** It exists because the prototype had no database. Do not port it.

**`samples/` is real content, not fixtures.** Build against it. It shows the actual variance: notes whose actions are numbered and notes whose actions use dashes, verdict reasoning that begins with the verdict word and breaks the parser, and a topic and verdict spread that is more lopsided than you would invent.

## What the prototype faked, and what a real build needs

| Prototype | Because | A real build wants |
|---|---|---|
| Notes as markdown in Google Drive | no database, and hand-editable | a database, with markdown kept as an export |
| A scheduled-task prompt as the pipeline | no job runner | a real queue with retries and idempotency |
| Page data injected at build time, then a document store | no backend | an API |
| Audio and files as base64 in documents | no object storage | object storage |
| Read and favourite in separate collections | the note document is replaced wholesale on every update, which would wipe flags stored on it | user state in its own table regardless |

The last row is a real design lesson rather than a workaround, and is explained in `docs/prototype/decisions.md`.

## Working style that suited this project

Three habits earned their keep and are worth continuing:

1. **Verify before reporting.** The prototype once logged a successful publish it had never checked, and the library silently sat eleven notes behind for days. Anything that claims success should have looked.
2. **Never let a model count, measure or time anything.** See `docs/prototype/constraints.md`. This produced the single worst bug of the project.
3. **Degrade visibly.** Every feature that depends on something optional hides itself when that thing is missing, rather than presenting a control that cannot work.

## Code conventions

- `docs/conventions/commenting.md` — near-zero comments. Code, tests, and specific
  docs carry meaning here, not inline comments.
- `docs/conventions/naming-conventions.md` — a file is named after its primary
  export, in that export's own casing.
- `docs/conventions/frontend-architecture-guide.md` and
  `docs/conventions/frontend-testing-guide.md` — the frontend's actual conventions,
  written for this project's real stack.

Read all four before adding a new file, folder, or pattern anywhere in the monorepo.

- `docs/conventions/secrets.md` — a secret value must never appear in this conversation.
  The repo holds references; `.env` is rendered and never read or printed whole. A hook
  refuses the calls that would, and says why.

## The backlog lives in Trello

The board is **The Overview Backlog** (https://trello.com/b/yArQIL27/the-overview-backlog),
reached through the Trello connector when it is attached, and by hand when it is not: the
connector is optional, so check for it before promising a card. Its lists, in order: **Backlog** (ordered do-it-next,
top first), **Sprint Backlog**, **In Progress**, **Done**. New cards start from the
**Card template** card, which is a Trello template: its sections are Context, Requirement,
Technical notes, Analytics & logging, Testing considerations, Accessibility,
UX changes / designs, Definition of done, Other open questions. Leave out a section that
has nothing to say. Label each card by area.

**Every card is `OV-n`**, where `n` is Trello's own card number on the board: the `5` in
`trello.com/c/jzBBw0A9/5-…`. Card titles start with it (`OV-5: Transcripts sometimes
missing…`). Trello assigns the number when the card is created, so create the card first,
then rename it with the number the result's URL shows.

Keep the board true as you work:

1. **Starting a card:** move it to **In Progress**, and name the branch `ov-n-short-slug`.
2. **Opening a PR:** start the title with `OV-n:`, put the card's link in the
   description, and comment the PR's link on the card.
3. **Finding new work** (a bug, a gap, a follow-up out of scope): create a card in
   **Backlog** from the template, give it its `OV-n`, place it by priority, and tell the
   user you did.
4. **Never move a card to Done yourself.** `.github/workflows/trello.yml` does it
   when the PR merges, for every `OV-n` or card link in the PR's title, description or
   branch (`scripts/moveCardsToDone.mjs`), and it only reports a card as moved once it
   reads back in Done. It needs the `TRELLO_API_KEY` and `TRELLO_TOKEN` repository
   secrets. Without them it warns on the run and moves nothing.

## Immediate suggestion

Do not start by porting code. Start by reading `README.md`, `docs/prototype/decisions.md` and `prototype/summary-prompt.md`, then propose an architecture and argue with the open questions in `docs/prototype/open-questions.md`. The verdict scale in particular is not settled, and 77% of the existing library falls into a single bucket.
