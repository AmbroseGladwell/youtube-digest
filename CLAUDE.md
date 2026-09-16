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

## Immediate suggestion

Do not start by porting code. Start by reading `README.md`, `docs/prototype/decisions.md` and `prototype/summary-prompt.md`, then propose an architecture and argue with the open questions in `docs/prototype/open-questions.md`. The verdict scale in particular is not settled, and 77% of the existing library falls into a single bucket.
