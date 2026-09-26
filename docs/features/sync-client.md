# The sync client

The client half of the sync engine: how a local write gets to the server, how what other
devices wrote gets back, and what the reader sees while either is happening or cannot
happen. The server half is `docs/features/sync-api.md`; the two records it reconciles were
designed in `docs/features/record-migrations.md` and `docs/features/sync-metadata.md`, and
this document is written against all three. Where it departs from one of them, it says so.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The outbox, written in the same IndexedDB transaction as every local write | `packages/store-local`: `appendPendingWrite.ts`, both stores' write paths, `localDatabaseSchema.ts` at version 4 |
| Journaling gated by a flag in the database, not by which class wrote | `appendPendingWrite.ts`, `IndexedDbSyncStorage.enrol` |
| The entry carries the change, not the record that contains it | `packages/domain/src/OutboxEntry.ts` |
| Enrolment journals the whole library once, at this client's version | `IndexedDbSyncStorage.enrol` |
| The feed's page applied with its cursor in one transaction, pending writes rebased on top | `IndexedDbSyncStorage.applyChanges`, `packages/domain/src/rebasePendingChanges.ts` |
| One cycle: handshake, enrol, push in order, pull to the end | `packages/sync/src/SyncEngine.ts` |
| Each entry onto its route, and the retry rule for a whole-record write | `packages/sync/src/pushPendingWrite.ts` |
| Which failures stop the cycle and which park one write | `packages/sync/src/stopReasonFor.ts` |
| The API client over `fetch`, parsing every answer with the shared schemas | `packages/sync/src/fetchSyncApi.ts` |
| The runtime that owns one engine per tab, and re-reads every page after a pull | `packages/app-core/src/features/sync/SyncRuntime.tsx` |
| Server and token, device-local like the API keys | `syncConnectionStorage.ts`, `useSyncConnection.ts` |
| The settings panel, the stale-client banner, the write-floor wall | `features/sync/components/` |
| Two real devices through the real API in process | `apps/api/src/sync/twoDevices.test.ts` |
| The screens, in a browser, against a simulated feed | `packages/app-core/playwright/iwft/scenarios/sync.iwft.ts` |

## What a local write leaves behind

`sync-metadata.md` chose an outbox over a dirty flag because an entry written in the same
transaction as the data cannot disagree with it, and named deletions as the thing only an
outbox can record. That is what is built, with one decision inside it worth stating:

**The entry carries the change, not the record.** `setOverviewState(id, { read: true })`
journals `{ op: "state", patch: { read: true } }`, not the whole state row. This is what
lets two devices edit different fields of one record and both keep their edit: the server's
field routes commute across fields (`sync-api.md`), but only if each device sends the field
it changed. A whole-record `saveOverview` journals the whole stored record, stamps
included, because that is what `POST /overviews` takes; a delete journals nothing but the
fact of it.

The ops and the routes they map onto:

| Local write | Entry | Route |
|---|---|---|
| `saveOverview` | `replace`, the stored record | `POST /overviews`, `If-Match` when the revision is known |
| `setOverviewTopics` | `topics` | `PUT /overviews/:id/topics` |
| `setOverviewCaptureReason` | `captureReason` | `PUT /overviews/:id/capture-reason` |
| `setOverviewState` | `state`, the patch as given | `PUT /overviews/:id/state` |
| `deleteOverview` | `delete` | `DELETE /overviews/:id` |
| `createTopic` | `replace`, the stored topic | `POST /topics` |
| `Settings.update` | `settings`, the patch as given | `PUT /settings` |

Every entry carries the same `updatedAt` the record was stamped with, from the same
`Date`, so the server stores the time of the local write and nothing else (`sync-metadata.md`,
"The client's value is the one that is kept").

**Whether a write is journaled is a fact about the database.** `appendPendingWrite` reads
an `enrolled` flag inside the write's own transaction and appends only if it is set. The
free tier never sets it and journals nothing; the same store classes serve both tiers with
no second implementation and no in-memory flag that could be out of step with the data. The
alternative, a `SyncedOverviewStore` wrapping the local one, was what `sync-api.md` named and
is deliberately not what was built: it would be a delegate with one extra line, and the
line belongs inside the transaction it cannot reach from outside.

`deleteOverview` now takes the state row with it, which `sync-api.md` asked for and the
conformance suite now checks.

## Enrolment: the first sync pushes everything

A library that existed before sync was switched on has records with no outbox entries. The
first cycle on a library that is not yet enrolled journals every record it holds, in one
transaction with setting the flag, so nothing written between the two can be missed.

Three rules inside that:

- **At this client's version.** Every record is run through the migration chain first and
  stamped current, because no client ever writes at any other version
  (`record-migrations.md`). A version-1 overview is pushed as a version-4 one.
- **Dated by its own creation where it was never dated.** The server needs an `updatedAt`
  on every write and `sync-metadata.md` says an absent one precedes everything. An undated
  overview goes with its `savedAt`, a topic with its `createdAt`, and a state or settings
  record with the moment of enrolment, which is the honest answer for a record nothing has
  ever dated.
- **What this client cannot read, it does not push.** A record above its version or one
  that will not migrate stays quarantined and counted where it is. Pushing it would either
  be refused or, worse, accepted at the wrong version.

Leaving, for the day a sign-out exists, is the reverse: the bookkeeping goes and the
records stay.

## One cycle

`SyncEngine.sync()` is handshake, enrol if never enrolled, push the outbox in order, pull
the feed to its end. Two orderings inside it are load-bearing:

**Push before pull.** What the pull brings back then already carries this device's writes,
so the library never shows an edit as undone. Pull first would overwrite a pending local
edit with the server's older copy until the push landed.

**A cycle asked for during a cycle runs once afterwards.** A journaled write, the interval,
the tab coming back and the network coming back all ask; none of them start a second
cycle, and the one that runs after sees everything they asked about.

Below the write floor the cycle pushes nothing and still pulls: reads are served below
the floor (`docs/architecture/api.md`) and a walled client's library may as well be
current.

### What stops a cycle and what parks a write

Not every refusal means the same thing, and `stopReasonFor` is the whole of that
judgement:

| The server said | The cycle | Because |
|---|---|---|
| nothing, or not the API | stops, `offline` | nothing later in the outbox would fare better, and a retry later might |
| `internal_error`, `unavailable` | stops, `failed` | the same |
| `unauthenticated` | stops, `signedOut` | a token, not a retry, is the way out |
| `client_unsupported` | stops, `unsupported` | the wall |
| anything else | parks this one write | it is the write's own fault and no resend changes it |

A parked write is **kept, marked with the server's reason, and counted**, never dropped:
a dropped write is the prototype's eleven missing notes at the scale of one edit. Every
later write to the same record waits behind it, because a filing pushed over a create that
was refused would be a `404` that looked like a deletion. Other records carry on.

Two refusals are outcomes rather than failures. A field write to a record the server no
longer has is done with, because the tombstone is on its way down. A topic the server
already holds under this id is this same topic, pushed once before and not acknowledged in
time, and counts as created.

### Whole-record writes and the revision

`POST /overviews` onto a record the server holds needs `If-Match` (`sync-api.md`). The
client keeps the revision the server gave each record and sends it; when it has none, or
the record moved on, the server names the current revision and the write is retried with
it, three times at most. That makes a regeneration **the last local write wins**, which is
what the local store's `put` already means, and it costs what `sync-metadata.md` already
accepted: a topic filing made elsewhere in the same window is replaced by this record's
`topicIds`. The regeneration is the reader's deliberate act at 30,000 tokens; the filing
is one click.

## What comes down

Each page of the feed is applied with the cursor that follows it in one IndexedDB
transaction: a crash between the two cannot leave a record applied and pulled again, or a
cursor past a record that never landed.

A pulled record is written **raw**, stamps put back beside the body as the server took
them off, and the reader's next read runs the chain as it does for every record. A record
from a newer client arrives, is quarantined as `future-version`, and reaches the library
card and the banner through `listUnreadable()` exactly as `record-migrations.md` designed
before there was a server to send one. A tombstone removes the record, its state, and the
revision this device knew for it, and nothing is ever inferred from absence.

**Pending local writes go back on top.** If this device still has unpushed writes to a
record the feed just delivered, `rebasePendingChanges` replays them over the pulled body
in journal order, so the library keeps showing the edit until the push carries it. The
same merges the server runs, run here: a settings patch merges `sectionsEnabled` one
level deep through the one `mergeSettingsRecord` the server, the local store and the
rebase all share. A pending delete means the pulled record is not written at all; a
parked write is not replayed, because it is never going to land and the server's copy is
the truth the reader will see everywhere else.

## What the reader sees

Every screen follows the third habit in `CLAUDE.md`: a control appears only where it can
work.

**Settings.** The shell says whether its library can sync at all; a shell that cannot
shows no sync section. One that can asks for the server's address and a session token,
because sign-in is not built and `mint-session` is what exists (`docs/architecture/api.md`).
In the extension the server has to list the panel's origin as well, or the browser stops
every call before it leaves (`docs/architecture/api.md`, Origins). Connected, it shows one status line and two buttons. The line always carries what is still
waiting, `3 changes waiting to send · 1 couldn't be sent`, whatever else it says, because a
library that is quietly behind is the failure this project exists to avoid.

**The banner** is the one `record-migrations.md` designed: it fires on encounter, counting
the records actually held back, not on the handshake; it takes the generation strip's slot;
it is dismissed for the session and no longer; and it carries a button only where pressing
it would work, a reload on the web and whatever the extension shell hands it through
`AppUpdate`, which today is nothing.

**The wall** is that document's other screen, built as it was argued: it stands in for the
pane rather than the tree, so the shell and any generation it owns keep running; a run in
flight holds the update action back and says so, because updating neither refunds nor
aborts a generation, it only discards one. On the web the action is a reload. In the
extension it is `Open extensions`, which the shell provides and app-core cannot.

## Departures, recorded

- **No `SyncedOverviewStore` class.** Above. The local stores journal; the database says
  whether to.
- **`updatedAt` on an undated record is filled at enrolment**, from the record's own
  creation date. `sync-metadata.md` says absent means older than everything and that the
  first sync pushes everything regardless; the server needs a value, and this is the one a
  reader would recognise.
- **A stuck write is not rebased over a pull.** Not argued anywhere before; decided here so
  that a device does not show, forever, an edit the account will never carry.

## Not built

Sign-in, so the token is pasted rather than earned; `chrome.runtime.onUpdateAvailable`
feeding the wall's `Update now`; the one-overview-per-video question at first sync;
set-valued merging of `userTags` and `topicIds`; the shared transcript cache; captures and
audio. Retrying a parked write once the app has updated is a one-line change to `#push`
when the day comes, and is left until it does.
