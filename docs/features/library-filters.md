# Library filters

OV-400 (https://trello.com/c/VxSsixdN) split what the library called "source" into **Kind**
(what it is) and **Source** (where it came from), and added **Added**, **No topic**, and
more than one choice for Kind, Source, Verdict and Tags. Its screens are OV-399's design
round, built as the filter menu below.

## Any of a group, every group at once

Several values in one group mean any of them: Videos and Recipes shows both. Groups narrow
each other: Videos and Last 7 days shows only the week's videos. Topic and Added stay single
choice. Show (Unread, Favourite, No overview yet) and Dubious stay switches; the owner kept
Dubious and No overview yet on 24 Nov 2026, though the design didn't draw them.

An unreadable record answers only what its state can (read, favourite) and its salvaged
date (Added); every other group leaves it out (`record-migrations.md`, "What the library
does with one"). A link kept without its overview has no topic, verdict or tags yet, so
those leave it out too, while Kind and Source still find it (`kept-links.md`).

## Kind

Video, Article, Podcast, Recipe, from `libraryKindsOf`. **A recipe is also its medium**: a
recipe video matches Video and Recipe, a recipe article Article and Recipe. A photo or text
post is read, so it sits with Article. The kind chip on a row (`KindChip`) is unchanged:
only the filter counts a recipe twice.

## Source

`librarySourceOf` works out, on the device, a source for every overview:

| Overview | Source id | Named |
|---|---|---|
| YouTube, TikTok, Instagram, Facebook | the platform (`youtube`) | the platform |
| A web page | `site:` and the registrable domain (`site:seriouseats.com`) | its `siteName`, else the domain |
| A podcast | from the link the reader saved (`sharedFrom`), never the feed: `spotify`, `applePodcasts`, a YouTube link as `youtube`, else `site:` and its domain | the platform, or the domain |

The registrable domain comes from the public suffix list (`tldts`, in the bundle, no
request), so `www.`, `m.` and `news.` fold together and `bbc.co.uk` stays whole. A link on a
platform's own hosts (the sets the link parsers own, such as `YOUTUBE_HOSTS`) names the
platform, wherever it was found; a platform has no domain to show.
Channels and shows aren't sources for now (design 399s).

**The domain never leaves the device.** No favicon is fetched: a website shows the name tile.
Analytics name a source only as its platform or `website` (`sourceSwitched`).

## Added

Any time, Today, Last 7 days, Last 30 days, Last 3 months, Last 6 months, on `savedAt`, from
`libraryAddedSince` with the device's clock and time zone. Today starts at local midnight;
days and months count back on the calendar from now. Without a readable date a record
matches only Any time (`record-migrations.md`, "Ordering needs a date").

## In the URL

| Group | Param | Example |
|---|---|---|
| Kind | `kind` | `kind=video,recipe` |
| Source | `source` | `source=youtube,site:seriouseats.com` |
| Added | `added` | `added=7d` |
| Topic | `topic` | `topic=none` |
| Verdict | `verdict` | `verdict=original,fresh_angle` |
| Tags | `tag` | `tag=gift-ideas,work` |

An old link's `?source=video` (or article, recipe, podcast) reads as the kind, so bookmarks
keep working, and is rewritten as `kind=` the next time Kind or Source changes. Values that
don't parse are dropped one by one.

## Saved view

`libraryViewStorage` is at version 2. A version 1 view's single `source` becomes a list of
one kind, and its `novelty` a list of one verdict. Kinds, Added, Topic (No topic included),
Verdict, Show and Dubious are kept; **tags and sources are not**, for the reason the tag never
was: a place the reader went rather than how they like the list (`library-view.md`).

## Counts

`libraryFilterCounts` counts across the whole library, not narrowed by the other filters:
`byKind` (a recipe under both), `bySource` (most first, with name, domain and platform),
`byAdded`, and `noTopic`.

## Chips and analytics

Every chosen value has its own chip, and its × takes off only that value. Each value
switched on or off is one event: `kindSwitched`, `sourceSwitched` (platform only),
`noveltySwitched`, `tagChosen`/`tagCleared` (never the tag), and `addedChosen` and
`noTopicChosen` for the single-choice groups.

## The menu (OV-399, design 399o)

The filter button in the search row opens `FilterMenu`: a `Popover` 384 wide under the button
on a wide screen, and the shared `BottomSheet` under 48rem (which includes 200% zoom on a
laptop). Each tap applies at once; there is no Apply. Its foot has Reset and the count of
overviews, or on a phone Reset and an orange "Show N overviews" that only closes the sheet.

- **Groups, in order:** Show (Unread, Favourite, and No overview yet while any is saved) and
  Added and Kind as chips; then Source, Topic, Tags and Verdict as folded rows that name what is
  chosen ("Serious Eats", "2 chosen", "#work") and open one at a time. Verdict's chips are the
  three novelties and ⚠ Dubious, which the owner kept on 24 Nov 2026 though the design left it out.
- **Source and Tags** have a search, the top 5 (4 on a phone) by count with anything chosen
  kept in view, and Show all: in place on a wide screen, a list of its own in the sheet with
  the number of matches announced and Done. Tags end with Manage tags.
- **Topic** is radio rows: All topics, up to 7 (the chosen one always shown), No topic, Show
  all N topics, and New topic.
- **The controls** are `ChoiceGroup`: native radios and checkboxes in a `fieldset` with a
  `legend`, drawn as chips or as rows with a box. Each input lies over its whole chip or row, so
  a tap lands on it and the reflow check can reach it.
- **Never off screen:** the popover caps its height at the space under the button less 16px and
  scrolls inside with a fade; on a short screen the title and foot scroll with it.
- **Sheets:** `BottomSheet` has a × and a handle. Dragging down past halfway or a flick closes
  it, dragging up grows it to full height, anything else springs back; × and Escape close it
  too. It holds the keyboard (`useFocusTrap`) and gives it back to the button. OV-404 moves every
  other sheet in the app onto it.

**The chip line** under the search is one line at every width: the whole chips that fit, each
capped at half the line and cut with … (its full name on hover and as its accessible name),
then +N and Reset. +N opens `AppliedFilters` (a popover, or a sheet on a phone): every value
grouped as in the menu with its ×, Clear under a group of two or more, "+N more" past 6, Edit
filters, and the menu's foot. Chips are what differs from the view the library opens on, so the
default Unread has none.

**Nothing matches** says so, with Reset filters.

The rail is gone: projects, the queue and time saved are in the sidebar, or the masthead and
the list's head without it (`navigation.md`). The filter menu holds filters only.
