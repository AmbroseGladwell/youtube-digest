# Record migrations

Designed, not built. This is the replacement for the stopgap named in
`docs/architecture/v1-architecture-decisions.md` ("Stored records are read back
unvalidated, and a versioned migration is the accepted way out — not yet built"),
written so it can be argued with before any of it exists.

## What this is actually for

A record written by an older schema comes back exactly as it was written. A field added
since has no key at all — `undefined`, not `null` — because the schemas declare
progressively-added fields `.nullable()`, which means *present and possibly null*, not
*possibly absent*. So every reader of such a field has to guard on truthiness rather than
on the one absent value the current schema can express.

That guard has been forgotten three times, and the three failures are not alike:

| Field | What the reader did | What the user saw |
|---|---|---|
| `thumbnailUrl` | rendered an `<img>` with `undefined` | a missing image |
| `durationMs` | formatted it | `NaN:NaN video` |
| `publishedAt` | handed it to `Intl.DateTimeFormat` | `RangeError` — the whole page to the error boundary |

The first two degrade quietly, which is its own problem. The third took the page down.
The point is not that three guards were missed; it is that **a guard that is remembered
is not a guarantee, and the next added field inherits the trap.**

The fix is to make the decision about an absent field *once, where the field is added*,
rather than at every call site forever.

## Two version numbers, doing two different jobs

This is the decision everything else follows from, and conflating the two is the trap
most implementations fall into.

- **`DATABASE_VERSION`** (today: 3) describes the **container**: which object stores and
  indexes exist. It moves only when a store is created, deleted, or re-keyed, and it is
  IndexedDB's own concept. It is local-only and means nothing to a server.
- **`schemaVersion`** describes the **record**: which fields it has. It moves whenever a
  field is added, removed, or changes meaning.

They must be separate because the two change for unrelated reasons, and — decisively —
**`DATABASE_VERSION` cannot survive the backend.** Once records sync, a record arrives
over an API from another device, not through `onupgradeneeded`. There is no upgrade
transaction to hang a migration off. A version carried *on the record* is the only one
that still means something when the record has travelled.

`DATABASE_VERSION` stays exactly as it is, for exactly what it does now.

## The version rides on the stored record, and zod removes it again

The stored shape is the domain record plus one integer:

```
{ id, video, savedAt, …, schemaVersion: 4 }
```

Not an envelope (`{ schemaVersion, record: {…} }`). The envelope is tidier in the
abstract and worse here for a concrete reason: the object stores use `keyPath: "id"` and
`keyPath: "overviewId"`. Wrapping the record moves those keys down a level, which means
deleting and recreating every object store — a structural change, a `DATABASE_VERSION`
bump, and a rewrite of every record, to introduce the mechanism whose whole purpose is
avoiding exactly that.

**`schemaVersion` is deliberately not on the `Overview` type.** Domain code never sees
it: the store adds it on write, and on read it disappears by itself, because zod objects
strip unknown keys. This was checked rather than assumed — zod 4.6.5, and it holds
through `Overview`'s `.superRefine`:

```
z.object({ a: z.string() }).superRefine(() => {}).parse({ a: "x", schemaVersion: 3 })
// → { a: "x" }
```

So `Overview.parse(stored)` is both the validation and the strip, in one call, with
nothing to remember. The generation pipeline, the test factories and every component keep
working against a type that has no version on it — which also keeps the version from
leaking into a prompt, a fixture, or a `deepEqual` in the conformance suite.

**A record with no `schemaVersion` is version 1.** Every record written to date has none,
so the base case costs nothing and needs no backfill.

## Migrations run at the read boundary, not in the upgrade transaction

A migration is a pure function from one version to the next:

```
type RecordMigration = (record: unknown) => unknown
```

and the registry is an ordered list, so migrating is applying the chain from the record's
version to the current one, then parsing:

```
migrate(stored) → parse → Overview
```

The obvious alternative is to migrate eagerly inside `onupgradeneeded`, rewriting every
record once. It is rejected on three counts, the last of which is decisive:

1. The upgrade transaction blocks app start, and it is all-or-nothing across a store that
   includes transcripts — the largest records here by a wide margin.
2. It fires once per device per version. A record restored from a backup, or written by a
   half-finished upgrade, never passes through it again.
3. **It does nothing for sync.** A record arriving from the API post-upgrade has to be
   migrated by *something*, and if that something is a second mechanism then there are
   two implementations of the same chain, which will disagree.

Reading is the one path every record takes regardless of where it came from. Putting the
migration there means one implementation covers local records, restored records, and
synced records identically.

**Migration on read is pure — it does not write back.** Reads happen inside `readonly`
transactions and in the extension's service worker; a read that silently writes turns
`listOverviews` into a mutation and makes the service worker's `holdsOverviewOf` check a
write path. Records reach their current form on disk when they are next saved for a real
reason.

The cost, stated plainly: the chain accumulates, and v1 migrations live forever. The
escape hatch is named rather than left to be discovered — when the chain is long enough
to hurt, ship a one-shot pass that rewrites every record and raises the floor, and delete
what is then below it. That is a deliberate future action, not something to build now.

## An unreadable record is quarantined, never silently dropped

This is the decision that matters most, and the one with the strongest prior evidence in
this project.

A record can fail to become a current record two ways: no migration path reaches it, or
it parses invalid at the end. Three things could happen:

- **Throw.** One bad record takes out `listOverviews`, and the library is gone. No.
- **Drop it.** The library quietly shrinks. This is precisely the prototype's worst
  failure — `CLAUDE.md`: the library "silently sat eleven notes behind for days," and the
  habit that came out of it is *verify before reporting*. A store that returns 29 records
  and reports success when it holds 30 is that bug with a new address. No.
- **Quarantine it, and say so.** The record is kept, excluded from the list, and
  **counted**. The library can then say "2 overviews could not be read" rather than
  showing 28 and implying that is all there is.

The third is the only one consistent with *degrade visibly*. The quarantined record is
kept **raw and unmodified** — a record unreadable today is very often readable once the
migration that was missing gets written, and deleting it forecloses that.

The interface shape this implies, for argument:

- `listOverviews()` keeps returning `Overview[]` — the readable ones. Call sites are
  unchanged.
- `OverviewStore` gains `listUnreadable(): Promise<UnreadableRecord[]>`, carrying the id,
  the version found, and why it failed.
- `getOverview(id)` **throws** a typed error for a quarantined record rather than
  returning `null`. `null` already means *no such record*, and collapsing "broken" into
  "absent" is the silent drop again at single-record scale. The reader route already has
  `RouterErrorBoundary` to catch it.

## Not every store deserves the same treatment

The asymmetry here is real and worth building in rather than discovering later. What
separates them is **what it costs to get the record back**.

| Store | On failure | Why |
|---|---|---|
| Overviews | quarantine, report | Irreplaceable: ~30,000 tokens and a transcript to regenerate, against a reader context that has since changed |
| Overview states | quarantine, report | Irreplaceable and not regenerable at all — read, favourite and user tags exist nowhere else |
| Topics | quarantine, report | Irreplaceable, and an overview referencing a lost topic reads as unfiled |
| Transcripts | **discard and refetch** | A cache miss, not data loss. `StoredTranscript` already says so of its own `video` field: "a missing block is a cache miss that costs one call to fill, not a state to migrate" |
| Settings | fall back to defaults, report | A singleton; there is nothing to quarantine *around*. Resetting is survivable, resetting **silently** is not — `readerContext` is typed by hand and its loss must be visible |

Transcripts are the interesting row: making the cheap-to-replace store the one that
discards is what keeps the quarantine list short enough to be worth reading.

## What happens when records start arriving from a server

Two rules, both of which are easier to adopt now than to retrofit.

**The server stores what it is given, with the version it was given, and migrates on its
own schedule.** It does not migrate on a client's behalf on read. Otherwise the same
chain exists twice, in two languages, and the two will drift.

**A record from the future is refused, not down-converted.** A device on a newer app
version can sync a record whose `schemaVersion` exceeds anything this client knows. The
chain cannot run forward into a version that has not been written yet. The tempting move
— parse it loosely, drop the unknown fields, carry on — is a data-loss bug waiting for
its first write-back: this client strips the fields it does not understand, saves, and
the newer device's data is gone. So a future-versioned record is quarantined like any
other unreadable one, with a message that names the real cause ("written by a newer
version of the app").

This is the one case where quarantine is not a failure but the correct steady state, and
it resolves itself when the client updates.

## The corpus is what stops the chain rotting

Migration code is uniquely prone to silent rot: it runs only against data nobody has
locally, so it can be wrong for months.

The proposal is a checked-in corpus — one real stored record per historical version, per
store, as JSON — with a conformance test asserting that **every version in the corpus
migrates to a record that parses against the current schema.** The rule that keeps it
honest: *adding a field means adding a fixture at the version before it.*

This belongs in `packages/store-conformance`, beside the suites, so both the IndexedDB
implementation and whatever the API client turns out to be inherit it rather than each
testing its own copy.

`samples/` already sets the precedent that this project tests against real content rather
than invented fixtures, and the corpus should be built the same way — real records pulled
from a dev profile at each version, not hand-written ones that only contain the fields
whoever wrote them remembered.

## What this does not fix

Worth being explicit, because a migration mechanism attracts more credit than it earns.

- **It does not correct wrong data, only absent data.** The caption-derived duration that
  `v1-architecture-decisions.md` corrects is wrong, not missing. No migration recovers the
  real runtime; only refetching does.
- **It does not retroactively fix the nested-merge gap** left open in session 1
  (`sectionsEnabled`). It makes it *fixable*: the migration that adds a section toggle
  writes the default into the nested object explicitly. Until such a migration is written,
  the gap stands.
- **It does not remove the need to think when adding a field.** It relocates the thinking
  to one place and makes forgetting it a test failure rather than a `RangeError` in front
  of a user.

## Rejected alternatives

**Make every progressively-added field `.optional()` and guard at each call site.** This
is the status quo. It is what produced the three bugs above. Rejected on the evidence.

**Use a library's versioning (Dexie's `.upgrade()`, or similar).** Its migrations are
keyed to the *database* version and run eagerly inside the upgrade transaction — both of
this design's rejected answers, and neither reachable for a record that arrives over an
API. It would also be a dependency in service of roughly a hundred lines.

**Store nothing; regenerate on demand.** ~30,000 tokens per video, against a reader
context that has since moved on, for a record the user may have annotated. No.

## Open questions, in the order they need answering

1. **Does `getOverview` throw for a quarantined record, or return `null`?** Argued above
   for throwing. The counter is that it makes every single-record call site a potential
   error boundary trip, for a case that should be rare.
2. **Is the quarantine surfaced per-record or as a count?** A count is one banner and no
   new screen. Per-record means a reader can see *which* note is stuck, which matters far
   more once notes are irreplaceable and synced.
3. **Where does the migration code live?** `packages/types` already holds the schemas,
   the defaults and the refinements, so it is the honest home — but it makes a package
   named `types` into a domain package with behaviour. The alternative is a
   `packages/migrations` that depends on it.
4. **Is settings' fallback-to-defaults visible, and how?** It is the one store with no
   quarantine list to put anything in.
5. **Does the corpus get committed from a real dev profile, and whose?** Real records
   carry real video titles and a real `readerContext`. That is the point, and it is also
   personal data in a repo.

## When to build it

`v1-architecture-decisions.md` set the trigger at "real users or a synced paid tier,
whichever is first," and neither has happened. The argument for building it before either
is that **the backend makes it more expensive, not less**: `schemaVersion` has to exist on
the Postgres row and in the API contract, and defining it after those exist means
reconciling two schemes rather than designing one. The forward-compat rule in particular
is close to unretrofittable — by the time two app versions are syncing, the wrong
behaviour has already written over someone's data.

The counter-argument is the same one the original note made, and it has not weakened: the
whole corpus today is a handful of local dev records belonging to the people who wrote
them, and nothing is released.
