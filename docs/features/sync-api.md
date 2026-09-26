# The sync API

The server half of the sync engine: where a synced record lives, what the four numbers on
it mean, how a write is decided, and how a client reads everything that changed. The
client half, an outbox and a store that talks to this, is the next slice. The service
around it is `docs/architecture/api.md`.

`docs/features/record-migrations.md` and `docs/features/sync-metadata.md` decided most of
this before any of it was code, and this document is written against them: where a rule
here departs from one there, it says so.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| One `records` table over every kind, tombstones included | `apps/api/migrations/V0002__records.sql` |
| A per-account seq allocated by a locking update, first thing in every write | `src/records/RecordsRepository.ts` |
| The write decided by a pure function over the current row | `src/records/decideReplace.ts`, `decideMerge.ts`, `decideTombstone.ts` |
| The chain run to the caller's version before a merge, never a parse | `decideMerge.ts`, using `migrateStoredRecord` |
| Validation by migrating to current and parsing | `src/versions/validateRecordBody.ts` |
| The routes | `src/routes/changesRoutes.ts`, `overviewRoutes.ts`, `topicRoutes.ts`, `settingsRoutes.ts` |
| The behaviour, end to end, over a real Postgres in process | `src/routes/*.test.ts` |

## One table

```
records (account_id, kind, id, schema_version, rev, seq, updated_at, stored_at, deleted, body)
  primary key (account_id, kind, id)
  unique (account_id, seq)
  kind in ('overview', 'overviewState', 'topic', 'settings')
  updated_at matches the fixed-width Z form, and is null only on a tombstone
  deleted = (body is null)
```

Every synced kind is an opaque, client-versioned JSON body carrying identical sync
metadata, the server never looks inside one except to validate it, and the changes feed
wants one seq-ordered stream across all kinds. Four tables would buy typed columns nothing
needs yet, and cost a `UNION` on every pull and a table plus routes plus a feed branch per
new kind. A new kind here is a `CHECK` edit, which is a migration, which is a deliberate
cost: a typo in a new kind fails loudly.

`id` is text rather than uuid because settings is a per-account singleton at the fixed id
`settings`, the same key the local store uses. `body` holds the record **without** its two
stamp keys; `schema_version` and `updated_at` are the columns, and the feed puts them back
beside the body. Storing the keys in both places invites drift.

## Four numbers on a row, and who owns each

| Column | Owned by | Moves when |
|---|---|---|
| `schema_version` | the writing client | its shape changes; a merge writes at the caller's version |
| `rev` | the server | every accepted write, tombstones included; starts at 1 and never restarts, so a stale `If-Match` cannot match after a delete and recreate |
| `seq` | the server | every accepted write, reassigned, so the feed is ordered by last change and a record appears once |
| `updated_at` | the writing client | every write, preserved as sent |

`stored_at` is the fifth, the server's own clock, and it is named so it cannot be mistaken
for the fourth. It never appears in the feed. This is the one concrete column rule
`sync-metadata.md` gives, and it is the failure that would look fine while quietly making
every offline edit report its upload time.

**`updated_at` is text, not `timestamptz`.** The client's value is preserved verbatim so
that string comparison stays chronological, and a `timestamptz` would round-trip through a
`Date`. What the server normalises is only the representation: an offset form such as
`+01:00` is the same instant and is stored in the `Z` form the local stamp already uses. It
never substitutes its own clock.

## The seq is a per-account counter, and the update that allocates it is the lock

```sql
update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq
```

runs first in every write transaction. It row-locks the account for the rest of the
transaction, so one account's writes commit in seq order. That closes a hole a global
sequence would leave open: transaction A takes 11, B takes 12, B commits first, a puller
sees 12 and advances past 11 forever. The allocator and the lock are one statement, and a
rolled-back write un-allocates because the counter is a column in the same transaction.
Cross-account contention is nil.

## Writes are decided by pure functions, inside the transaction

Each write is: allocate the seq, read the current row, call a decision, apply it. The
decisions take the current row and the request and either return what to store or throw
an `ApiError`, and they are the whole of the write rules:

| Decision | Used by | Rules |
|---|---|---|
| `decideReplace` | `POST /overviews`, `POST /topics` | live record and no `If-Match` → `already_exists`; `If-Match` mismatch → `revision_mismatch`; `If-Match` on an absent record → `not_found`; floor; the body's `schemaVersion` must be the caller's own; validate |
| `decideMerge` | the field writes and both upserts | absent and no defaults → `not_found`; `If-Match` mismatch; floor; migrate the stored body to the caller's version; merge; validate |
| `decideTombstone` | `DELETE /overviews/:id` | absent or already deleted → nothing (204); `If-Match` mismatch; floor |

**The floor** is `record_newer_than_client`: the stored `schema_version` exceeds the
caller's for that kind. It applies to every write onto an existing record, whole-record
replace and delete included, which closes a gap the local store still has: there,
`saveOverview` and `deleteOverview` will clobber a future-version record.

## A merge migrates first, then merges, and never parses

`IndexedDbOverviewStore.#writable` merges a patch into the migrated-but-unparsed raw
record, because a parse strips a newer client's keys. The server does the same, and the
reason it cannot take the shortcut of a `body || patch` in SQL is concrete: migration 3
renames `savedNote` to `captureReason` with `savedNote ?? null`. A capture reason merged
into a version-2 body without migrating first would be overwritten with `null` by the next
reader's chain. `overviewRoutes.test.ts` seeds a version-2 record and files it under a
topic to prove the merge lands at version 4 with the reason intact.

The chain runs to `min(caller's version, server's current)`, sliced from the shared
registry with `migrateStoredRecord`, and a stored record above that comes back as
`future-version`, which is the floor again by another route. `record-migrations.md` says
the server never migrates on a client's behalf on read, and allows migrating internally to
answer a question; this is that clause, and it is the same code the local store runs.

**The merges mirror the local store exactly.** Topics and the capture reason spread onto
the overview; state spreads onto `DEFAULT_OVERVIEW_STATE` under the stored body, with
`overviewId` reapplied; settings spreads onto `DEFAULT_SETTINGS` with `sectionsEnabled`
merged one level deep, so one toggle does not take a newer client's toggles with it. A
patch that changes nothing is `400`: a no-op that moved the revision would be a lie in the
feed.

## Validation by migrating to current

A body at a version the server knows is stamped, run through the shared chain to the
current version, and parsed with the domain schema, refinements included. That is one
chain run, it is the same invariant the migration corpus already enforces, and it means an
old-version record is checked as strictly as a current one while being **stored at its own
version, as sent**.

A body at a version the server does not know yet, from a client that updated before the
API did, is stored as given after the checks that need no schema: it is an object and its
id matches. The server cannot check a shape it has not heard of, and refusing would break
an extension that Chrome updated on its own schedule. "The server stores what it is given"
is narrowed to what a self-consistent client gives it: a `schemaVersion` that disagrees
with the caller's claimed version is `invalid_request`.

## `If-Match`: required to replace, optional to patch

Every write response carries `ETag: "<rev>"` and `{ id, rev, seq }`. `If-Match` accepts
the quoted or bare number.

A whole-record `POST` onto an existing id needs it, and without it is create-only: a
whole-record write over a record the client has not read is precisely the clobber
`record-migrations.md` exists to prevent. The field-scoped writes and both upserts honour
it when present and do not require it: those endpoints exist so a write need not know the
rest of the record, and requiring a revision would fail topic filing with `412` whenever
another device had edited the capture reason. Field writes commute across fields, and
same-field replacement of a set is the loss `sync-metadata.md` already accepts.

## Deletes are tombstones, and an overview takes its state with it

`DELETE /api/overviews/:id` keeps the row: `deleted`, body and `updated_at` nulled, the
revision moved on, a fresh seq, `schema_version` left at the value at deletion. The feed
carries it with `deleted: true` and no body, which is how another device learns to delete
its copy. `sync-metadata.md`: deletion is never inferred from absence.

**The overview's state row is tombstoned in the same transaction.** This departs from the
local store, whose `deleteOverview` only touches the overviews store. Ids are minted per
creation and never reused, so a surviving state row would be a permanent orphan on every
device and the feed would carry a state for an overview nobody holds. The cascade does not
check `If-Match` on the state; the parent's deletion is authoritative. The local store
should follow, and has not yet.

Recreating over a tombstone with a plain `POST` is allowed, since from the client's view
the record is absent, and the revision continues from the tombstone's.

## The feed

`GET /api/changes?since=<seq>&limit=<n>` answers `{ changes, next, more }`: every record
in this account with `seq > since`, in seq order, up to `limit` (1 to 1000, default 200).
`next` is the last seq returned, or `since` when nothing was, and `more` says whether to
ask again. Each change is `{ kind, id, schemaVersion, rev, seq, updatedAt, deleted, body? }`
with `body` present only on a live record. A record the caller's version cannot read is
returned all the same: holding it back is the client's rule, and the feed is not the place
to hide data from the account that owns it.

## Rejected alternatives

- **Per-kind tables.** Above.
- **A global sequence.** The out-of-order-commit hole, above; it would still need the
  account lock to be correct, at which point the per-account counter is simpler.
- **`body || patch` in SQL.** Migration 3, above.
- **Refusing a version the server does not know.** Breaks a client that updated first;
  storing as given costs one deploy of unvalidated writes, which the deploy-order rule in
  `docs/architecture/api.md` removes anyway.
- **`If-Match` required everywhere.** Makes field writes fail for edits to other fields.
- **`GET` for a single record.** The feed is the read path, and every test asserts through
  it, which is "verify before reporting" applied to the API's own claims.

## Not built in this slice

The client half: an IndexedDB outbox written in the same transaction as each local write,
a sync loop that pushes it and pulls this feed, a `SyncedOverviewStore` and
`SyncedSettingsStore` passing the conformance suite, and the stale-client banner and
write-floor wall wired to the handshake. Also: the shared transcript cache (its gating is
still contradictory across the docs), captures, audio, topic rename and delete, the
one-overview-per-video question at first sync, and set-valued merging of `userTags` and
`topicIds`. Aligning the local store's `deleteOverview` with the state cascade is a small
follow-up.
