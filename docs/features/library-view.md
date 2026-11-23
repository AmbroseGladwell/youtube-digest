# Library view

OV-82. The list opens on **Unread** for a reader with no saved choice, and otherwise as
they last left it: filters and sort, per account, per device.

## Where it lives

The URL holds the view, as before. `useLibraryView` restores it when the list is opened
with none of its params (`topic`, `verdict`, `status`, `fav`, `dubious`, `tag`, `q`, `sort`).
It uses the view saved for this account, or `DEFAULT_LIBRARY_VIEW` (unread, newest first).
A link that names a view wins and is not saved. Only a change the reader makes is saved.

`libraryViewStorage` keeps one value per account in `localStorage`
(`overview.libraryView.<accountId|noAccount>`), with a `version`. It is never synced, and
each origin keeps its own copy, so the web app and the extension don't share one. The
search query is never kept, and nor is a tag: like the search, it is a place the reader
went to rather than how they like the list (`tag-reuse.md`). On restore, a value that no longer parses is dropped
field by field, and so is a topic that no longer exists, and the cleaned view is saved
back. Storage that is refused or corrupt reads as nothing saved. Switching account
restores that account's view.

## Search

OV-292. The field's words lead and the URL follows. `LibrarySearch` keeps what is typed and
hands each change to the page as a React transition, so a key is never held up by the list
re-rendering. The page writes `q` once typing has paused for 300ms. Clearing it writes at
once. Before this, every key wrote `q` built from the last render's params. Keys arriving
faster than a render overwrote each other, so "kitchen" typed with no gap became "n". Any
other change to the view (a chip, Reset, sort) is built from the words in the field, not
from the URL, so a query that hasn't reached the URL yet isn't lost. A `q` that changes
without the page writing it (a link) replaces the field's words. The match reads each
overview's search text from a cache keyed on the record (`searchHaystackOf`), so typing
doesn't rebuild every overview's text on every key.

On a phone, opening and closing the search re-renders only `LibrarySearch`, not the page.
The pill's width changes at once, and a `clip-path` animates the growth from the icon's
circle, so no frame of the animation lays out the row again. Closing keeps the wide box
until the clip has folded, then narrows it.

## Show all, Reset, caught up

On a wide screen a line over the list states the view in text ("Showing: Unread · Newest
saved first"), with **Reset** (back to the default view) and **Show all** (every filter off,
order kept). Below 992px that line is gone: the chips under the search and the sheet's Clear
all do its job (`tag-reuse.md`).
The sheet's old "Clear all" is now "Show all". With Unread on and nothing unread, the list
says "You're all caught up" and offers "Show all overviews". A brand-new library still
gets the first-run hero.

A row marked read or favourited from the list stays in place until the view changes,
rather than vanishing from under the pointer.

## The reader steps through it

The list hands its view to the reader in history state (`libraryViewState`), with the rows
it was keeping in place. Previous and Next walk that filtered, sorted list and carry the
state forward, adding each overview they leave. So the open overview, and every one already
stepped past, stays in the sequence after it stops matching: read your way through the
unread list and Previous still goes back. Opened any other way, the reader walks the whole
library newest first, as before.

Read state is only ever set by the reader (masthead, menu, or finishing narration), never
by opening a note, so the default view does not hide a note the moment it is opened.

## What is counted

Reset (`library.view.reset`) and the caught-up list's way out (`library.caughtUp.allShown`)
are events, and every filter they change is counted with `from: "reset"` or
`from: "caughtUp"`, beside the existing chip, panel and Show all changes. The default view
being applied, and a saved value being dropped, are the app acting rather than the reader,
so they are not events (`docs/architecture/analytics.md`, "Actions, not logs"). The client
has no log line to put them in yet.

## What kind each row is

OV-232, design 232a–232k. Every row says what it is, in words, never by an icon alone.

- **The meta line always names the kind**: "18:42 video", "14 min article", "1 hr 5 min recipe",
  or a bare "Video" when a video has no stored duration. The length is dropped rather than guessed;
  the kind never is (`sourceLength` in `sourceFacts.ts`).
- **Every kind but a video also leads its kicker with a chip** (`KindChip`, from `kindChip`):
  "Article", "Recipe · 4 servings", and a recipe video's "Recipe · 6 servings". A video is most of
  the library, so its row keeps the kicker it had. The chip is a quiet outline in `--muted`, lighter
  than the verdict's filled pill, so the eye finds the title and verdict first.
- **The kicker is two groups**: what it is (kind, topic, verdict or "Thin"), then its warnings
  (Dubious claim, the selling note). On a phone a group moves to the next line whole rather than
  breaking mid-phrase. Nothing shortens or drops.
- **Recent overviews** on the capture page lead each row with the same chip. The reader masthead,
  the shared page and the link preview already name the kind in words, so they have no chip.
- **A new kind** is one word in `SOURCE_KIND` and one row in the source filter; it gets the chip
  because it isn't a video.

## At scale

OV-165 and OV-381 measured the library at 300, 500, 2,000 and 5,000 overviews (22 Nov 2026).
`npm run perf:library --workspace packages/app-core` repeats it: `playwright/perf/libraryScale.perf.ts`
seeds a synced library, then times what a reader does with it. It is not in CI. Run it on a quiet
machine, one run at a time. `SIZES`, `WIDTH` and `THROTTLE` change what it measures. The browser
does every measurement (`docs/prototype/constraints.md`): a view transition counts from the tap to
its `ready`, and a search or filter from the slowest Event Timing entry.

Before virtualising, at phone width (390 px) with the CPU slowed 4×. The default view hides read
overviews, so the list shows half of them.

| Overviews | Rows shown | DOM nodes | JS heap | First row | Ask, and back | Overview, and Back | Search (worst key) | Unread filter (glide ready) |
|---|---|---|---|---|---|---|---|---|
| 300 | 150 | 5,900 | 21 MB | 1.2 s | 156 / 176 ms | 184 / 254 ms | 24 ms | 0.7 s |
| 500 | 250 | 9,600 | 25 MB | 1.3 s | 202 / 248 ms | 252 / 293 ms | 48 ms | 1.1 s |
| 2,000 | 1,000 | 37,000 | 92 MB | 3.2 s | 903 / 1,213 ms | 1.1 / 1.7 s | 104 ms | 8.2 s |
| 5,000 | 2,500 | 93,000 | 212 MB | 8.1 s | 2.8 / 2.1 s | skipped; scroll lost | 248 ms | 82 s |

Every cost but search grows with the rows in the page, about 37 DOM nodes a row:

- **A page transition waits on the whole list.** When a view transition starts, Chrome restyles
  every element in the page before taking the old snapshot. Coming back, React renders every row,
  and the browser styles, lays out and paints them, before the new one.
- **The filter glide names every row** (`useLibraryGlide`), and a view transition's cost grows
  with its names, so one tap of a filter freezes the page for seconds past a thousand rows.
- **Scroll comes back** below about 2,500 rows. At 5,000 the Back transition was skipped and the
  library returned to the top.
- Scrolling itself stayed smooth at every size.

### Only the rows near the screen are in the page

So the library list is virtualised (`LibraryList`, `@tanstack/react-virtual` on the window's
scroll; the owner's choice over loading more as the reader scrolls, 22 Nov 2026). After, same
machine and settings:

| Overviews | Rows in the page | DOM nodes | JS heap | First row | Ask, and back | Overview, and Back | Search (worst key) | Unread filter (glide ready) |
|---|---|---|---|---|---|---|---|---|
| 300 | 8 | 700 | 13 MB | 1.0 s | 81 / 72 ms | 79 / 85 ms | 16 ms | 88 ms |
| 500 | 8 | 700 | 19 MB | 0.7 s | 66 / 76 ms | 78 / 105 ms | 16 ms | 65 ms |
| 2,000 | 8 | 700 | 51 MB | 1.6 s | 86 / 97 ms | 71 / 134 ms | 24 ms | 91 ms |
| 5,000 | 8 | 1,700 | 105 MB | 5.6 s | 79 / 101 ms | 103 / 163 ms | 40 ms | 154 ms |

How it keeps what a full list gave:

- **Back lands on the same row.** Each row's measured height is kept for the session, per list
  width (`libraryRowHeights`), and each history entry's scroll position (`libraryScrollPositions`).
  So the first render after Back already holds the right rows at their real heights, the list is
  its full height from the start, and the router's scroll restoration lands exactly.
- **Tab walks the whole list.** Rows sit in normal flow between two spacers, with six past each
  edge of the screen, so the next row is always there to take focus, and focusing it scrolls more in.
- **Screen readers hear a list.** The list is `role="list"`, and each row says its place in the
  whole: `aria-setsize` and `aria-posinset`.
- **The filter glide names only the rows in the page,** which is what made it fast.
- **Find in page (Cmd+F) finds only the rows near the screen.** Accepted: the library's own search
  covers every overview.

The first row at 5,000 was still 5.6 s. Most of that was the harness, not the app: it hands every
seeded overview to the page on each launch and keeps them in memory. "The first load from
IndexedDB" below measures the real store.

### Reading the library from the device's store

`playwright/perf/libraryData.perf.tsx` (also run by `npm run perf:library`) times the real
IndexedDB store in the browser, without the page: it writes a first sync of N overviews (every
second one read) in the sync feed's pages of 200, then times the library's read
(`readLibraryEntries`) five times. 4× CPU, 22 Nov 2026 (OV-383).

The read used to fetch every overview, then each overview's state on its own. It now fetches all
the states in one call (`OverviewStore.listOverviewStates`). The machine was busy, so the two reads
were timed alternately in one run, and only their difference is worth trusting. Medians of five:

| Overviews | First-sync writes | Read, a state per overview | Read, all states at once |
|---|---|---|---|
| 500 | 84 ms | 88 ms | 54 ms |
| 2,000 | 352 ms | 261 ms | 159 ms |
| 5,000 | 1.4 s | 556 ms | 345 ms |

What the read still pays for, every time it runs:

- `listUnreadable` reads every overview and state again, to find the ones it can't read.
- Every record is checked against its schema and migrated on every read.
- Every sync that applies anything re-reads the whole library, at most once a second (below).

### The first load from IndexedDB

`playwright/perf/libraryFirstLoad.perf.tsx` (also run by `npm run perf:library`) launches the real
app on the real IndexedDB store (the harness's `indexedDbLibrary` option), with a simulated server
that pages the sync feed by 200 as the real one does. It times a new device's first sync, then
reloads and times the reader coming back to it. `PANEL=1` runs the extension panel at 400 × 600,
where the first row is Recent's. `PROFILE=1` saves a CPU profile and logs each IndexedDB
transaction and request. Phone width, 4× CPU, a quiet machine, 22–23 Nov 2026 (OV-390):

| Overviews | Coming back: first row (web / panel) | New device, whole library (web / panel) |
|---|---|---|
| 500 | 0.35 / 0.28 s | 1.1 / 0.6 s |
| 2,000 | 0.50 / 0.44 s | 1.1 / 0.7 s |
| 5,000 | 1.1 / 0.74 s | 2.6 / 1.9 s |

Coming back with 5,000 overviews shows the first row within the ~2 s the card asked for, and needed
no change: the store's read and React's work at startup are each a few hundred milliseconds.

#### A new device's first sync

Before, the new device's whole library took 3.5 s at 2,000 overviews and 14.9 s at 5,000 (panel
2.6 s and 12.0 s), and after signing in the reader watches "Opening library" for all of it. Each
pulled page invalidated every query, so the whole library was read again after each of the 38
pages, and IndexedDB made the next page's write wait behind that read: the cost grew with the
square of the library.

So `SyncRuntime` re-reads at most once a second during a pull (`throttled`): at once for the first
page, then once per second with whatever landed meanwhile, and at once when the cycle ends. A
sync of one page is re-read as soon as it lands, as before.
