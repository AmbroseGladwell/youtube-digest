# Projects

OV-168 (https://trello.com/c/Uof1EGZB). A project is what the reader is working on, such as
"Kitchen renovation" or "Launching my app": a name, a **purpose line** that the reader's
assistant reads as its brief, and a set of overviews. Topics say what an overview is about,
tags come from the source and the reader, and followed playlists are where videos come from.
A project says what an overview is *for*.

The assistant is treated as a project's main user, and the reader is the person who sets its
purpose and checks its work. The server gathers and counts; it never writes anything about a
project with a model (`mcp-connector.md`, the rented-intelligence position).

This document covers the data and how it syncs, which is the first slice to ship. The MCP
tools, the reader's screens and the real-assistant check follow on the same card.

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
project       { id, name, purpose, createdAt, createdBy, archivedAt }
projectMember { id, projectId, overviewId, addedAt, addedBy, removedAt }
```

`createdBy` and `addedBy` are a `ProjectAuthor`: `{ by: "reader" }`, or
`{ by: "assistant", connectionId, name }`, with the connection's name as it was when it acted,
so the mark survives the connection being renamed or revoked. Name is 1 to 80 characters,
purpose 1 to 280 or null.

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

## Not in this slice

The MCP tools (`list_projects`, `get_project`, `create_project`, `change_project_members`, the
`project` filter and the `project_brief` prompt), `projectMarkdown`, moving a no-account
library's projects into an account, analytics, and every screen. Each is on the card.
