# Commenting: near-zero

Code, tests, and specific documentation files carry meaning here — not inline
comments. Before writing one, do one of these instead:

- **Name it so the comment is unnecessary.** A variable, function, or type name
  that states the "what" removes the need to restate it next to it.
- **Extract it, and name the extraction.** A block that needs a comment to say
  what it does is a small `const` function whose name says it, called from where
  the block was. A magic value is a named `const`.
- **Encode the "why" in a test.** A test that fails when an invariant breaks is
  stronger than a comment asserting the invariant holds — the comment can go
  stale silently, the test can't.
- **Put the reasoning in a doc, and reference it by name.** Design decisions
  belong in a file like `docs/features/overview-generation-decisions.md`, not
  restated across every function that implements them. A short pointer is the
  outer limit, not a paragraph.

A comment is the last resort, for the rare case where none of the above can
carry the information — typically a genuinely surprising workaround (a browser
bug, a spec quirk) with no other home. If you're about to write more than one
line explaining *why*, that reasoning belongs in a doc instead.

The linter holds the line: `overview/no-long-comment` refuses a comment of more than
one line, and any TODO or FIXME, everywhere (`lint-and-format.md`). Stylesheets are held to the same by `scripts/checkStyleComments.mjs`, and an unexplained value there is a named Sass variable rather than a comment.

A one-line comment that restates the code next to it goes too: `// Save the
record` above `saveRecord(record)` says nothing the code doesn't (OV-377).

## How this relates to `docs/reference/coding-conventions/commenting.md`

That file is a general baseline, brought in from elsewhere: don't restate a
signature, prefer self-documenting names, explain *why* not *what*, no
TODO/FIXME. All of that still holds here. This project goes a step further: even
a legitimate, well-written *why* comment gets moved to a doc once it's more than
one line, rather than staying in the code as a comment. The baseline says a good
*why* comment is fine; this project's rule is that it's fine as a last resort,
not as the default place for it to live.
