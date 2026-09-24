# Sync metadata on stored records

One field — `updatedAt` — stamped onto every synced record in the same write as the data,
beside `schemaVersion` and invisible to the domain type for the same reasons.

This is the second of the two things `docs/features/record-migrations.md` says have to be
settled before the API exists. That document settled the first: which *shape* a record is in,
carried on the record so it still means something once the record has travelled. This one
settles *when it last changed*.

It was argued with after it was built, which is why several sections below are narrower than
they first were. Where a conclusion survived an argument that removed the reason originally
given for it, that is said rather than quietly tidied away.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The key, the reader, and the stamp | `packages/domain`: `storedUpdatedAt`, `stampUpdatedAt` |
| One stamp for the write seam, carrying both numbers | `packages/domain/src/stampStoredRecord.ts` |
| Every local write path stamped | `packages/store-local`: the overview store's four writes, the settings store's one |
| Read back without it, because zod strips it | the existing `readStoredRecord`, unchanged |

Nothing reads `updatedAt` yet. That is true, and the next section is the honest version of
why it is worth writing anyway.

## Why now, and why the first answer was too strong

The first draft of this document argued that the field was needed *because* the three named
endpoints in `record-migrations.md` merge partial writes, and a server merging a state patch
has to know whether the client's copy is newer than the stored one. **That argument does not
carry the weight it was given.** A server cannot trust a client's clock anyway, the
conventional mechanism for that job is a revision number rather than a date (below), and the
job of finding what to push is better done by an outbox (below again). On the merits, this
field is **not necessary for a correct sync**.

What survives is an asymmetry, and it is enough on its own:

**A timestamp is the only piece of this metadata that cannot be backfilled.** Every
alternative can be introduced later at full value, because each is a fact about a record's own
history and that history is uncontested until two devices share a record. A revision counter
can truthfully start at 1 for every existing record on the day the API ships. A content hash
can be computed retroactively over records written years earlier. An outbox starts empty and
is immediately correct.

A modification time is a fact about the *world*, not about the record's history, and it stops
existing the moment a write completes without it. There is no honest value to backfill:
stamping every existing record at the moment sync is switched on is a lie about all of them.

So this is **insurance against an irreversible loss, not a load-bearing part of the sync
design** — bought for one key per record, five call sites, and no change to how anything
behaves. It is worth being precise about that, because a field nobody reads is otherwise the
storage-layer cousin of the control that cannot work which `CLAUDE.md` forbids on screen.

The cost of having waited is already visible: every record written before this landed is
permanently undated.

## What each record gets, and the one that gets nothing

| Record | Synced? | Stamped | Mutates in place? | Already dated? |
|---|---|---|---|---|
| `OverviewState` | yes | yes | **constantly** — read, favourite, tags | **no date at all** |
| `Settings` | yes | yes | whenever settings are edited | **no date at all** |
| `Overview` | yes | yes | once — topic filing | `savedAt`, at creation |
| `Topic` | yes | yes | **never**, today | `createdAt` |
| `StoredTranscript` | **no** | **no** | on refetch | `fetchedAt` |

**The rows are in order of how much the field earns its place, and the order is the opposite
of the intuitive one.** The overview is the record a reader thinks of as *the* record, and it
is close to write-once: `savedAt` already dates its creation, and the only in-place write is
filing it under a topic. `OverviewState` is the one that actually changes — every mark-as-read,
every favourite, every tag — it carries no date at all today, and `record-migrations.md` calls
it "irreplaceable and not regenerable at all — read, favourite and user tags exist nowhere
else". It is also where cross-device contention will first show up, because marking something
read on one device and favouriting it on another is an ordinary Tuesday.

**The overview's low ranking has an expiry date, and probably a short one.** It ranks third
only because an overview is close to write-once *today*. `v1-architecture-decisions.md` parks
a future iteration in which a reader takes their own notes on a video — the reason the word
"note" was deliberately left unused by the domain type — and an overview that carries
reader-edited text stops being write-once the day that ships. At that point `updatedAt` is no
longer bookkeeping on this record: it is the field that answers *edited when*, on screen, and
the one a reader would expect to sort their library by. The ranking below is a statement about
what the records do now, not about which of them will end up caring most.

**`Topic` is stamped for the rule rather than for today's value, and that is a deliberate
trade.** There is no rename and no delete: `createTopic` and `listTopics` are the entire topic
surface, and the reader's "edit topics" control edits an *overview's* topic ids, not the topic.
So a topic's `updatedAt` is identical to its `createdAt`, always, until a rename exists. It is
stamped anyway because *every synced record carries one, caches do not* is a rule with no
per-type judgement in it, where the alternative is a judgement that has to be remade every time
a record type gains a write path — and the day a topic rename lands is the day every topic
written before it becomes permanently undated. One key on a record created a handful of times
per library is the cheaper side of that bet.

**The transcript row is not an omission.** A transcript is not a per-user record that two
devices could hold different versions of — it is YouTube's own caption track, identical for
everyone who fetches it, which is why the paid tier's shared transcript cache is a *cache*
rather than a synced collection. There is no "which side is newer" question to answer, and
`fetchedAt` already answers the only temporal question a cache has, which is whether its
contents are stale. It is also the one store that discards rather than quarantines, for the
same underlying reason: it is cheap to replace.

## It rides beside `schemaVersion`, and zod removes it again

The stored shape gains one more key and the domain type gains nothing:

```
{ id, video, savedAt, …, schemaVersion: 2, updatedAt: "2026-09-24T09:15:00.000Z" }
```

Every argument `record-migrations.md` makes for keeping `schemaVersion` off the `Overview`
type applies here without modification: `Overview.parse(stored)` is both the validation and
the strip, so the generation pipeline, the test factories, the prompts and the conformance
suite's `deepEqual` all keep working against a type with no such field on it. A record's
modification time is a fact about the record's *storage*, not about the note — it belongs
exactly where `schemaVersion` belongs.

The reader is the mirror of `storedSchemaVersion`, and the sync engine is the caller it is
waiting for. That caller reads raw records already: `IndexedDbOverviewStore`'s `#writable`
does precisely this today, because merging a patch into a parsed record is what the
field-scoped write rule forbids.

**Absent means older than everything.** A record written before this existed has no such key,
and the rule for it is uniform rather than per-type: `storedUpdatedAt` returns `null` and the
sync engine treats a `null` as preceding every stamped record. An overview's `savedAt` would
be a slightly better answer for that one type — nothing has ever updated an overview in place
except topic filing — but a rule that is uniform cannot be misapplied, and the first sync
pushes everything regardless, which is the only moment the distinction could matter.

## Every stamp is UTC, and that is the whole of the time-zone question

`stampStoredRecord` defaults its clock to `new Date()` and `stampUpdatedAt` writes that
through `toISOString()`, which always emits UTC with a trailing `Z`, always at fixed width:
`2026-09-24T09:15:00.000Z`, twenty-four characters. Two
consequences, both load-bearing:

- **The stored value is an absolute instant.** A reader who flies to Tokyo, or whose clock
  crosses a daylight-saving boundary, changes nothing about a record written before the trip.
  Local time appears nowhere in storage. If a screen ever shows "edited 3 days ago", storing
  UTC is precisely what lets `Intl` render it correctly in whoever's zone is reading it.
- **String comparison is chronological comparison**, because the format is fixed-width and
  the offset is always `Z`. The conformance-adjacent tests in `store-local` compare these as
  strings deliberately rather than parsing them back into dates.

**The rule that keeps the second property true: UTC, or it is not an `updatedAt`.** This is
worth writing down because nothing enforces it — `updatedAt` is not part of any zod schema, so
nothing validates its format, and `z.iso.datetime()` permits a numeric offset unless told
otherwise. Today `stampUpdatedAt` is the only writer in existence and it cannot produce
anything else. The moment a value can arrive from the server or from a fixture, an offset form
like `+01:00` would be the same instant and would compare wrongly as a string.

**Time zones are not clock skew.** A device whose clock is simply wrong is a separate problem,
it is not solved by UTC, and it is bounded rather than fixed — see below.

## The write seam stamps; the migration seam does not

There are now two stamps in `packages/domain`, and the split is deliberate rather than a
duplicate to be tidied away:

- `stampSchemaVersion` belongs to **migration**. `applyRecordMigration` uses it to mark a
  record as having moved one step along the chain. Migration on read is pure and does not
  write back, and a record does not change because it was read through a newer chain — so it
  must not acquire a new modification time by being read.
- `stampStoredRecord` belongs to **writing**, carries both numbers, and is what every store
  write path calls. A write cannot carry a version without also carrying a time, because there
  is one function that produces both.

That is the same shape as the rule `record-migrations.md` enforces with method signatures
rather than instructions: the thing that must not be forgotten is not documented, it is made
unavailable.

## Three numbers, three jobs

`record-migrations.md` opens by warning that conflating two version numbers is the trap most
implementations fall into. Sync adds a third, and the line between them is worth stating before
the API is written rather than after:

| Number | Describes | Moves when | Assigned by |
|---|---|---|---|
| `schemaVersion` | the record's **shape** | a field is added, removed, or changes meaning | the writing client |
| a revision (`rev`) | the record's **content** | every accepted write | **the server** |
| `updatedAt` | **when**, for humans | every write | the writing client, preserved verbatim by the server |

Only the first exists today. The second is the conventional mechanism for the job this
document's first draft tried to give to the timestamp, and it belongs to the API:

**A per-record integer revision, server-assigned, compared on write.** That is HTTP's own
`ETag` + `If-Match` (RFC 9110): the client reads at `rev: 5`, writes back with `If-Match: 5`,
and the server refuses if the record has moved on. No clock is trusted anywhere in that
exchange. Alongside it, a **server-assigned monotonic sequence as the pull cursor** — "give me
everything since X" — which is CouchDB's `_seq` and the shape most sync engines converge on.

The prior art is unusually consistent, and one entry is a direct warning:

| System | Conflict token | Note |
|---|---|---|
| HTTP | `ETag` / `If-Match` | `Last-Modified` is explicitly a *weak* validator — one-second granularity |
| CouchDB / PouchDB | `_rev` per document | plus `_seq` as the replication cursor |
| SQL Server | `rowversion` | a monotonic counter; the docs are emphatic it is not a datetime |
| Hibernate | `@Version` | accepts a timestamp, and the documentation recommends the numeric form |
| Rails | `lock_version` | integer |
| Firestore | `updateTime` precondition | a timestamp, but **server**-assigned, never the client's |

SQL Server's is the instructive one: the type was originally called `timestamp`, that name
caused exactly this confusion, and it was renamed `rowversion` with the old name deprecated.
**A version named after time gets used as time.**

Why an integer beats a date for that job, concretely: there is no clock to be wrong, two writes
in the same millisecond are distinguishable where an ISO string at millisecond precision
silently is not, and comparison is total and unambiguous.

### The client's value is the one that is kept

**The server stores the `updatedAt` it is given and never replaces it with its own clock.**
The field then means one thing everywhere it appears: *when the reader made this edit, on the
device they made it on* — including an edit made on a plane and pushed two days later.

The alternative — the server stamping its own time on acceptance, which is Firestore's
convention and most ORMs' default — answers a different and less interesting question: when
the account first heard about a change. That fact is already covered, and covered better, by
the two numbers above it in the table: the revision moves on every accepted write, and the
pull cursor is a server sequence. Re-stamping would spend the only human-facing field in the
record on a fact the plumbing already records, and it would silently destroy the offline case,
where the gap between the edit and the push is exactly the thing worth knowing.

**This is only safe because the field is not the mechanism.** A client-supplied value is
untrusted by definition: a device with a wrong clock writes a wrong date and nothing corrects
it. That is tolerable for something read by people and nothing else, and it would be a
correctness hazard the moment anything depended on it — which is the sharpest practical reason
to keep the conflict token a server-assigned revision rather than a date.

Two consequences to build against:

- **A server-side timestamp of its own is welcome; it just must not be this column.** When
  the row was stored is a real and useful fact — for support, for debugging, for knowing what
  the account has actually seen — and Postgres is the right place to record it. The rule is
  narrow: the trigger, ORM hook or `@UpdateDateColumn` that would ordinarily populate
  `updated_at` writes to a separate column instead, named so the two cannot be confused. The
  failure to watch for is quiet rather than loud — if the default wiring is left pointing at
  this column nothing looks broken, and every offline edit simply reports the moment it was
  uploaded.
- **Sorting by it is expected, with the precision it actually has.** Ordering a library by
  when things were last touched is an obvious thing to want, and this is the field for it. Two
  records touched on two devices carry two clocks, so the order is only as good as the worse of
  them — which for a personal library is a non-problem: an overview appearing a few seconds or
  minutes out of true order costs nothing, and nothing downstream makes a decision on it. If
  an exactly-ordered sequence is ever needed — paging a changes feed, say — the server's
  sequence is the field that is genuinely ordered, and it exists for that. Note that a
  *different time zone* never causes this, because every stamp is UTC; only a clock that is
  actually wrong does.

**None of which makes `updatedAt` unconventional.** `updated_at` is near-universal in
production schemas — as audit and display metadata, almost never as the concurrency token.
Those are compatible facts. This field is conventional as what it is; the error would be
building the sync algorithm on it, which is what the rest of this document exists to prevent.

## The outbox, which is deferred rather than rejected

The conventional **client-side** answer to *what have I changed since I last pushed* is not a
timestamp comparison either. It is a dirty marker or an append-only outbox — WatermelonDB's
`_status`/`_changed`, Replicache's mutation queue. Every local mutation appends
`{ kind, id, op, at }` to a log in the same transaction as the write; push drains the log and
deletes what the server acknowledges.

It is worth being clear about how well it does: an outbox entry written in the same transaction
as the data is atomic, so it does not suffer the dirty-flag problem below; it gives the exact
change set rather than one inferred by scanning the library; and — the part that matters most
here — **it records deletions**, which is the one thing a per-record field cannot do, because
a deleted record has nothing left to stamp.

So the outbox is not an alternative that lost. It is the client half of the sync engine, it
arrives with the API, and it subsumes both the push set and the tombstone question below. What
it does not do is date anything retroactively, which is why it does not remove the reason this
field landed first.

## Deletions, and why they can wait

A deletion is the one local change with nothing left behind to stamp, so it is the obvious next
thing to ask about. It is deferred, and unlike the timestamp the deferral costs nothing:

**Before sync exists, no two devices share a record, so no deletion can be resurrected.** A
record deleted today exists on exactly one device and is gone from it. The extension and the
web app already keep separate libraries — different origins, different IndexedDB — but they
have never held the same record, because ids are minted per creation. There is no copy anywhere
for a missing tombstone to let back in.

Deletions therefore become necessary at exactly the moment a record first exists in two places,
which is the moment sync is built, and they are cheap to add then: a deletion is not a record
shape, so introducing one needs no migration. Whether they arrive as dated tombstones on
`deleteOverview` or as `op: "delete"` entries in the outbox is a decision for that change — the
outbox form is the more likely one, since it needs no second mechanism. What is settled either
way is that **deletion is never inferred from absence**, which cannot distinguish "deleted
here" from "not pulled yet".

## What this does not fix

- **Clock skew.** `updatedAt` is a wall clock and wall clocks are wrong. A device corrected
  backwards mid-session writes a record that looks older than one written before it. The
  consequence is bounded — the pair *(this record's `updatedAt`, this device's last push)*
  comes from one clock, so a backwards jump between them can leave a change unpushed until the
  record is touched again — and the fix, if the symptom ever appears, is a device-local
  monotonic counter stamped in the same write and compared as an integer. Named here so it can
  be reached for rather than rediscovered, and not built, because it costs a durable allocator
  and a cross-store transaction to solve a problem nobody has reported. Measure it rather than
  pre-empt it (`docs/prototype/constraints.md`).
- **The set-valued merge, and it cannot.** `userTags` and `topicIds` are arrays, and
  `record-migrations.md` parks the fact that a patch replaces one wholesale, so two devices
  tagging the same overview lose one set of tags. A per-record timestamp makes that loss
  *attributable* rather than preventable: merging sets needs per-element information — when each
  tag was added, and whether a tag's absence is a removal or an ignorance — which no amount of
  record-level dating supplies. The fix is a different shape of data, not more of this one.
- **The first sync between two libraries.** Two devices that each generated an overview of the
  same video hold two records with different ids and no relationship. That is a duplicate rather
  than a conflict, dates will not resolve it, and what the library should do about it is open,
  below.
- **Anything already written.** Every existing record is undated forever.
- **The need for the server to be authoritative.** A client stamps its own writes, and a client
  can lie or be wrong. Anything the server enforces — the write floor in `record-migrations.md`,
  and whatever conflict rule the API settles on — is enforced against the stored record, not
  against what a client claims about it.

## Rejected alternatives

**A dirty flag instead of a timestamp.** It answers *has this changed since the last push* more
directly and it is a boolean rather than a date. Rejected because it has to be cleared by a
second write after the push succeeds, which means the flag and the data can disagree — a crash
between the push and the clear leaves a record permanently dirty, and a clear that lands before
a concurrent write leaves one permanently clean, which is silent data loss. An **outbox** is
the version of this idea that does not have the problem, because its entry is written in the
same transaction as the data; it is deferred rather than rejected, above.

**A revision counter instead of a timestamp.** Not rejected as a mechanism — it is the better
one for conflict detection, and the API should have it (above). Rejected only as a *substitute
for doing this now*, because a counter is retrofittable and a date is not.

**A content hash instead.** Answers "did this change" exactly, with no clock and no bookkeeping
on write, and it can be computed retroactively — which is precisely why it is not urgent. It
needs a per-record table of acknowledged hashes and a re-hash of the library on each sync.

**A version vector, or a hybrid logical clock.** The mature answers when there is no single
authority: a version vector distinguishes genuine concurrency from ancestry without trusting
clocks, and an HLC is a timestamp and a counter in one monotonic value. Both are peer-to-peer
machinery. With one authoritative server and field-scoped endpoints they buy ordering this
product does not need, at the price of a mechanism nobody reading this codebase would
recognise.

**`updatedAt` on the domain type.** It would then be in every factory, every fixture, every
prompt's input and every `deepEqual` in the conformance suite, and it would have to be supplied
by every caller that constructs an `Overview` — including the generation pipeline, which has no
business dating a storage fact. This is the argument `record-migrations.md` already made for
`schemaVersion`, and nothing about a timestamp weakens it.

**Per-field timestamps.** The field-scoped endpoints suggest it: if the writes are per field,
date them per field. Rejected because the entire read-modify-write surface of the application is
one mutation and one patch — an overview's topic ids, and an overview state's three flags — so
per-field dating would multiply the metadata by five to make one array merge marginally better,
and it still would not fix that array.

**Stamping it in the migration chain, so old records get dated on their way through.** Migration
on read is pure; a read that writes turns `listOverviews` into a mutation and the extension's
`holdsOverviewOf` check into a write path. It would also be a lie — the date a record was
migrated is not the date it changed.

## Open questions

**Two overviews of the same video, arriving from two devices at the first sync.** Not created
by this change, surfaced by thinking about it. The app already has a notion of holding an
overview of a video — `holdsOverviewOf` in the extension's service worker — so "one overview per
video per account" is at least arguable as an invariant, and if it is one, the first sync is
where it gets enforced and something has to be discarded or merged. Left open: it is a product
decision about the library, not a storage one.

**Whether `OverviewState` should be dated per flag after all.** Read and favourite are almost
never contested; `userTags` is the one that loses data on a concurrent edit. If tags turn out to
matter more than they currently appear to, dating that one array's elements is the narrowest
possible fix and this is the note that says so.

## When to build it

Now, and it is: stamping is in the local stores. Everything downstream — the outbox, the pull
cursor, the revision, the conflict rule, deletions — arrives with the API, which is the next
thing to be built and the reason this landed first.
