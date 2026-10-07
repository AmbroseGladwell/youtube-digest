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

## On the note: Related by tag (design 84a–84f)

The last section of the Overview tab, after What it's selling. The note's tags are its heading
row and each opens the library filtered to it; under them, the overviews that share the most
tags with this one, newest first among equals (`relatedByTag`), up to eight, three shown and
the rest behind `Show N more`, which keeps focus as it becomes `Show fewer`. Read ones stay in
the list with the library's read treatment: the picture at half strength, the title muted and
"Read" in words.

**Tags are words, not pills.** `#saas` in the stone label ink, semibold, underlined on hover.
Topic chips are filled pills and the library's main filter, so a tag never looks like one
except as the active filter's chip in the search field.

**With nothing related** the list and its button go and the label becomes "Tags"; the tags
stay, and still link. A note with no tags has no section at all.

**Where there is no library, tags are words.** In the side panel the tags are plain muted
text, since there is no library there to land in, and the related rows still open their
overview in the panel. The shared page shows the copy's tags the same way, under "Tags",
and never a related list: it is someone else's view of one overview.

A note's tags, here and when matching, are its own and the reader's `userTags` together
(`overviewTags`).

## Filtering the library by tag (design 84g–84i, 84o–84v)

Tags join Verdict under **More filters** in the rail, as rows like the topic rows, `#saas`
and its count, most used first and capped at six behind `Show all N`, with the active tag
always listed (`cappedTags`, as `cappedTopics`). A library with no tags has no Tags group at
all. Closed, the row's summary names the tag beside the verdict ("Any verdict · #saas"), and
wraps rather than being cut off.

**One tag at a time.** Picking another swaps it, and picking the active one clears it. The
filter is the URL's `tag` param, so a note's tag links to `Routes.taggedLibrary(tag)`, and
arriving that way opens More filters, so the tag is never set out of sight. A link names a
whole view, so it also shows read overviews, and that shows as its own chip.

A tag matches the note's own tags or the reader's `userTags`. An unreadable record never
matches one, as it never matches a topic. The tag is not part of the saved view
(`library-view.md`).

## The library's head and its chips (option C, 84o, 84r, 84v)

The first cut put the tag in the search field and the count line read "14 tagged
#founder-interview · 0m saved" beside the sort pill, which broke into three ragged lines on a
phone. Option C reorganised the head at every width:

- **Chips under the search** (`libraryFilterChips`, `LibraryFilterChips`), one for each
  filter changed from the view the library opens on, in the order tag, topic, verdict, show:
  `#founder-interview`, `Business`, `Fresh angle`, `Dubious only`, `Favourites`, and `Read and
  unread` or `Read` once Unread only is off. The default view has none, and the search is not
  one, because its own field shows it. Each × puts its own filter back to the default. The row
  never wraps: whole chips while they fit and a `+N` for the rest (`fittingChipCount`, measured
  from a hidden copy of the row), which opens the sheet on a narrow screen and moves focus to
  the rail on a wide one. With chips set the field's placeholder is "Search within these".
- **The count only counts.** With a tag set it reads "14 overviews · 14 unread", with "tagged
  #founder-interview" there for a screen reader alone, since the chip names it.
- **Below 992px** time saved sits on the title's baseline at the right, in a box as wide as its
  widest figure so the rolling digits move nothing, and the count has the line under it to
  itself. Sort is a 44px icon between the search and Filters; on any order but the newest it
  widens into a tinted pill with a short name ("Oldest", "A–Z"), the field's placeholder
  shortening to "Search overviews", and its name is always the whole order. There is no
  "Showing:" line and no Reset: the chips' × and the sheet's Clear all do that job. The filters
  are a bottom sheet (84i) from the button beside the search, which carries a dot only while the
  filters differ from the default and names how many ("Filters, 2 changed"); its foot is "Clear
  all" and "Show N overviews", and Verdict and Tags stay behind More filters in it.
- **On a wide screen** the sort pill stays by the title and the "Showing:" line and Reset stay;
  the chips sit under the search there too.

## The glide (84s, "OV-84 4 Chip Motion")

A filter or sort change is one movement (`useLibraryGlide`, `libraryTransitions.scss`): rows
that stay glide to their new places over 280ms, rows that go fade where they were in 120ms,
new ones fade in over 240ms after them, and the chip row opens or closes with them. Typing in
the search is not glided, and narrows the list in place.

It is a view transition, as `frontend-architecture-guide.md` 2.5 asks for a reorder, with two
wrinkles. Each row and the chip row get a view-transition name only for the length of the
transition, so a route transition still sees one pane; and the pane itself is not captured
while the library glides (`AppShell.module.scss`), so the rows are captured one by one and the
rest of the page stays live. Scrolled down into the list, the change lands at once and the page
goes back to the top, rather than animating rows nobody can see. A change made mid-glide skips
the first one to its end and glides from there.

On a phone the change usually comes from the open sheet, and the snapshots paint in the
browser's top layer, above any z-index the page gives the sheet: left alone, the rows glide
over it. So while the glide runs the open sheet and its scrim are captured too
(`LibraryPage.module.scss`), and `libraryTransitions.scss` stacks their snapshots back above
the rows, the way `paneTransitions.scss` does for the masthead.

**Where the build departs from the motion file.** New rows fade in together rather than 40ms
apart, which a view transition cannot stagger without a name per position. Under reduced motion
the change is instant, with no crossfade. The sort menu closes at once rather than fading out
first, and the field's placeholder swaps rather than crossfading. The time-saved figure stays
beside the count on a wide screen, which 84g leaves out.

## Manage tags: merge, rename, delete (design 84j–84n)

`Manage tags` sits at the foot of the rail's Tags group, and hides with it when there are no
tags. It opens one dialog, a sheet on a phone: every tag with how many overviews use it, most
used first or A–Z, a `Find a tag` field, and a checkbox per row. The action bar says what to do
until something is selected, then offers `Rename` for one tag or `Merge…` for several, with
`Delete` and `Clear`.

- **Merge…** asks which name to keep, most used first and already chosen, or a new one, and
  says how many overviews will carry the kept name.
- **Rename** turns the row into a field that normalises as you type ("Saves as
  #micro-saas-tools"), refuses a name with no letters or numbers, and says so when the name is
  taken, where saving becomes a merge.
- **Delete** takes the tag off every overview and blocks it, as a merge alias to nothing, so a
  later overview cannot bring the word back. That was the design's open question; blocking is
  its own proposal, and Undo is the way back.

**No confirm step.** Every change lands at once (`planTagEdit`, then `useEditTagsMutation`,
painted optimistically) and a notice at the top offers Undo until the dialog closes. Undo writes
back exactly what each overview and the aliases held before, rather than running an inverse
edit, so it is right even when a merge folded two tags on one overview into one. It undoes the
last change; an earlier one is undone the way it was made.

Escape steps back out of a rename or the merge step before it closes the dialog.

**Where the build departs from the design.** The notice says where the tag now is ("Merged 3
tags into #saas, now on 18 overviews") rather than "18 overviews updated", because only the
overviews that carried a merged-away name were rewritten and the two numbers differ. The bar's
one-tag state, with `Rename` in place of `Merge…`, is not drawn and follows 84l's text. The
merge step names how many other names become aliases in figures.

## Counting

`library.manageTags` counts opening and closing, merges, renames, deletes and undo, by how
many tags and overviews, never which. `reader.relatedByTag.tagFollowed`, `overviewOpened` (with how many tags the two share) and
`moreShown`, and `library.filters.tagChosen` and `tagCleared` (with a chip's × as `filterChip`) count the filter by where it was set from, never
which tag: a tag is the reader's own word, and an event may not carry one
(`docs/architecture/analytics.md`). `capture.newOverview.finished` carries `tagsReused` and `tagsAdded`: how many of the new note's
tags were already in the library when the run read it. The MCP connector gains `list_tags`
(`mcp-connector.md`).
