# Library sort

The library sorts by one field, in one direction, optionally grouped (OV-401,
https://trello.com/c/oAC77Gha). The sort menu and the group headings are OV-399's screens
(design 399p); until they're built, `SortPill` still offers its three orders (newest saved,
oldest saved, title A–Z) as presets, and every other sort can be reached by link.

## Fields

| Field | Sorts by | Default direction |
|---|---|---|
| `added` (default) | `savedAt` | newest first |
| `published` | the source's `publishedAt` | newest first |
| `updated` | see "Updated" below | newest first |
| `title` | the title, ignoring case and a leading "The", numbers in numeric order | A–Z |

Either direction works for every field. Ties fall back to newest saved first.

**Verdict is a filter, not an order.** 77% of the library sits in one novelty bucket
(`docs/prototype/open-questions.md`), so ordering by it would give one long block.

## Updated

Updated is the latest of:

- when the overview was saved,
- `Overview.editedAt`: the reader's last change to its topics, tags or reason,
- when the reader or a connected assistant put it in a project (`ProjectMember.addedAt`,
  not filing as it was made), and
- the last message in a chat about that overview (not a library or project chat that cited it).

It never moves for the app's own writes: a sync, a migration, a regenerated record, a fold of
duplicates, or the stored `updatedAt`. Read and favourite don't move it either (owner, 24 Nov
2026).

**How editedAt is kept.** The store's `setOverviewTopics`, `setOverviewTags` and
`setOverviewCaptureReason` are only called for the reader's own edits; each stamps
`editedAt` and journals its change with `edited: true`. The push sends `edited: true`, and the
server's field routes then set `editedAt` to the write's `updatedAt`, so every device agrees.
The fold of duplicate overviews journals the same ops without the flag, so it doesn't count.
A record from before has no `editedAt` and falls back to when it was saved. `editedAt` is
private: a shared copy leaves it out (`sharing.md`).

**Project and chat times** come from `useLibraryActivity`, which reads project memberships and
every chat only while the list (or the reader stepping through it) sorts by Updated. Taking an
overview out of a project doesn't move it, because `listMembers` only keeps memberships that
stand. The design also counts editing "a project's note on it"; no such note exists yet.

## Group by

None (the default), Day, Week or Month for a date field; None or Letter for Title, from
`libraryGroups` with the device's clock and time zone:

- **Day:** Today, Yesterday, the weekday this week, then the date (Friday 21 Nov).
- **Week:** This week, Last week, then Week of 3 Nov. The week starts where the locale says
  (`Intl.Locale` week info), Monday where the browser can't say.
- **Month:** This month, then each month.
- **Letter:** A to Z, skipping a leading "The"; anything else under #.

Each date carries its year once it isn't this year (March 2019). A record with no date for the
field goes under **No date**, last whichever way the list runs.

## A record that can't claim a position sorts last

`orderLibraryEntries` follows the rule `record-migrations.md` set for dates ("Ordering needs a
date"). An unreadable record sorts by what salvage recovered: its salvaged `savedAt` for Added
and Updated, nothing for Published, and its salvaged title for Title. Where that field is
missing, it goes last whichever way the list runs.

## In the URL

`?sort=published&dir=asc&group=month`, parsed by `parseLibrarySort` and written by
`applyLibrarySort` in `libraryFilterParams`. Only what differs from the default is written: no
`sort` for Added, no `dir` for a field's own default direction, no `group` for None. A grouping
that doesn't fit the field reads as None. An old `?sort=oldest` reads as Added, oldest first,
and `?sort=title` as Title A–Z.

The sort is saved with the filters (`library-view.md`). The saved view still reads a sort
saved by its old name. One sort is shared by the library, a project's page and a source's page.
Unlike the filters, it:

- is **not in `LibraryFilters`**, so "Show all" keeps it, and
- produces **no applied-filter chip**, because it doesn't hide anything. The line over the
  list names it, and Reset puts it back to Added, newest first.

Sorting runs after filtering and search. The search's "Said in the transcripts" and "Close in
meaning" groups aren't sorted or grouped. The reader's Previous and Next follow the sort and
the filters when it was opened from the list (`library-view.md`).

## Analytics

`library.sortPill.opened`, and `library.sortPill.orderChosen({ field, direction, group })`.
