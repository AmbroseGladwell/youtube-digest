# Topic filing: making topics, and putting overviews in them

Topics were a complete subsystem with no way to start one. `createTopic` existed on the
store, with a conformance test asserting it is the only way a topic is added, and had no
caller anywhere in the UI.

The consequences ran the whole length of the feature. No topic ever existed, so
`filingSection` told every call "The reader has no topics yet" and constrained
`matchedTopicNames` to `z.array(...).max(0)`; every overview came back unsorted; the
FilterPanel's topic group never rendered, because it is gated on `topics.length > 0`; and
the reader's breadcrumb never had a topic to name. Four built things, none reachable.

Two entry points now start one: the library rail, and the overview's own page.

## Making a topic by hand: the rail (design 13c)

`+ New topic` sits under the rail's topic list and opens a modal: a name, a line saying
what naming it will do, and the unsorted overviews as checkboxes to move in as the topic
is made. It is the same `<dialog>` pattern as `NewOverviewDialog` — centred on a desktop,
a sheet on a phone — so `showModal()` handles inertness, focus and Escape.

**The rail's Topic heading no longer hides itself when there are no topics.** It used to
be gated on `topics.length > 0`, which is exactly the library that most needs the button:
with no topics and no way to make one, nothing could ever start. The *list* is still
gated; the heading and the button are not.

**The list stops at six, and says how many there are.** Topics are the one thing in the
rail that grows without bound — everything else is a fixed handful of rows — so it is the
only part that needs a cap. `Show all 8 topics` reveals the rest and `Show fewer` puts them
away; the rail itself already scrolls in both layouts, so the cap is about how much a
reader is asked to read past, not about fitting.

**The topic being filtered by is always listed, even from beyond the sixth** — a filter you
cannot see is a filter you cannot clear. That is `cappedTopics`' whole job, and the reason
it is a tested function rather than a `slice` at the call site.

**The unsorted list is an offer, not a requirement.** `Create topic` is enabled on a name
alone, and the button counts what you picked ("Create topic · 2 overviews"), because a
topic with nothing in it is a perfectly good thing to make before the videos arrive.

## Editing an overview's topics: the page itself (design 14a/14b/14c)

Reading, the topic line is the topics and nothing else — no label, no remove, no add.
`Edit topics` in the ⋯ menu discloses the editor: chips gain a remove, `+ Add` appears,
and the picker opens on a search field that both filters the topic list and offers to
create what you typed.

**Editing lasts exactly as long as the picker is open** — one piece of state, not two. The
design draws `+ Add` already expanded (14b) and the phone's sheet carrying the chips
itself (14c), so there is no drawn state where the line is editable and the picker is
shut. Escape, `Done`, `+ Add` and a click outside all do the same single thing.

**Picking saves immediately**, per the picker's own footnote. That mutation is optimistic,
per `docs/conventions/frontend-architecture-guide.md` 3.6: the topic already exists, so its
id is a truthful thing to paint before the store answers.

**The phone's sheet leaves the React subtree; the desktop's popover does not.** `AppShell`
gives its pane a `view-transition-name`, which makes that pane the containing block every
`position: fixed` descendant resolves against — so a sheet rendered in place sits at the
bottom of the *pane*, which is as tall as the article. The sheet is portalled to
`document.body`; the popover is positioned against the topic line itself and stays put.
This is the one place a viewport is read in JavaScript (`useIsPhone`) rather than in CSS.

## Creating is find-or-create, not create

Both entry points look for an existing topic of the same name before making one, comparing
with `sameTopicName` (trimmed, case-insensitive).

The picker hides its create row as soon as the typed name matches a topic, so the guard is
rarely reached from the UI. It is there because the two entry points can race, and because a
name that differs only in case or spacing should not make a second topic.

**It only knows this database.** Two libraries that have not synced yet (the web app and the
extension panel, two devices, or the move on sign-in before a topic made elsewhere arrives)
each find nothing and each make one. That is how the owner's library came to hold three
"Fatherhood" topics with one overview each (OV-10). The server folds them: see "Same-name
topics fold on the server" below.

## Creating is not optimistic

`docs/conventions/frontend-architecture-guide.md` 3.6 makes optimistic updates the default,
and creation deliberately isn't one. The topic's id is minted by the store, so there is no
truthful cache to paint until it answers — an optimistic update would have to invent an id,
and every topic-keyed thing on the page reads that id back. It invalidates instead.

## Where this departs from the design file

- **The ⋯ menu holds only `Edit topics`.** 14a also draws Mark as unread, Copy link and
  Delete overview. None of them is this change, and a menu of controls that do nothing is
  the thing `docs/prototype/decisions.md` rules out.
- **No "Show all 6 unsorted" expander.** 13c's phone column reveals the rest of the
  unsorted list behind a link while its desktop column scrolls. One scrolling list serves
  both, and the heading already carries the count.
- **`+ Create "cl"` marks the whole typed name**, where 13c/14b draw the typed prefix bold
  inside a longer word. The topic created is what was typed, so the emphasis belongs on all
  of it — marking part of a word the reader has not typed would promise a completion that
  isn't there.
- **The Unsorted bucket is not in the rail's topic list.** That is 13a/13b's filter, not
  13c's button.
- **Verdict is left where it is.** Shortening the rail by hiding it was considered and
  dropped: it is five fixed rows, so it is not what makes the rail long, and "⚠ Dubious
  only" is the filter least worth burying.

## Descriptions, as hints

A topic's description shows as a muted line under its name in the picker (46r), and only
there. Onboarding's starter topics are the only ones that have one (`onboarding.md`); the
rail's dialog and the picker's own create row make topics without.

## What this deliberately leaves out

- **The model's suggested topic.** `filingSection` still asks for one and the schema still
  carries it, but nothing reads it back: `assembleOverview` drops it, and it is not on the
  `Overview` record. Accepting a suggestion is its own piece of work, not this one.
- **A focus trap on the desktop popover.** Escape and an outside click close it, and the
  search field takes focus when it opens, but focus is not held inside it the way
  `showModal()` holds it in the two dialogs.

## Managing topics (OV-10)

Topics can be renamed, merged and deleted. The server does the work, so a merge or delete is
one write from the device, and every overview it touches is re-filed in the same transaction.

| Route | What it does |
|---|---|
| `PUT /topics/:id { name?, description?, updatedAt }` | Renames. A blank name is refused. A name another live topic has is then folded, as below, so renaming onto a name in use is a merge into the earlier topic. |
| `POST /topics/:id/merge { into, updatedAt }` | Files every overview under `:id` under `into` instead, once, records the alias, and tombstones `:id`. `into` must be live. |
| `DELETE /topics/:id` | Unfiles it from every overview (one with no other topic becomes Unsorted), aliases it to nothing, and tombstones it. A second delete is a 204. |

All three are `foldTopicInto` underneath: re-file, alias, tombstone. A device that has not
pulled yet sees the topic go and its overviews change as ordinary changes; nothing new is
needed on the client to receive them.

The screens are not built yet. The owner chose logic first and a Claude Design round after
(27 Nov 2026), mirroring Manage tags (`tag-reuse.md`, 84j–84n). Until then, these routes have
no caller in the app.

## Same-name topics fold on the server

After `POST /topics` and after a rename, `foldSameNameTopics` looks for live topics in the
account whose names match by `sameTopicName`'s rule (trimmed, case-insensitive). The earliest
`createdAt` is kept (then the lowest seq); each other one is folded into it with
`foldTopicInto`. The kept topic takes a later one's description when it has none, since
onboarding's starter topics carry one and a reader-made duplicate does not.

Topics made before this existed are folded once, by migration step 51 (`foldDuplicateTopics`),
which logs `api.startup.duplicateTopicsFolded` with the ids kept and folded and how many
overviews were re-filed. Never the names.

## Aliases

`Settings.topicAliases` maps a merged topic's id to the topic it went into, and a deleted one's
to `null`. The server writes it, and the client never needs to. It exists for the late write:
a device offline during a merge or a fold still has filings under the old id in its outbox, and
pushes them afterwards. `PUT /overviews/:id/topics` and `POST /overviews` resolve `topicIds`
through the aliases first (`resolveTopicIds`), so the filing lands on the kept topic, or is
dropped for a deleted one, instead of pointing at a tombstone.

Unlike `tagAliases` it merges one level deep, like `milestones`: a topic id never comes back
into use, so there is nothing an undo would have to take away, and a whole-map write from a
stale device must not drop an alias the server just added. It is one step deep
(`withTopicAlias`): merging the kept topic later repoints everything that pointed at it.

**Not covered:** a `POST /topics` resent after its topic was deleted (an acknowledgement lost
in between) makes it again, since a tombstone is replaced like an absent record. That needs a
lost acknowledgement and a delete in the window between, and the reader can delete it again.

