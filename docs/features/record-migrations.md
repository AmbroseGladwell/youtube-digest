# Record migrations

Built, apart from what needs a server. This is the replacement for the stopgap named in
`docs/architecture/v1-architecture-decisions.md` ("Stored records are read back
unvalidated, and a versioned migration is the accepted way out — not yet built"),
written so it could be argued with before any of it existed. It has since been argued with,
and the sections on writes, on the server and on what counts as a migration are the result.
Where a conclusion survived an argument that turned out to be wrong, that is said rather than
quietly tidied away.

**What is built, and where**, since the rest of this document is written in the present
tense of a design:

| The decision | Where it lives |
|---|---|
| The chain, the precondition, and the version on the record | `packages/domain`: `RecordMigration`, `migrateRecord`, `storedSchemaVersion` |
| Migrate, then parse, at the read boundary | `packages/domain/src/readStoredRecord.ts`, over `migrateStoredRecord` |
| The first migration — the three video fields, filled with the null the schema already means | `packages/domain/src/overviewMigrations.ts`, at version 2 |
| Quarantine, and the salvage parse | `UnreadableRecord`, `UnreadableRecordError`, `SalvagedOverview` |
| Reading up to this client's version and no further | `migrateStoredRecord`, which holds back anything above it |
| Per-store policy — quarantine, discard, or defaults | `packages/store-local`, one store at a time |
| Field-scoped writes | `setOverviewTopics` on the store interface; `setOverviewState` and `Settings.update` merge into the raw record |
| The corpus, and the registry-driven check | `overviewCorpus.ts` with `overviewMigrations.test.ts` |
| The chain is actually run | `packages/store-conformance`, behind a raw-seeding hook a store may or may not offer |
| The record in the library, and the screen behind it | `LibraryUnreadableCard`, `UnreadableOverview`, and `unreadableRecord.iwft.ts` |

**What is not built, and why:** everything downstream of a handshake — `minSupportedClientVersion`,
`currentSchemaVersion`, the stale-client banner and the write-floor wall. There is no API
yet, and locally no record can exceed this client's version, because this client is the only
thing that writes. The read rule that those screens report is built and tested; only the
screens wait. The `future-version` reason exists and is carried through to the library card
and the reader, so the day a record does arrive from a newer client, it is quarantined and
named rather than read loosely.

**Three departures from what is written below**, each small enough to have been made rather
than re-argued:

- **The corpus is a TypeScript module, not JSON files.** `npm test` compiles `src` and runs
  `dist`, and JSON does not make that trip without import attributes and a compiler flag. The
  records are literals either way, and the pairwise and registry-driven checks are unchanged.
- **`listUnreadable()` carries a `kind`**, so one method answers for the overviews, the
  overview states and the topics in the same store rather than three methods answering for
  one store each. The library reads the `overview` ones; the rest are there to be counted
  rather than rendered.
- **An unreadable overview *state* falls back to the defaults rather than throwing**, because
  `getOverviewState` has no absent case to borrow and one bad state record would otherwise
  take the whole library list down. It is still counted by `listUnreadable()`, and the write
  path refuses it, so nothing is written over.

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

**`schemaVersion` is per record type, not per database.** Overviews, overview states and
topics each carry their own integer and their own chain. A single number shared across stores
would force a bump — and a corpus fixture — on stores that had not changed. `OverviewState`
may well sit at 1 forever.

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

A migration moves a record one version forward, and the registry is an ordered list, so
migrating is applying the chain from the record's version to the current one and then
parsing:

```
migrate(stored) → parse → Overview
```

The transformation is a pure function over an unvalidated record, wrapped in a
**precondition that refuses to run unless the record is at exactly `newSchemaVersion - 1`**,
with the wrapper stamping the new number on the way out:

```
type RecordMigration = {
  newSchemaVersion: number
  alterRecord?: (record: unknown) => unknown   // absent for a purely additive bump
}
```

That guard is doing real work, and it is the reason no historical schemas are kept. Nothing
type-checks that migration 3's output is what migration 4 expects — and nothing needs to,
because a migrator applied to the wrong shape fails immediately, at the seam, rather than
producing a plausible wrong record several steps later. Frozen zod schemas per version would
buy the same property at the cost of copying the whole composed `Overview` tree —
`CoreFields`, `Filing`, `Verdict`, `Selling`, `HowToApply`, `WatchAnyway`, `VideoSource` —
once per version, and a "frozen" schema that imports a live sub-schema is not frozen at all.

`alterRecord` is optional on purpose. A purely additive change still gets a migrator and
still bumps the number; it simply has nothing to rewrite. That keeps *did the version move?*
and *did any record need changing?* as the separate questions they are.

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

A fourth argument is sometimes made for the upgrade transaction: that afterwards the
application only ever handles shapes it knows about. That is a property of *where* the
conversion happens rather than *when*, and the read boundary delivers it in full —
`migrate → parse → Overview`, with nothing downstream of the store ever seeing a version.
Init-time migration adds nothing to it, and once records arrive from a server it delivers
less: a record synced down at 11am is unknown-shaped in a session that started at 9am, and
there is no upgrade transaction left to run it through.

**A production system does migrate everything at app start, and the reason it can is
instructive.** The mechanism this design is modelled on — see *Prior art*, below — runs its
whole chain across IndexedDB on start. It is event-sourced: nothing can be shown until every
event has been replayed, so the migration pass rides on a full read that was happening
anyway, and its write-back is an appended delta rather than a replaced record. Neither
property holds here. Nothing in this app needs to read everything in order to start, and a
record here is replaced rather than appended to — which is what *Writes are field-scoped, not
whole-record* is about. Both of that system's choices follow from append-only storage rather
than from schema migration, and neither survives the move to records.

**Migration on read is pure — it does not write back.** Reads happen inside `readonly`
transactions and in the extension's service worker; a read that silently writes turns
`listOverviews` into a mutation and makes the service worker's `holdsOverviewOf` check a
write path. Records reach their current form on disk when they are next saved for a real
reason.

The cost, stated plainly: the chain accumulates, and v1 migrations live forever. It is worth
knowing what that costs here, because this app reads in bulk more often than it looks.
`holdsOverviewOf` (`apps/extension/src/serviceWorker.ts:37`) calls `listOverviews()` — a full
`getAll()` — on every YouTube watch page the user opens. The recurring cost is therefore
*records × chain length × page views*, not *records × chain length* once.

At thirty records and a chain of three that is noise. The reference mechanism below is at
version thirty; at that chain length with a thousand records it is thirty thousand migrator
calls and a thousand zod parses per page load. So the escape hatch is named with a trigger
rather than left to be discovered: **when chain length times library size makes a bulk read
measurable, ship a one-shot pass that rewrites every record and raises the floor, then delete
what is below it.** Measure that rather than estimate it (`docs/prototype/constraints.md`).
It is a deliberate future action, not something to build now.

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
  the version found, why it failed, and **whatever of the record could still be salvaged**
  — see below.
- `getOverview(id)` **throws** a typed error for a quarantined record rather than
  returning `null`. `null` already means *no such record*, and collapsing "broken" into
  "absent" is the silent drop again at single-record scale.

### Salvage, so the reader has something to do

The first draft of this design left the reader with nothing. The screen said the record was
still saved and a future update should restore it, and offered a way back to the library.
That is honest, and it is passive: they cannot fix it, retry it or read it, and "wait" is a
thin thing to tell someone about their own note.

**A record that fails `Overview.parse` almost always still has its video.** The failures
this exists for are missing or malformed *fields* — `durationMs` absent, `publishedAt`
unparseable — not corrupted blobs. So the quarantine read does a second, deliberately
minimal parse against a **salvage schema**: the id, `savedAt`, and the video's `url` and
`title` if they are there. `savedAt` earns its place for a reason that only shows up
downstream — the library orders by it, so a salvaged record without one has nowhere to sit —
and it is the field likeliest to survive, because the store writes it rather than the model.

Anything that survives that parse is enough to turn a dead end into a choice:

- **Watch it on YouTube.** The thing the overview was about is still reachable, and this
  costs nothing.
- **Generate it again.** A real recovery rather than a wait, at the price of a fresh run.

If even the salvage parse fails, the record degrades to an id and the screen says only what
it said before. Salvage is best-effort by construction, which is why it is a separate parse
rather than a relaxed version of the main one.

**Generating again is not free of consequence, and the copy should not pretend otherwise.**
It should reuse the quarantined record's salvaged id, so the separate state row — read,
favourite, user tags — stays attached rather than being orphaned under a new id. But
writing to that id replaces the quarantined record, which forecloses the later migration
that was the whole reason for keeping it. The new note is also written against today's
reader context, so it is a different note, not a restoration of the old one.

That makes regeneration the destructive option and watching the safe one, which is the
opposite of how the two would naturally be ranked.

**The prominence follows from that, and it resolves what looked like a layout problem.**
`ErrorState` takes one recovery action, rendered as a pill, and an optional back link, and
the distinction between the two is the invariant the whole screen is built on — which is why
"three controls on a screen built for two" read as the question. It is not. *Watch on
YouTube* is neither a recovery, since nothing is recovered, nor in-app navigation: the
two-shape system has no shape for **an action that leaves the app**, and that is the actual
gap.

The arrangement that needs no new shape:

- **Watch on YouTube is the pill.** It is the one thing the reader can still do about the
  thing they actually wanted, and it costs nothing.
- **Back is the link**, unchanged, with its existing surface-dependent wording.
- **Generate again is not a control on this screen.** It goes in the body copy as a sentence
  that says what it costs, carrying an inline link.

So the screen keeps one pill and one link, the safe action takes the prominent slot, and the
destructive one stops being a click away from destroying the record the screen exists to
explain.

### What the library does with one

The quarantine is surfaced per record, so the library has to show something per record.
Placing it is the easy half. Four things the library does to every record cannot be answered
for this one.

**Two counts already on screen would lie.** `LibraryPage` renders `{counts.total} overviews ·
{counts.unread} unread` in the list head and `{visible.length} of {counts.total} shown` in the
filter sheet's foot, where `counts.total` is `entries.length` in `libraryFilterCounts`. A
`listOverviews` that quietly excludes unreadable records puts the eleven-notes bug straight
into a visible integer: the library says 28 and means 30. So unreadable records are inside
`counts.total`, whatever else is decided.

**Ordering needs a date, which is why salvage takes one.** `orderOverviewsBySavedAt` sorts on
`savedAt`, so without it a record has no position and "in place" means nothing. Where even the
salvaged date is missing, the record sorts last: an unknown date cannot claim a position.

**It joins the reader's Previous/Next chain**, because `overviewNeighbours` shares that order
and the reader's "4 of 31" is a position in it. So *Next* can step onto the dead-end screen.
That is correct — a record in the library is in the sequence, and skipping it would be the
silent drop at navigation scale — but it means the reader has to survive its neighbour
throwing.

**Half the filters can be evaluated and half cannot**, and the split is not where it looks:

| Predicate | Read from | Evaluable |
|---|---|---|
| `status`, `favourite` | `state` — the separate overview-state record | **yes** |
| `topicId` | `overview.topicIds` | no |
| `novelty`, `dubious` | `overview.verdict` | no |
| the search query | `buildSearchHaystack(overview)` | no |

Read and favourite survive because overview state is its own record in its own store. For the
rest, including the record pollutes every filtered view and excluding it is a silent shrink at
filter scope. So it is excluded, and the exclusion is stated where the count already is —
*12 of 30 shown · 2 couldn't be read*. That is this document's own rule applied one level down.

**It stays out of `unsortedOverviews`**, which feeds `NewTopicDialog` with the overviews that
have no topics. An unreadable record has no *readable* `topicIds`, so it would present as
unfiled when it may well be filed — and filing it from that dialog would call `saveOverview`
on a record nobody can read, which the write rule forbids. It is not unsorted, it is unknown.
The same reasoning keeps it out of `byTopic`, so topic counts stop summing to `total`. That is
acceptable precisely because `total` is the honest number.

**The card is a sibling component, not a prop.** `LibraryOverviewCard` needs `overview.video`,
`overview.selling`, `overview.verdict`, `overviewMetaParts` and topic names, none of which
survive. It carries no read or favourite controls either — not because the write would be
unsafe, since the state row is readable and writable, but because marking read something that
cannot be read is absurd. It links to `Routes.overview(id)` like any other card, landing on the
older-format screen with the salvage actions, so the path needs no special case anywhere.

**The alternative, recorded because it is cheaper.** A separate section sidesteps the ordering
and the filtering by construction: no position to compute, and a section sits outside the
filtered list. It costs the honesty of position, and it makes the record read as a system
message rather than as one of the reader's own notes sitting where they left it. In place is a
judgement rather than a deduction.

### Why throwing costs almost nothing, checked against the call sites

This was the first open question and it is settled. `getOverview` has **one** production
call site — `overviewWithStateQuery` — so the fear that throwing would scatter error
handling across the app was unfounded.

`ReaderPage` already branches three ways on that query: pending renders a skeleton, `isError`
renders the dead-end screen, and absent renders `ReaderNotFound` ("That overview isn't in
your library"). The distinction between *broken* and *absent* is therefore already built,
already tested, and already on screen. Returning `null` would not avoid work; it would
collapse a quarantined record into "isn't in your library", which is false about a record
that is still sitting in the store.

An earlier draft of this document claimed the throw would be caught by
`RouterErrorBoundary`. **It would not.** The throw happens inside a TanStack Query
`queryFn`, which captures it into `query.error`; it reaches a React error boundary only
under `throwOnError`, which is not set. That is fortunate rather than a gap —
`RouterErrorBoundary` says "Reloading usually fixes it", and for a record that fails to
parse deterministically, reloading fixes nothing. The conclusion survives the correction;
the reason given for it did not.

`queryClient` sets `retry: 0`, so a deterministic parse failure is not retried three times
with backoff — which is the strongest generic objection to throwing inside a query.

**The constraint this puts on `ReaderPage`** — and this document had it wrong. It claimed
the page renders `overviewQuery.error.message` verbatim, and concluded that an
`UnreadableRecordError`'s message therefore has to be user-facing copy. Design turn 19
replaced that branch: `ReaderPage.tsx:112` now renders fixed copy, *"Couldn't load this
overview"* over *"Something went wrong reading it. Nothing has been lost."*, with a **Try
again** pill. No message reaches the screen.

So the message need not be human — but the branch has to split, and for a sharper reason
than copy. **A quarantined record must not be offered *Try again*.** Retrying a
deterministic parse failure is precisely the harm `docs/features/error-state.md` opens with:
the reader retries, gets the same screen, retries again, concludes the app is broken and
clears site data — destroying a record that a later migration would have recovered. The
transient case keeps its retry; the quarantined case gets the older-format screen and the
salvage actions above. The parse detail belongs on `cause`, for the console, either way.

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

## Writes are field-scoped, not whole-record

Migration on read has a consequence on the write side that is easy to miss and expensive to
discover late: **parsing on read is what makes a read-modify-write lossy.**

`IndexedDbOverviewStore.setOverviewState` (`IndexedDbOverviewStore.ts:80`) reads the current
state, spreads a patch over it, and puts the whole record back. Today that is harmless,
because object spread preserves keys it does not recognise — a field written by a newer
version survives an older client toggling `read`. `zod.parse` does not preserve them. It
strips.

So the moment the read boundary starts parsing, that spread begins writing back records with
unknown fields deleted, on a store this document calls irreplaceable and not regenerable at
all. **The lossy write is not introduced by sync. It is introduced by the parse** — which
puts the fix in the same change, locally, before any API exists.

The fix is to write the fields that changed rather than the record that contains them.

**The surface this applies to is much smaller than it sounds.** `saveOverview` has three
production call sites:

| Call site | What it is |
|---|---|
| `generationPipeline.ts:69` | a create — whole record, built fresh, nothing to clobber |
| `useSetOverviewTopicsMutation.ts:23` | `saveOverview({ ...overview, topicIds })` |
| `useCreateTopicMutation.ts:28` | `saveOverview(filedUnderTopic(overview, topic.id))`, which also touches only `topicIds` |

The last two are the same operation. **The entire read-modify-write surface of the
application is one mutation: setting an overview's topic ids.** Overviews are otherwise
write-once.

Which gives the API three endpoints rather than a patch language:

```
POST /overviews             whole record + schemaVersion
PUT  /overviews/:id/topics  { topicIds }
PUT  /overviews/:id/state   { read?, favourite?, userTags? }
```

Two of those already exist as `OverviewStore` methods in that exact shape, which is what
lets an API client implement the interface without a translation layer. And
`PUT /overviews/:id/topics` is the more honest contract regardless of versioning: topic
filing is topic filing, not "save this entire overview, which happens to differ in one
array".

**A generic patch document is rejected, and not for verbosity.** JSON Merge Patch uses
`null` to mean *delete this key*, and these schemas use `.nullable()` to mean *present and
null*. That is precisely the `undefined`-versus-`null` distinction this document opens with,
and inventing an encoding to disambiguate it — in the one place the design exists to make
absence unambiguous — is backwards. The endpoints above sidestep it by enumerating a closed
field set with no nullable member.

The cost, stated plainly: this holds while overviews stay write-once, and every future
editable field on an overview is another named endpoint. That tax is paid per product
decision, and it is one endpoint today.

**With no server yet, "field-scoped" means something specific.** A local store still has to
`put` a whole object — there is no patch endpoint to send anything to. The local rule is
therefore: **merge the patch into the raw stored record, never into the parsed one.**

Both offenders route their write through a read that will parse:

| Write path | Reads through | What the parse would delete |
|---|---|---|
| `IndexedDbOverviewStore.setOverviewState` | `getOverviewState`, merging over `DEFAULT_OVERVIEW_STATE` | any state field this client does not know |
| `IndexedDbSettingsStore.update` | `this.get()`, merging over `DEFAULT_SETTINGS` | any setting this client does not know |

Each needs a raw read on its write path. The API's patch endpoints are the remote expression
of the same rule rather than a different one.

While in there: `update` does `{ ...current, ...patch }`, so patching `sectionsEnabled`
replaces the whole nested object rather than merging into it. That is the nested-merge gap
this document notes as left open — confirmed in code, and the same change is its natural
home.

**`OverviewState` is the worked example of the whole principle.** `DEFAULT_OVERVIEW_STATE`
is merged over every read, so a field added tomorrow is already answered for every record
written yesterday — no chain, no fixture, no guard, and it works today. That generalises:
**a migration is only needed when a default cannot express the answer.** Adding
`lastPlayedAt` to state needs nothing. Adding `durationMs` to `Overview` needed a migration
because there is no defensible default for a duration.

**Parked, explicitly:** `userTags` and `topicIds` are set-valued, so a patch replaces the
whole array. Two devices tagging the same overview lose one set of tags. That is a
sync-merge question rather than a migration one, and it is the one place these endpoints do
not make concurrent writes safe.

## What happens when records start arriving from a server

These rules are easier to adopt now than to retrofit, and the forward-compatibility one is
close to unretrofittable: by the time two app versions are syncing, the wrong behaviour has
already written over someone's data.

### The server stores what it is given — but not for the reason first given

**The server stores each record at the version it was written and serves it back verbatim.**
It does not migrate on a client's behalf on read.

The reason originally given for this was that otherwise the same chain exists twice, in two
languages, and the two drift. **That reason does not hold.** `v1-architecture-decisions.md`
puts the API on Fastify — Node and TypeScript — so the chain is one shared package that the
clients and the server both import. There is no second language and no drift, and "who
migrates" is therefore a deployment choice rather than a correctness one.

The conclusion survives on better grounds: **the server cannot migrate downward.** A v5
record cannot be made into a v4 record for a client that only knows v4, because the
information to do it does not exist. The server could therefore never fully serve a lagging
client anyway, and the client has to own the chain regardless for its own local records.
Migrating server-side would be a second place the same code runs, solving no case uniquely.

One clarification, because "the server never migrates" reads as forbidding it outright: the
server may migrate **internally, to answer a query**, while still returning the record
verbatim at its stored version. Anything the API indexes or filters on has to be stable
across the supported range, or be normalised through the chain at query time. Those are two
different uses of the same code and both are legitimate.

### A client reads up to its own version, and no further

A record whose `schemaVersion` exceeds what this client knows is **held back**: kept,
counted and named on screen, but not rendered as an overview. The chain runs forward only
and cannot run into a version that has not been written yet.

The tempting alternative is to read it loosely — strip the unknown fields and carry on. That
is a data-loss bug waiting for its first write-back: this client saves, and the newer
client's data is gone.

An earlier draft softened the rule with a second integer, `minReaderVersion`, stamped by the
writer to mark a version as purely additive so that older clients could safely read past it.
**It is deliberately not adopted.** It requires a human to correctly judge "is this
additive?" at every version bump, forever, and a wrong judgement is silent — which is the
failure mode this document exists to remove, reintroduced one level up. *A client reads up
to its own version* is a rule that cannot be misapplied and can be tested exhaustively.

The cost is real and accepted on the evidence: a purely additive field makes every record
written after it invisible to a stale client. Against today's fleet that is measured in
hours (see below). It would be measured in weeks against a client whose updates are
store-reviewed and then declined by the user — so **if a mobile client is ever built, this
is the decision to reopen**, and not before.

The rule also removes a mechanism that would otherwise be needed. An unknown enum value —
`novelty` gaining a member — is a hard parse failure on a required field, taking a whole
record down where a renamed field merely leaves a hole. Forward-tolerant enum reads would
have to ship *before* the version that needed them, because forgiveness cannot be
retrofitted into a client already in the wild. Under the strict rule the case cannot arise:
a client never reads a record above its own version, so it never meets a value it has not
heard of. An unknown enum value inside a version the client *does* claim to support is
corruption, and quarantine is the right answer to that.

### A client may write to a record it can read

That is the entire write rule, and it follows from the one above. A stale client can still
create overviews at its own version and still patch state on records it can read, so it stays
useful offline and while out of date. It cannot touch a held-back record — which is right,
since marking something read that cannot be displayed is meaningless.

**This is enforced server-side, by comparing the stored record's version against the
caller's.** Not by client discipline: an old or faulty client cannot be trusted to police
itself, and this is the case where getting it wrong overwrites data that exists nowhere else.

Two consequences worth stating outright:

- **No client ever writes at a version other than its own maximum**, so the chain is
  forward-only and permanently so. Nothing ever needs to emit an older shape.
- **The server's store is permanently mixed, and that is the steady state rather than a
  rollout window.** "The current version" is a property of each record, never of the library.

### Two numbers on the handshake, and two different prompts

The API tells each client where it stands:

| Number | Meaning | What the client does |
|---|---|---|
| `minSupportedClientVersion` | below this, writes are refused | hard stop on the handshake — the wall, below |
| `currentSchemaVersion` | the highest version that exists | informational |

*Built as `currentClientVersion` (`docs/architecture/api.md`): there are four schema versions
now, one per record kind, and the number a client compares itself against is its own
`CLIENT_VERSION`. A number named after the wrong thing gets used as that thing, which is the
warning `sync-metadata.md` records about SQL Server's `timestamp`.*

The soft prompt fires **on encounter, not on the handshake** — "3 overviews need a newer
version", when records are actually being held back. It is the banner below; the hard one is
the wall below that. Prompting from the handshake alone nags
every user the day after a bump, including those whose libraries contain nothing new.

There is no third number telling clients which version to write at. An earlier draft proposed
one, so that an account could be held at an older write version until its slowest client
caught up. **Rejected: it makes the up-to-date device pay for the stale one**, and a client
left unopened would pin an account's schema indefinitely. A client that can write the latest
version writes it; a client that cannot is told to update.

### The stale client and the broken record are different screens

They look alike and behave nothing alike, and the first draft of this document filed the
first under the second.

| | Stale client | Broken record |
|---|---|---|
| Scope | global — every newer record | this one record |
| Cause | the app, not the data | the data |
| Action | update the app | watch on YouTube, or generate again |
| Lifetime | resolves itself on update | permanent until a migration is written |

One app-level banner with a count for the first; the per-record quarantine with salvage,
above, for the second. What they share is the rule that neither may silently shrink the
library: a held-back record is counted and named, never filtered away. A library that shows
28 of 30 and says nothing is `CLAUDE.md`'s eleven notes with a new address.

**Held back is a rendering decision, not a loading one.** `apps/extension/src/serviceWorker.ts`
asks `holdsOverviewOf(videoId)` to decide whether to offer generation on a video page. If a
held-back record drops out of that check, a stale extension offers *Generate* for a video the
user already has an overview for, and they pay roughly 30,000 tokens for a duplicate of
something already sitting in their own library. Existence checks see the whole store; only
the library list filters.

That function is `catch { return false }` today, so the same bug is already latent: any throw
from the read path — which parse-on-read will introduce — silently reports that the library
does not hold the video. The catch has to tell *no overview* apart from *could not tell*.

### Both kinds get a card; only one of them gets a button

A held-back record appears in the library exactly like an unreadable one, for the reason
that governs all of this: a library showing 28 of 30 with only a banner to hint at it is the
silent shrink with an extra step.

What differs is the screen behind the card, and by more than its copy. **For a held-back
record, *Generate again* is forbidden rather than merely destructive.** Regenerating writes a
record at this client's version over one written at a newer version — the precise clobber
*A client reads up to its own version* exists to prevent. It is not offered.

*Watch on YouTube* survives, which is worth noticing. The salvage parse wants `id`,
`savedAt`, `video.url` and `video.title`, and those are the fields least likely to have moved
in whatever bump caused the hold-back. So a record from the future is still watchable while
being unreadable.

That narrows what the banner is for. The cards already carry the count and the individual
records; the banner carries **the global cause and the one global action**, which no card can
sensibly repeat twelve times.

### Where the banner lives, and when it has a button

The shell already has the slot. `GenerationStatusStrip` sits inside `<header>` below the bar,
with `--masthead-height` measured and republished so everything downstream reflows. Same
slot, same solved geometry.

One thing does not carry over: that strip is `!isPanel`. **This banner cannot be**, because
the extension is precisely the client that goes stale and the panel is where its reader
lives. It needs a 400px treatment the generation strip never needed. The two can also
co-occur — generating a note while stale is ordinary — so they stack on the web, and in the
panel the banner outranks the strip.

**Dismissal is a third model, and neither existing one fits:**

| | Model | Why |
|---|---|---|
| `GenerationStatusStrip` | auto-dismisses after `READY_DISMISS_MS` | the condition resolves itself |
| The Plus notice | dismissal persisted in `Settings.plusNoticeDismissed` | a sales message: once refused, refused |
| This banner | **dismissed for the session only** | the condition does not resolve until the app updates, and what it reports is the reader's own data being invisible |

Persisting the dismissal would put the reader back in a quietly short library, with a stored
flag recording that they agreed to it. Never dismissing is punishing in a 400px panel used
daily. Session-scoped comes back until the thing is actually fixed, without nagging inside
one sitting.

**The action is present only where it can work**, which is this project's third habit rather
than a special case:

- **Web** — a reload, and the handshake can tell a stale tab that this is all it needs. A
  real button.
- **Extension** — a Chrome update the app cannot perform on demand, so usually there is no
  button and the banner degrades to information. Except when there is: `onUpdateAvailable`
  fires once an update is downloaded and waiting, and `chrome.runtime.reload()` applies it.
  So the button appears exactly when pressing it would do something.

**The two counts are never added together.** `listUnreadable()` already carries a reason per
record, so the banner counts the future-versioned ones and the library's "couldn't be read"
count takes the rest. One resolves on update and the other does not, so a single total would
describe neither.

### Below the write floor is a wall, not a banner

`minSupportedClientVersion` is a different severity and gets a different shape: **the whole
page**, replacing the app.

The justification is not that reading stops — it does not. Below the floor the server refuses
*writes*, so the local library still reads perfectly well. It is that every action fails:
no new overview, no topic filing, no marking read. The sharpest case is `+ New`, which would
spend roughly 30,000 tokens before the rejection arrives. An app whose every control fails at
the end is worse than an honest wall in front of it, and a banner over a working-looking app
invites exactly that.

The cost is stated rather than hidden: a full page takes away a library the reader could
still have read. That is the trade, taken deliberately.

The shell already replaces the whole tree twice — `StartupFailure` and `OutOfDateTab`, both
exported from app-core and rendered by both shells. **This one renders in place of
`<Outlet />` rather than outside the router**, which is the one departure from that
precedent and buys something: `docs/features/error-state.md` records that `OutOfDateTab` must
never be given a back link, because a `<Link>` with no router around it throws. Here the app
is intact and only writes are refused, so the wall can carry links like anything else.

Its action follows the same can-it-work rule, with one more option than the banner has:

| Surface | Action |
|---|---|
| Web | **Reload** — always available, always sufficient |
| Extension, update waiting | **Update now** — `chrome.runtime.reload()` |
| Extension, no update waiting | **Open extensions** — `chrome.tabs.create({ url: "chrome://extensions" })`, which a web page cannot do and an extension can; `tabs` is already in the manifest |

That last row is the reason the wall is better than a banner here. It can give instructions
and take the reader to the place the instructions are about, which a strip above a working
app has no room to do.

### The update button never kills a generation

That button can appear while a generation is running, and the intuition that it should warn
before cancelling turns out to be backwards. Three facts from the code decide it.

**Cancellation is not a refund.** There is no `AbortSignal` anywhere in `packages/generation`
or `features/newOverview`: `RunOverviewGenerationOptions` carries `onProgress` and
`isCancelled` and nothing else, and `stopIfCancelled()` is checked at exactly two points —
after `resolveVideo` and after `generateOverview`. Cancelling during the model call does not
stop it. It discards the answer.

The roughly 30,000 tokens are spent the moment `generateOverview` is called, so the choice is
never *spend them or don't*. It is **whether the note the money already bought gets written**,
and killing the run means it bought nothing.

**A run in flight survives the wall, by construction.** `useNewOverviewRun` is owned by
`AppShell`, above `<Outlet />`, deliberately so that a run outlives the dialog it was started
from and every navigation after it. The wall replaces `<Outlet />` rather than the tree, so
the shell stays mounted and the run keeps going. That placement was chosen above for an
unrelated reason — `OutOfDateTab` cannot carry links — and this is the second thing it buys.

It matters because `minSupportedClientVersion` refuses *server* writes. The local IndexedDB
write still lands, so a run finishing below the floor still produces a usable overview that
syncs once the app updates. Tearing it down would destroy something that was going to work.

**Nothing is resumable, and the code invites the opposite assumption.** `NewOverviewRun` is
React state in whichever page holds the shell. The `RunReport` in `chrome.storage.session`
looks like durable run state and is not — it is status, `progressFraction` and ids for the
injected button to paint with, by design. There is no work in it to resume. What *is* durable
is the transcript: `resolveVideo` saves it before generation starts, so a killed run does not
pay for it twice. That is already the ceiling of what survives.

So the button is **disabled while a run is active**, naming what it is waiting for. The status
strip is already rendering that run's elapsed time beside it, so the reason needs no
explaining.

**The escape is a control already on screen**, which is what makes disabling safe rather than
a trap: `dismiss()` bumps `runIdRef`, which makes `isCancelled` true and clears the run. A
wedged generation therefore never blocks updating permanently. But the copy must not pretend
that click saves anything — it neither refunds nor aborts, it only unblocks. *"Waiting for the
overview you're generating — dismiss it to update now"* is honest about abandoning a result
rather than cancelling a cost.

Two alternatives, both rejected:

- **Confirm and kill** — "updating will cancel your generation" offers a saving it cannot
  deliver, and puts a modal on top of a wall.
- **Update automatically once the run finishes** — invisible deferral. If the run wedges, the
  update silently never happens and the reader is left believing they actioned it.

**What would make this a non-question**, named so it is not rediscovered: an `AbortSignal`
threaded through `generateOverview` so that cancelling stops the request, and persisted run
state so that a reload can resume one. Both are generation work rather than migration work,
and the second is a large change for a case measured in minutes a year.

### How stale a client can actually get

The strict read rule is affordable only because this fleet updates quickly. That is a
property of today's clients rather than a law, so it is worth recording what it rests on.

| Client | Cost to update | Notes |
|---|---|---|
| Web app | one reload | `apps/web` is a plain Vite SPA — no service worker, no PWA plugin, and no dynamic imports anywhere, so one bundle and fresh hashed filenames per deploy |
| Extension | hours, on Chrome's schedule | `chrome.runtime.onUpdateAvailable` with `chrome.runtime.reload()` stops a running service worker holding the old version until Chrome's idle heuristic fires |
| Mobile | days to months | does not exist, and is the reason `minReaderVersion` is recorded above rather than deleted |

Two changes would quietly reintroduce the multi-refresh update problem, and both read as
improvements at the time:

- **`index.html` must revalidate.** Hashed assets can be `immutable`; the HTML cannot. When
  the Fastify API serves the SPA, a blanket `maxAge` added for performance would hand back
  stale HTML pointing at deleted bundles.
- **Adding offline support to the web app** brings it back by definition, and is plausible
  here given the local store is already offline-capable.

The residual case that no caching policy causes is a tab nobody reloads. That costs a click
to fix, which is why a web client is nudged to reload rather than treated like one that has
to be reinstalled.

## Not every schema change is a migration

The useful distinction is not additive versus breaking. It is **derivable versus not** —
whether a pure function of the record has the information to produce the new shape.

**Renames are derivable.** `{ ...record, newName: record.oldName }`, drop the old key. Free
locally. Not free across a fleet: to a client that has not been updated the field simply
vanishes, which reads as an absent field — the trap this document opens with. The
deprecation window is what the write floor is for. Write both names for a release, raise
`minSupportedClientVersion` past the old one, then drop it.

**One-to-one enum remaps are derivable.** `"established"` becoming `"familiar"` is a
three-line migration.

**Splits are not derivable, and no mechanism makes them so.** This is not hypothetical.
`Novelty` is `["novel", "established", "recycled"]`, and `docs/prototype/open-questions.md`
records both that 23 of 30 notes sit in `established` and that the scale probably wants
replacing with two axes. Split that bucket and nothing in the record says which side each
note belongs on. A migration cannot invent the information.

That is a third category which "it does not correct wrong data, only absent data" misses.
The data is neither wrong nor absent — it is **superseded**. Three honest options, none of
which is a migration:

| Option | Cost |
|---|---|
| A `legacy` member in the new enum | every record preserved, the UI can say "rated on the old scale", the bucket shrinks over time — at the price of a permanent member of the domain type that nothing new ever writes |
| Regenerate | a real answer, at roughly 30,000 tokens per video against a reader context that has since moved, so a different note rather than a restored one |
| Dual-field — the new verdict starts null, the old one stays | `verdict` is already `.nullable()` and `thin` already means *no verdict*, so the type tolerates this today with no change at all |

For the verdict scale specifically the third is the cheapest honest answer, because it does
not force a decision about 23 records in order to buy a schema change.

**Migrations must satisfy invariants, not just field shapes.** `Overview.superRefine` holds
that a `thin` overview never carries a verdict, so a remap that leaves a verdict on a thin
overview produces a record that fails to parse. That is the desired behaviour rather than a
gap: because migration output goes through the same parse, an invariant-violating migration
surfaces as a quarantined record and a failing corpus test, not as corruption.

## The corpus is what stops the chain rotting

Migration code is uniquely prone to silent rot: it runs only against data nobody has
locally, so it can be wrong for months. Three checks, each catching a different mistake.

**1. A fixture pair per migration.** The record at version *n−1* and the record it must
become at *n*, checked in as JSON and asserted exactly. This is where *the rename happened*
and *everything else was left alone* both get stated.

**2. A cumulative test driven off the registry.** Walk the ordered migration list, feed each
migrator the canonical record for the version below it, and snapshot the result. Because the
canonical records come from a per-version lookup, **registering a migrator without adding its
reference record fails immediately** — which turns *adding a field means adding a fixture*
from a remembered rule into a test failure. Snapshotting rather than asserting one end state
also means an unintended change to any link in the chain surfaces as a diff, rather than as a
record that still happens to parse.

**3. A store-level check that the chain is actually run** — that a given `OverviewStore`
migrates on read rather than handing back raw rows. That is a behavioural property of an
implementation rather than of the chain, so it is the only one of the three belonging in
`packages/store-conformance`, where the IndexedDB store and the eventual API client both
inherit it. It needs one old fixture, not the corpus.

The first two are pure functions over JSON with no store involved, and belong beside the
chain. An earlier draft put all three in `packages/store-conformance`, which was one test's
home applied to three different tests.

**The fixtures are curated, not captured.** An earlier draft proposed pulling real records
from a dev profile at each version, on the precedent that this project tests against real
content rather than invented fixtures. That precedent does not carry. The job here is to
exercise *every field at every version*, which a curated record guarantees and an arbitrary
real one does not — `samples/` exists to test product logic against real variance, which is a
different job. And `samples/records/*.json` are the prototype's shape (`file`, `claim`,
`try`, `watchFlag`, `speech`), not `Overview` records, so there is nothing there to seed a
corpus from in any case.

Curating also dissolves the personal-data question rather than answering it: no dev profile
is harvested, and the settings fixture's `readerContext` is written rather than being
someone's real self-description.

## Prior art, and what was deliberately not taken from it

This design is modelled on a production event-schema migration mechanism that has been
running for thirty versions — the best available evidence both that the shape works and that
a chain of thirty tiny migrators is survivable rather than alarming.

**Taken from it:** the forward-only numbered chain; the version stamped on the blob; the
migrator precondition that refuses a record at the wrong version; the registry-driven
cumulative snapshot test; the no-op migrator for an additive bump. And, as corroboration
rather than borrowing: it hides records a client is too old to read and tells the user to
update — with an out-of-sync toast, and for purely additive bumps too, which is the same
trade *A client reads up to its own version* makes here.

**Not taken**, because roughly half of that mechanism's weight answers a constraint this
project does not have. Its backend is Kotlin and cannot import the TypeScript migrators:

| Theirs | Why it exists there | Here |
|---|---|---|
| The migrators esbuilt to a JS bundle and run from Kotlin on GraalVM | the server cannot import TypeScript | the Fastify API imports the package |
| A JSON Schema file per version, loaded and validated at startup | Kotlin needs a schema language it can read | the zod schemas are the schemas, on both sides |
| The current-version constant duplicated in TypeScript and Kotlin | two languages | one constant, one package |
| Build wiring so that touching a migration reruns the backend's tests | two build systems | one test run |

Also not taken: its handling of an unreadable blob, which filters the blob out of view and
logs it. That is proportionate for an event — losing one event from a projection is not
losing a note. An `Overview` *is* the content, at roughly 30,000 tokens against a reader
context that has since moved, which is why quarantine and salvage exist here and have no
counterpart there.

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
- **It does not perform changes that are not derivable from the record.** Renames and
  one-to-one remaps are migrations; splitting a bucket is a product decision wearing a
  migration's clothes. See *Not every schema change is a migration*.

## Rejected alternatives

**Make every progressively-added field `.optional()` and guard at each call site.** This
is the status quo. It is what produced the three bugs above. Rejected on the evidence.

**Use a library's versioning (Dexie's `.upgrade()`, or similar).** Its migrations are
keyed to the *database* version and run eagerly inside the upgrade transaction — both of
this design's rejected answers, and neither reachable for a record that arrives over an
API. It would also be a dependency in service of roughly a hundred lines.

**Store nothing; regenerate on demand.** ~30,000 tokens per video, against a reader
context that has since moved on, for a record the user may have annotated. No.

**A generic patch document for writes.** Merge-patch's `null`-means-delete collides with
`.nullable()` meaning *present and null*. Three named endpoints instead — see *Writes are
field-scoped, not whole-record*.

**A server-set write version, holding an account at its slowest client.** Makes the
up-to-date device pay for the stale one, and a client left unopened pins the schema
indefinitely.

**`minReaderVersion`, marking a version additive so older clients may read past it.** One
integer, and a silent failure whenever the judgement behind it is wrong. Reopen only if a
store-reviewed client is ever built.

## Open questions

**None remain in this document.** The last of them — what the update button does to a
generation already running — is answered in *The update button never kills a generation*, and
what is left over belongs to generation rather than to migration: an `AbortSignal` threaded
through `generateOverview`, and persisted run state. Both are named there and neither is
built.

That is a statement about this design being argued through, not about it being right. The
list below records what each answer rests on, so that a wrong one can be found and reopened
rather than inherited.

**Settled by narrowing what the banner is for: it carries the cause and the one global
action, because the cards carry everything else.** Held-back records get library cards like
any other unreadable record, so the count is already on screen — which leaves the banner the
job no card can do twelve times over. Its button appears only where pressing it would work,
and below the write floor it stops being a banner at all: an app whose every control fails
after the fact is worse than an honest wall in front of it.

**Settled by working through what the library does to every record: the unreadable one is
a card in place.** The placement was never the hard part — see *What the library does with
one*. What decided it was that two counts already on screen would under-report, that ordering
needs a salvaged `savedAt`, that only the filters reading overview *state* can be evaluated at
all, and that `unsortedOverviews` would otherwise offer to file a record nobody can write to.

**Settled by renaming the package: the chain lives in `packages/domain`, next to the schema
it migrates.** The premise of the whole design is that the decision about an absent field is
made where the field is added, and a separate `packages/migrations` would make that a
two-package change forever. The objection was never to the structure — it was that a package
called `types` had stopped being one, which `DEFAULT_OVERVIEW_STATE`, `DEFAULT_SETTINGS` and
`Overview.superRefine` had already made true. So the name moved rather than the code.

**Settled by salvage: the quarantine is surfaced per record, not as a count.** That was
the first open question here, and offering anything to do about a stuck note answers it —
a count can offer neither a video nor a regeneration, because it does not know which note
it is talking about.

**Settled by ranking the salvage actions: the screen keeps one pill and one link.** "Three
controls on a screen built for two" was the wrong question. *Watch on YouTube* is neither a
recovery nor in-app navigation, so the gap was a missing shape for an action that leaves the
app — closed by making watching the pill and leaving regeneration to the body copy, which
also stops the destructive option being the prominent one.

**Settled elsewhere, and worth not re-asking: settings' fallback to defaults is a
dismissible notice, not a dead end.** `docs/features/error-state.md` decided that
deliberately — replacing a page that still works with a dead end would stop the reader
fixing the very thing being reported. What is missing is only the component:
`components/shared/` has no notice.

**Settled by the argument recorded above:** that writes are field-scoped rather than
whole-record, and that the endpoints are three named ones rather than a patch language;
that a client reads up to its own version and no further, holding back and counting what it
cannot read; that a client may write to any record it can read, enforced server-side; that
the handshake carries two numbers and not three; and that a change which is not derivable
from the record is a product decision rather than a migration.

**Settled by the migrator precondition: the chain is untyped, and no historical schemas are
kept.** The question was what checks that one migration's output is the next one's input.
A runtime guard at each seam answers it for the cost of one comparison, where frozen
per-version schemas would answer it for the cost of copying the whole record tree every time
a field moves.

**Settled by curating the corpus: whose dev profile the fixtures come from does not
arise.** Nobody's.

## When to build it

`v1-architecture-decisions.md` set the trigger at "real users or a synced paid tier,
whichever is first," and neither has happened. That trigger now applies to less of this
document than it did, because the mechanism has split into two pieces with different
triggers.

**Be honest about what the local half catches today: nothing.** Every record in every store
was written by the current schema, because there has only ever been one. Parse-on-read would
quarantine approximately nothing, and the three bugs at the top of this document are evidence
that reads should be validated — not evidence that anything is broken right now.

It is still worth building, for two reasons that are not "it finds bugs":

1. **The clobber fix has to land with the parse**, and only the parse makes it necessary.
   Shipped apart, there is a window in which `setOverviewState` and settings `update` are
   silently lossy.
2. **It makes the failure path exist and be tested before there is data to lose.** The first
   migration is a bad time to discover what `listOverviews` does with a record it cannot read.

The order, then:

| | |
|---|---|
| **First** | `Overview.parse` on both read paths; raw-merge writes in `setOverviewState` and settings `update`; `listUnreadable()` on the interface, with the conformance suite and the in-memory test helper following; `ReaderPage` branching on `UnreadableRecordError` with no retry |
| **With it, cheaply** | the salvage parse and the older-format screen — its copy is already written in `docs/features/error-state.md`'s table |
| **After** | the library's per-record surfacing, and the settings notice component |

The last row defers safely: with no unreadable records, both render nothing at all.

**The versioned half waits for the API**, and the original argument for pre-empting it
stands: `schemaVersion` has to exist on the Postgres row and in the API contract, and
defining it after those exist means reconciling two schemes rather than designing one. The
read rule in particular is close to unretrofittable — by the time two app versions are
syncing, the wrong behaviour has already written over someone's data.

The counter-argument is the same one the original note made, and it has not weakened: the
whole corpus today is a handful of local dev records belonging to the people who wrote
them, and nothing is released.
