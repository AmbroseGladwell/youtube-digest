# Projects

OV-168 (https://trello.com/c/Uof1EGZB). A project is what the reader is working on, such as
"Kitchen renovation" or "Launching my app": a name, a **purpose line** that the reader's
assistant reads as its brief, and a set of overviews. Topics say what an overview is about,
tags come from the source and the reader, and followed playlists are where videos come from.
A project says what an overview is *for*.

The assistant is treated as a project's main user, and the reader is the person who sets its
purpose and checks its work. The server gathers and counts; it never writes anything about a
project with a model (`mcp-connector.md`, the rented-intelligence position).

This document covers the data and how it syncs, the MCP tools, and the reader's screens. The
library's select mode, which adds several overviews to a project at once, follows on the same
card.

## Decisions taken with the owner, 12 Nov 2026

- **Order of work:** data first, with no UI; then the MCP tools and the real-assistant check;
  a Claude Design round briefed alongside both; the reader's screens last. Stacked PRs on
  the one card.
- **Assistant writes reuse `overviews:write`.** Making a project and changing its members
  carry the same reversible risk as marking read and favourite. A later scope for saving
  over MCP, which spends generation (OV-262), would be a separate one; project writes stay
  where they are.
- **No item kind on a member.** A member names an `overviewId` and nothing else. Kindle
  highlights, if they come, are most likely a new source kind of overview and join projects
  like any other. Anything that is not an overview gets its own kind of membership record (a `projectNote`,
  say), which needs no migration, where a kind field added later would change every
  member's id.
- **No library-size threshold.** Projects are always there: an assistant can make one at any
  library size, and a goal can come before the library does. The empty state is one quiet
  line in the rail.

## Two synced kinds

`project` and `projectMember`, both added at client version 20. A client built before then
is never sent either (`sync-api.md`, "A kind a client was built before").

```
project       { id, name, purpose, createdAt, createdBy, purposeBy, archivedAt }
projectMember { id, projectId, overviewId, addedAt, addedBy, removedAt }
```

`createdBy` and `addedBy` are a `ProjectAuthor`: `{ by: "reader" }`, or
`{ by: "assistant", connectionId, name }`, with the connection's name as it was when it acted,
so the mark survives the connection being renamed or revoked. Name is 1 to 80 characters,
purpose 1 to 280 or null. `purposeBy` is who wrote the purpose as it stands, null with no
purpose: an assistant that makes a project with a purpose is its author, and the reader's edit
sends `purposeBy` as the reader in the same patch, which the server refuses to take for anyone
else. The page says "Written by Claude" until then.

### A membership record is one overview in one project, never a list

This is the shape `sync-metadata.md` says the set-valued merge needs ("the fix is a different
shape of data"). Membership as an array on the project or the overview would lose one of two
concurrent writes: an assistant adding fifty overviews while a phone takes one out is exactly
that case. One membership record per overview in a project means two writes to different
membership records never meet.

A member's id is `<projectId>:<overviewId>`. Both are UUIDs, so the id is unambiguous and the
server finds a parent's members with a `LIKE` on the id rather than a column of its own.

### Removal is dated, so the merge commutes

Two writes to the same membership record do meet. Taking an overview out sets `removedAt` rather than
deleting the record, and putting it back sets a new `addedAt`. An overview is in the project
when `removedAt` is null or `addedAt` is later than it.

`mergeProjectMember` keeps the later `addedAt` with whoever made it, and the later
`removedAt`. Keeping the maximum of each is order-independent, so an add and a remove settle
the same way whichever reaches the server first, and merging the same change twice changes
nothing. A tie goes to the removal. One function runs in the local store, on the server and
in the rebase, as `mergeSettingsRecord` does for settings.

**Every change is stamped after the last one this device knows of** (`memberChangeTime`): the
later of now and one millisecond past the membership record's latest date. Without it, an add, a remove and
an add again in the same millisecond would tie and the last add would lose, and a membership record
dated by a clock running ahead of this device's would ignore the reader's next act.

The dates are wall clocks, with the bound `sync-metadata.md` already accepts under "Clock
skew". Between a device and an assistant, the assistant's write is dated by the server.

A tombstone is still used, but only when the parent goes: deleting a project or an overview
tombstones its members.

## The server

- `POST /api/projects` creates a project, create-only as a topic is. One that says an
  assistant made it is refused: assistant writes come through the connector, which marks
  them itself.
- `PUT /api/projects/:id` patches `name`, `purpose` and `archivedAt`, field by field, so a
  rename on one device and an archive on another both land. A patch to a project that is not
  there is a 404.
- `DELETE /api/projects/:id` tombstones the project, then its members.
- `PUT /api/projects/:projectId/members/:overviewId` takes `{ addedAt }` or `{ removedAt }`
  with `updatedAt`. The server sets `addedBy` to the reader; a body naming anyone is refused.
  - Adding to a project that is not live is a 404, and so is adding for an overview that has
    been deleted. Adding for an overview the server has never seen is allowed, because the
    outbox may still hold its creation behind a quota wait.
  - Removing an overview whose membership record the server has never seen is a 404. The client takes that as done,
    as it does any field write to a record the server lacks.
- `DELETE /api/overviews/:id` also tombstones the overview's members, in every project.

**The cascade runs after the parent's tombstone commits, and on every retry of the delete.**
A member write reads its project in the same transaction as itself (`WriteOperation.requires`),
and every write for one account holds the account's row lock while it allocates its seq. So
once the parent is a tombstone no overview can be added to it, and the listing that follows
catches every membership record added before. A delete that fails between the two finishes when the client retries
it, as the transcript cleanup already does.

## The client

- `ProjectStore` is the reader's side: list, get, create, update, delete, list members, add,
  remove. `IndexedDbProjectStore` journals each write in the same transaction, as every store
  does (`sync-client.md`). Creating a project that is already here does nothing, so a move
  that stops can run again.
- Two outbox ops: `project` (a field patch) and `member` (one add or removal). A new project
  rides the existing `replace`, and a deleted one `delete`.
- **A parent's delete takes its members off the device straight away and does not journal
  them.** The server cascades, and the tombstones come back down the feed. The same happens
  when a project or overview tombstone is pulled, so no member outlives its parent locally,
  including one whose add the server refused because its project had gone.
- **Enrolling** journals every project, and every member that is in its project. A member that
  was taken out before sync was switched on is not sent: the server has never heard of it and
  has nothing to remove.
- **Folding a duplicate overview** into the account's copy (`one-overview-per-video.md`) moves
  the duplicate's projects to the copy, as the reader's own adds made now, and drops the
  duplicate's member writes from the outbox.
- IndexedDB version 6 adds the `projects` and `projectMembers` stores, the latter indexed by
  project and by overview for the cascades.

## Over MCP

`mcp-connector.md`, "Projects", has the tools, the scope and the prompt. Two things belong here.

### get_project, and projectMarkdown

`projectMarkdown` in `@overview/domain` is the brief: the purpose, or an instruction to ask
for one; who made the project and when; the overview count, the unread count and the verdict
spread, all over the whole project; then its overviews, and every How to apply step from them
under each overview's title and id. `get_project` serves it a page at a time and the reader's
Copy as Markdown will serve it whole, so the two never differ.

**Overviews are ordered freshest verdict first** (original, fresh angle, widely covered, then
none), then newest saved, so an assistant reading page by page meets what is least likely to
be known already. Dubious ones are flagged, unread ones say so, and those an assistant added
say which. The ordering and every count are code (`docs/prototype/constraints.md`).

The card asked how long the gathered steps may be. How to apply holds at most three items,
so a page of 25 overviews carries at most 75; the size is measured in `mcp-connector.md`,
"The context budget". No separate cap was needed.

### The real-assistant check

The card's definition of done includes a hand-judged check against Claude and one other
client, which needs the connector deployed with these tools. The prompts, against a library
with two or three projects that have purpose lines:

1. "What should I do next on my kitchen?" with no project named. Does it find the project
   from its purpose alone and use `get_project`?
2. The same project asked about in other words ("the renovation", "the house stuff").
3. "Make me a project for launching my app and put in what I've saved that's relevant." Does
   it search, propose and then make it, with a sensible set and no invented purpose?
4. "Take the videos about pricing out of my launch project." Does it remove only those?
5. On a read-only connection, ask it to add something. Does it say how to reconnect rather
   than fail silently?
6. The `project_brief` prompt, picked from the client's prompt list.

The result is recorded on the card.

## The reader's screens

From the Claude Design round, "OV-168 1–6" in the design project, decided with the owner on
13 Nov 2026.

- **Where projects live.** A Projects group heads the library's rail, and the Filters sheet on
  a phone. It is always there: with none, a heading and New project. Five show, last changed
  first; "All projects" (or "All N projects", with "· N archived") sits under them once any
  exist. Choosing one turns the main column into its page at `/projects/:id`; choosing it
  again goes back to the whole library. The rail's other filters still apply inside a project,
  starting from every overview in it, and that view is never saved as the library's.
- **"Last changed"** is the latest of when the project was made and when anything was put in
  it. A membership record taken out leaves nothing on the device to date it by, and a project's
  rename isn't dated either, so neither counts.
- **The page.** "Project · Made 4 Nov" or "Made by Claude · 9 Nov"; the name; what it's for on
  the stone tint, or a dashed invitation to write it; counts and the verdict spread, from code;
  Copy as Markdown, which copies `projectMarkdown` whole; ⋯ with Rename, Edit what it's for,
  Archive and Delete project…. Rename and the purpose edit in place. An archived project says
  so under the name and offers Restore. A row an assistant put there says "Added by Claude ·
  11 Nov · Remove"; removing is silent.
- **Assistant lines only with a connection.** "Your assistant works from this", the
  invitation's sentence about an assistant, the create dialog's first helper sentence and the
  archived and delete clauses show only when the reader has at least one connection. An empty
  project offers a prompt to give an assistant only when a connection can write: the
  connection list now says which can (`writes`).
- **The quiet line.** A project with nothing put in it for 60 days asks "Still working on
  this?" on its own page only, with Keep it and Archive. Keep it is remembered on the device,
  per account, for another 60 days.
- **All projects** at `/projects`: a card per active project, then Archived as a group that
  opens, each with Restore. The only place archived projects are listed.
- **On an overview.** "In A, B and C · Change" under the byline, most recently changed first,
  archived ones left off; four or more name two and "and N more". Long names cut at about 32
  characters in CSS, with the full name in a tooltip on hover and focus. Add to project… in ⋯
  ("In 3" beside it) and Change open the picker: a dialog, a sheet on a phone, a checkbox per
  active project that saves as it is ticked, "Find a project" past eight, and New project…
  last, which makes one with this overview in it.
- **The panel** has the line and the picker only; a project's name opens its page in the web
  app.
- **Signed out** there is no library, so no projects. A shell with no server keeps its projects
  on the device like the rest of its library; it never moves them into an account, since it has
  none.

## Measures

The card names two measures this feature exists to produce. Both are counts and ids, never a
name or a purpose.

- **Is a project with a purpose read over MCP more than one without?** Every `get_project`
  and `create_project` call's `mcp tool called` line carries `projectId` and
  `projectHasPurpose`. Reads per project, split by whether it has a purpose, answer it.
  These are logs rather than analytics events, since an assistant's call is not something the
  reader did in the app (`mcp-connector.md`, "Logging").
- **How often does the reader take out what an assistant added?** That is a reader's act in
  the app, so it is an analytics event: `projects.membership.removed` carries `addedBy`, from
  the row's Remove and from unticking in the picker alike. `projects.*` events carry ids,
  counts and choices only.

## Not yet built

The library's select mode and its bar ("OV-168 5 Search Sort Filters Select"): adding several
overviews to a project, or a topic, at once, with search folded to an icon on a phone.
