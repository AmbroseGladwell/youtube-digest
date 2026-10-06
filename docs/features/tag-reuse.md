# Tag reuse: one vocabulary per library

Each note was tagged on its own, with no sight of the reader's other tags, so the same subject
came out three ways: the first batch of founder interviews carries `saas`, `micro-saas` and
`ai-saas`. Tags could not link overviews while that was true, and linking them is the point
(OV-84). This reverses the earlier decision that tags were a scanning aid needing no
consistency (`overview-generation-decisions.md`, "Topics and Tags stay separate").

## The model is offered the reader's tags

Generation is given every tag in the library, counted, and the prompt lists the 60 most used
with an instruction to reuse one wherever it fits, spelled as listed, and to add a new one only
when nothing covers the subject. A reader with no tags is told so rather than offered an empty
list.

**Why 60, by count.** Every listed tag is sent with every overview, at about three tokens a
tag, so 60 is roughly 200 tokens on a request that is tens of thousands. Count rather than
recency because the tags worth converging on are the established ones; a tag used once last
week is the likeliest near-duplicate. `TAG_VOCABULARY_CAP` in `filingSection.ts` is the one
place the number lives.

## Normalising is code's job, not the model's

`resolveTags` (`packages/domain`) runs on every generated tag before the note is saved:

1. **Spelling.** Lowercase, accents dropped, every run of anything else a hyphen
   (`normaliseTag`). The same function turns what the reader types into a tag.
2. **Singular and plural fold only onto a tag that exists.** `startups` becomes `startup` if the
   library has `startup`, and the other way round. A blanket rule was rejected: stripping an
   `s` turns `news` into `new` and `analytics` into `analytic`, and nothing in a word says which
   kind it is. The cost is that a fold can still happen onto a real tag that only looks like
   the other number of the new one; with the library's own tags as the only candidates that is
   rare, and a merge undoes it.
3. **Aliases.** A tag the reader has merged away becomes the one it was merged into; a tag they
   deleted is dropped. So the model can propose a tag the reader got rid of, and it does not
   come back.
4. **Repeats are dropped**, and the list is held to six.

Generation's own schema still asks for three to six tags. A stored note may hold fewer, because
merging two tags a note both carries, or deleting one, takes it below three. That widening is
overview schema version 8, a no-op migration: it moves the number so an older client treats such
a note as newer than it rather than quarantining it as broken (`record-migrations.md`).

## Aliases live in Settings

`Settings.tagAliases` maps a merged or renamed tag to its new name, and a deleted one to null.
Settings is already the account's one synced singleton, so the vocabulary is per account, as
libraries are (`account-libraries.md`), with no new record kind.

**Replaced whole, unlike `milestones`.** Settings merges `sectionsEnabled` and `milestones` one
level deep so that two devices editing different keys do not undo each other. Aliases are
replaced whole instead, because Undo has to take an alias away again and a one-level merge can
only add or change keys. With one reader, two devices merging tags at the same moment is not a
real risk; if it becomes one, this is the field to revisit.

**One step deep.** `withTagAlias` repoints everything that pointed at a tag when that tag is
itself merged, and drops an alias whose name comes back into use, so resolving a tag is always a
single lookup and a rename back and forth cannot make a loop.

## Merge and rename rewrite the notes

A merge, rename or delete rewrites the tags on every note that carries them, through
`setOverviewTags`: a field write like `setOverviewTopics`, journalled as `{ op: "tags" }` and sent
to `PUT /overviews/:id/tags`, so it travels through sync like any other edit and a pull does not
undo it (`sync-client.md`). The alternative, leaving notes alone and resolving aliases whenever a
tag is shown, was rejected: every surface that reads a tag, the MCP tools and a shared copy
included, would have to know about aliases.

## Re-tagging the library that came before

`scripts/retagLibrary.ts` re-tags an account's existing notes once, through the API and on the
reader's own Anthropic key. It reads the library through `/changes`, then tags each note oldest
first from its own words, offering it the tags the notes before it ended up with, so the
library converges the way new generation will. It prints every note's old and new tags and the
resulting vocabulary, and writes nothing without `--write`; with it, each changed note goes
through `PUT /overviews/:id/tags` and the script reads the library back and fails if a note did
not land.

```
OVERVIEW_API_URL=https://… OVERVIEW_TOKEN=<session> task secrets:run -- npx tsx scripts/retagLibrary.ts
```

`OVERVIEW_TOKEN` is a session for the account, minted with `npm run mint-session` against that
environment's database (`docs/architecture/api.md`).

## Counting

`capture.newOverview.finished` carries `tagsReused` and `tagsAdded`: how many of the new note's
tags were already in the library when the run read it. The MCP connector gains `list_tags`
(`mcp-connector.md`).
