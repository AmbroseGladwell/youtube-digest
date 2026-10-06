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

