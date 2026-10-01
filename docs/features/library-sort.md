# Library sort

The sort pill in the library's head (design 2a) was placed before there was anything to
sort by (`stone-theme.md`, "Placed but not wired"). It now opens a menu with three orders.

## Three orders, and why not verdict

| Order | Label | Key |
|---|---|---|
| `newest` (default) | Newest saved first | `savedAt`, descending |
| `oldest` | Oldest saved first | `savedAt`, ascending |
| `title` | Title A–Z | video title, ignoring case, numbers in numeric order; ties newest first |

**Verdict is a filter, not an order.** 77% of the library sits in one novelty bucket
(`docs/prototype/open-questions.md`), so ordering by it would give one long block, and the
filter rail already narrows by novelty. If the verdict scale changes, this could be
revisited.

## A record that can't claim a position sorts last

`orderLibraryEntries` follows the rule `record-migrations.md` set for dates ("Ordering
needs a date"). An unreadable record, whether salvaged or held back, sorts by whatever
salvage recovered: its salvaged `savedAt` for the date orders and its salvaged title for
title order. Where that field is missing, it goes last whichever way the list runs, so
"oldest first" doesn't turn a lost date into the oldest note.

## It lives in the URL, but it isn't a filter

The order is `?sort=oldest` or `?sort=title` next to the filter params, parsed by
`parseLibrarySort` and written by `applyLibrarySort` in `libraryFilterParams`. The default
writes no param. So it survives a reload and browser Back, and resets when the library is
opened fresh. Unlike the filters, it:

- is **not in `LibraryFilters`**, so the filter sheet's "Clear all" keeps it, and
- produces **no applied-filter chip**, because it doesn't hide anything.

Sorting runs after filtering and search, so the order always applies to what's showing.

## What does not follow the sort

- **The reader's Previous/Next** still walks the whole library newest first
  (`orderLibraryEntriesBySavedAt`), and so does `overviewForVideoUrl`'s "newest note
  wins". The reader doesn't know which list it was opened from. Its filters were never
  carried either, and its "All overviews" link goes to `Routes.home()` with no params.
  OV-38 covers both.
- **Which order people pick is not counted.** There is an event layer now
  (`docs/architecture/analytics.md`); counting it is a catalogue entry and one call.

## The menu

`SortPill` is a menu button (`aria-haspopup="menu"`, `aria-expanded`) whose accessible
name is `Sort: <current order>`. It uses the same visual shell as the reader's ⋯ menu.
The options are `menuitemradio` with `aria-checked`, and the current one also shows a
check. On opening, focus goes to the checked option. Arrow keys wrap, Home and End jump,
Escape and choosing an option return focus to the pill, and Tab closes the menu.
`librarySort.iwft.ts` covers the orders, the unreadable records, the filters, Back, and
the keyboard.
