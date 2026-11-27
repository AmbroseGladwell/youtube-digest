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
each find nothing and each make one. That is how a real library came to hold three topics of
one name with one overview each (OV-10). The server folds them: see "Same-name
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

A topic's description shows as a muted line under its name in the picker (46r) and in Manage
topics. Onboarding's starter topics are made with one (`onboarding.md`); the New topic dialog
and the picker's own create row make topics without, and Manage topics edits or clears it.

**A description steers filing.** `generateTopicMatches` gives the model every topic as
`"Name": description`, so a rename that leaves the old description behind misfiles ("Film"
renamed "Documentaries" still says "Films, including TV."). Code can't judge whether a
description still fits a name, so the reader decides; the screens only make it impossible to
miss (below).

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
| `POST /topics/:id/merge { into, updatedAt }` | Files every overview under `:id` under `into` instead, once, records the alias, and tombstones `:id`. `into` must be live. Answers `{ refiled, added }`: the overviews it changed, and those it gave `into` to (the rest already had it). |
| `POST /topics/:id/restore { name, description, createdAt, into, refiled, added, updatedAt }` | Undoes a merge: see "Undoing a merge". |
| `DELETE /topics/:id` | Unfiles it from every overview (one with no other topic becomes Unsorted), aliases it to nothing, and tombstones it. A second delete is a 204. |

All three are `foldTopicInto` underneath: re-file, alias, tombstone. A device that has not
pulled yet sees the topic go and its overviews change as ordinary changes; nothing new is
needed on the client to receive them.

**Delete confirms first; merge doesn't, and offers Undo** (owner, 27 Nov 2026). A delete
says how many overviews the topic holds before it goes. A merge happens at once and shows an
Undo toast, as Manage tags does. No validation dashboard: the owner counts this as polish
(`CLAUDE.md`, habit 6), so it sends events but has none of its own.

## Manage topics, the screens (design 10a–10i)

`ManageTopicsDialog` mirrors Manage tags (84j–84n): the shared sheet, 35rem wide and centred on a
desktop, a bottom sheet on a phone; Find a topic, Most used / A–Z; a row per topic with its
description as one muted line and its count; a bar that hints until something is picked, then
offers Rename (one) or Merge… (several), Delete and Clear. With one topic, only Rename and
Delete. Each step's heading goes in the sheet's own head, so × sits beside it.

**Three ways in, all hidden with no topics.** The sidebar's "Manage" on the Show all line; the
filter menu's Topic group, "Manage topics" beside New topic; and a ⋯ beside a topic page's title
(`TopicActionsMenu`) with "Rename or edit description", "Merge into another topic…" and "Delete
topic", each opening that step. `useManageTopics` is the one host both the sidebar and the
library page use: it sends `opened` with where from, and hands a merge's Undo to the host's toast.

**Rename edits the name and the description together.** The row opens into Name and Description
(optional), pre-filled, with Clear and the line about filing. A blank name is refused. When the
name changes and the description was left as it was, the description takes the brand ring and
asks "You changed the name. Does this still describe …?" (`descriptionNeedsLook`); Save stays
on. A name another topic has turns Save into Merge… and opens the merge step with that topic
kept.

**Merge** keeps the most used topic by default, or a new name; the description it keeps is the
kept topic's own, or the first merged one with one, editable, with the others' shown to borrow
from (`mergeDefaults`, `borrowNote`). No confirm step. The notice says where the topic now is,
with Undo; closed while the notice shows, the toast carries Undo for `UNDO_TOAST_MS`. A merge
with a new name or an edited description is the merges, then one `editTopic`; Undo puts both
back.

**Delete** confirms in the dialog, naming the topic or topics and saying how many overviews will
have no topic, with focus on Keep (the sheet's `initialFocus` when it opens straight onto the
step). Afterwards a notice, no Undo.

**A filter on a topic that's gone clears.** The library page treats a topic id it doesn't hold
as "All topics", so a delete or merge from any host, another device, or a saved view never
leaves an empty list behind a filter nobody can see.

**All changes are painted at once** (`useTopicChangeMutation`), from the same functions the
stores re-file with (`topicsAfter`, `topicIdsAfter`, over `refiledOnMerge`/`refiledOnRestore`).

**Short screens.** Under `short-screen` the list and the merge step stop scrolling on their own
and the sheet scrolls as a whole, and the description field grows with its text
(`field-sizing: content`): at 200% text a list inside a sheet left too little to use.
`reflow.iwft.ts` covers renaming and merging.

### Where the build departs from the design

- **"Merge into another topic…" opens the list with the topic picked**, rather than a step of its
  own: the frames draw the menu (10h-2) but not where it leads, and the merge step needs the
  topics to merge, which the reader then picks.
- **The filter menu's Topic group already has New topic.** The design's foot holds only Show all
  and Manage topics. On the line under Show all, New topic sits at the far left and Manage
  topics at the far right (owner, 27 Nov 2026).
- **The dark-mode Merge and Save are the app's action colour**, as Ask and New are, not the
  frame's fixed orange.
- **Escape out of a rename clears the pick**, as Cancel does, so a second pick starts fresh.

## On the device

`OverviewStore` has `editTopic` (name and/or description), `mergeTopic`, `restoreTopic` and `deleteTopic`. A merge,
undo or delete re-files the device's overviews in the same transaction (`refiledOnMerge`,
`refiledOnRestore` in `TopicMerge.ts`, shared by every store) but journals **one** topic write,
not one per overview: the server re-files its own copies, so a per-overview entry would only
send the same change twice. The device shows the result at once; the server's re-filed
overviews come down on the next pull and agree with it.

`mergeTopic` returns the `TopicMerge` Undo needs (the topic as it was, and which overviews it
re-filed and gave the kept topic to), computed from this device's library. A merge pushed and
then undone before the next pull is the one race: the merge's tombstone can arrive after Undo
put the topic back. `outlivesTombstone` keeps a topic with a restore still in the outbox, so it
doesn't flicker out; its overviews may show the merge for one pull, until the restore lands.

A merge into a topic deleted on another device in the meantime is answered 404 and dropped like
any field write on a gone record. The next pull brings the server's topics and filings back, so
the merge simply didn't happen.

## Same-name topics fold on the server

After `POST /topics` and after a rename, `foldSameNameTopics` looks for live topics in the
account whose names match by `sameTopicName`'s rule (trimmed, case-insensitive). The earliest
`createdAt` is kept (then the lowest seq); each other one is folded into it with
`foldTopicInto`. The kept topic takes a later one's description when it has none, since
onboarding's starter topics carry one and a reader-made duplicate does not.

Topics made before this existed are folded once, by migration step 51 (`foldDuplicateTopics`),
which logs `api.startup.duplicateTopicsFolded` with the ids kept and folded and how many
overviews were re-filed. Never the names. In production it runs in the release command
(`seedVoiceSamples`, `deploy.md`), which applies migrations before the machines start, so the
line is in that deploy's release output (`fly logs`), not in the app's shipped logs.

## Aliases

`Settings.topicAliases` maps a merged topic's id to the topic it went into, and a deleted one's
to `null`. The server writes it, and the client never needs to. It exists for the late write:
a device offline during a merge or a fold still has filings under the old id in its outbox, and
pushes them afterwards. `PUT /overviews/:id/topics` and `POST /overviews` resolve `topicIds`
through the aliases first (`resolveTopicIds`), so the filing lands on the kept topic, or is
dropped for a deleted one, instead of pointing at a tombstone.

Unlike `tagAliases` it merges one level deep, like `milestones`, so a whole-map write from a
stale device can't drop an alias the server just added. The one removal, an Undo, is the
server's own write and replaces the map rather than merging into it. It is one step deep
(`withTopicAlias`): merging the kept topic later repoints everything that pointed at it.

## Undoing a merge

The merge answers which overviews it re-filed and which it gave the kept topic to, and the
client keeps the topic it merged away. Undo sends them back to `POST /topics/:id/restore`, which
in one transaction makes the topic again under its own id, removes its alias, puts it back on
every re-filed overview, and takes the kept topic off the ones the merge added it to. An
overview deleted in the meantime is left alone. The topic comes back under the name and
description the client sends, so undoing a rename onto a taken name brings back the old name,
not a same-name pair.

**Not covered:** a `POST /topics` resent after its topic was deleted (an acknowledgement lost
in between) makes it again, since a tombstone is replaced like an absent record. That needs a
lost acknowledgement and a delete in the window between, and the reader can delete it again.

