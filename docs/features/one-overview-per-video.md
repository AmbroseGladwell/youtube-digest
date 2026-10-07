# One overview per video

An account holds one overview of each video, on every device. Decided 2026-10-02 (Trello
OV-20): there is no reason to keep two overviews of the same video, and nothing had stopped
an account holding them. An overview's id is a fresh UUID made at generation, so two copies
of one video were two unrelated records to the server and to sync, and the question was
listed as not built in `sync-api.md` and `sync-client.md`.

`docs/features/account-libraries.md` settles one way duplicates arose: the move on sign-in
keeps the account's copy where it already holds the video. This document covers every other
way, and reuses that card's rule: **the copy that reached the account first wins.**

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The server refuses a second live overview of a video, naming the first | `apps/api/src/records/decideReplace.ts`, `RecordsRepository.ts` (`videoId` on a write, `liveOverviewsOf`), `routes/overviewRoutes.ts`; `video_already_held` in `packages/domain/src/ApiErrorCode.ts` |
| A `video_id` column generated from the body, indexed for the lookup, then unique | `apps/api/migrations/V0017__overview_video_ids.sql`, `V0018__one_overview_per_video.sql` |
| The one-off fold of duplicates an account already held, run inside V0018's transaction | `apps/api/src/records/foldDuplicateOverviews.ts`, `db/migrationSteps.ts`, `db/runMigrations.ts` (`before`) |
| The merge rules, shared by the server's fold and the client's | `packages/domain/src/foldOverview.ts` |
| The refusal as an outcome of a push, not a parked write | `packages/sync/src/pushPendingWrite.ts` (`held`) |
| The client's fold: pull first, fold, push the winner's new filing | `packages/sync/src/SyncEngine.ts`, `IndexedDbSyncStorage.foldOverview` in `packages/store-local`, `SyncStorage.foldOverview` in `packages/domain` |
| The shell told, the open page re-pointed | `features/sync/SyncRuntime.tsx`, `SyncContext.ts` (`folds`, `foldNotice`), `features/reader/ReaderPage` |
| Not generating a video this device already holds | `packages/domain/src/heldOverviewOf.ts`, `features/newOverview/useNewOverviewRun.ts` (`held`), `NewOverviewDialog.tsx`, `CapturePage.tsx`; the extension's button through the same lookup in `apps/extension/src/serviceWorker.ts` |
| Two real devices through the real API, and the fold of an account's existing duplicates | `apps/api/src/sync/twoDevices.test.ts`, `records/foldDuplicateOverviews.test.ts`, `routes/overviewRoutes.test.ts` |

## The server is the arbiter

Live overviews are unique per account and video. `POST /overviews` creating a second one is
refused with `video_already_held` (409), whose `details.overviewId` names the overview the
account has. The check is handed to `decideReplace` by the repository, inside the write's
transaction: the route reads the video id off the body loosely, since the body may be at a
version the server does not know, and the repository looks up the live overview of that
video under another id before the decision runs. The account's row lock already serialises
one account's writes (`sync-api.md`), so the check alone is correct; the unique index is
the guarantee that outlives the code.

A regeneration keeps its overview id, so it is a replace with `If-Match` and never meets
the rule. A tombstoned overview does not count, so a video deleted can be generated again.
An overview whose video has no id, from before transcripts were stored against one, is
never held and never refused: the generated column is null for it, and a unique index
treats nulls as distinct.

**The column is generated**, `case when kind = 'overview' then body -> 'video' ->> 'id'
end`, so no write path has to remember to fill it and the server still never reads inside a
body except to validate it. V0017 adds it with a plain partial index for the lookup; V0018
replaces that with the unique one, after the fold below has run.

## Existing duplicates are folded once, before the index goes on

Accounts enrolled before `account-libraries.md` pushed two libraries, the web app's and the
extension's, into one account. `foldDuplicateOverviews` runs inside V0018's transaction,
before its file, through the migration runner's `before` steps: per account and video with
more than one live overview, the copy with the earliest `savedAt` (ties by seq) is kept,
the others' filing and state are folded onto it, and the others are tombstoned with their
state rows, every write taking a fresh seq so every device drops them through the feed.

Two rules inside it:

- **Every copy is read at the current version first**, through the same chain a field
  write migrates through (`sync-api.md`, "A merge migrates first"). A copy this server
  cannot read stops the fold, loudly, which fails the migration and the deploy, rather than
  guessing at a record from the future. The deploy-order rule in `docs/architecture/api.md`
  means this cannot happen in practice.
- **The winner is only rewritten where the fold changed something.** A no-op write would
  move the revision and seq for nothing, which `sync-api.md` already refuses on the field
  routes. The merged record is dated by the latest edit among the copies, never by the
  fold's own clock unless none of them was dated.

The fold goes through `RecordsRepository.write`, so it allocates seqs and moves revisions
exactly as a client's write does. The scripts that apply migrations (`set-plan`,
`seed-voice-samples` and the rest) pass the same steps, so none of them can meet the index
without the fold.

## The merge rules

`packages/domain/src/foldOverview.ts`, used by the server's fold and by both clients' folds
so the three cannot disagree:

| Field | Rule |
|---|---|
| `topicIds` | a union, the winner's first |
| `tags` | a union, the winner's first, capped at `MAX_TAGS` since a record may hold no more |
| `captureReason` | the winner's, or the loser's where the winner has none |
| `read`, `favourite` | kept if either copy had them |
| `userTags` | a union |
| the text | the winner's; the loser's is discarded |

Discarding the loser's text is the card's decision: the first copy is a complete overview
of the same video, and a newer prompt's better text is what regenerate is for. Topics are
a union by id, not by name: both devices' topics already exist in the account by the time
the fold runs, and merging same-named topics is OV-21's question, not this one's.

## The client resolves the refusal

`pushPendingWrite` turns `video_already_held` into a `held` outcome naming the winner,
beside "topic already exists" among the outcomes that are not failures. The refusal's
`rev` is the winner's, not this record's, so the replace retry does not treat it as a
revision race: `revisionNamedBy` now listens only to `already_exists` and
`revision_mismatch`.

The engine then:

1. **Pulls the feed first.** The union of two filings needs the winner's, and the field
   routes replace a field rather than merging it, so the winner has to be here before
   anything is written onto it. Pulling mid-push is safe because `applyChanges` rebases
   pending writes on top of what it pulls (`sync-client.md`).
2. **Folds, in one transaction.** `IndexedDbSyncStorage.foldOverview` re-files the winner
   field by field and journals each as a reader's own edit would be, so the server sees
   `PUT /topics`, `/tags`, `/capture-reason` and `/state` onto the winner; deletes the
   loser and its state without journaling a delete, since the server never had it; drops
   the loser's pending writes; and re-points its transcript write at the winner, which is
   of the same video.
3. **Starts the push pass again** from what is pending now, so the winner's new writes go
   in this cycle, and tells the shell through `onFolded`.

A winner this device cannot read yet, quarantined as `future-version`, leaves the loser's
write **parked** with `video_already_held` as its reason, counted and shown as every parked
write is, rather than dropped or folded blind. Nothing is touched.

**The shell** keeps the folds of this tab's session in `SyncContext.folds`, invalidates the
overview queries so the library re-reads, and a reader page open on the loser follows it
to the winner with a replacing navigation. Reading positions are keyed by video id, so the
reader's place carries over without being moved. `foldNotice` holds the latest fold until
dismissed, for the notice the design will add: what the reader is told when a copy made
here was folded into the account's. That notice is **not yet designed**, and no component
renders it.

## Prevention: not generating what is already here

Spending another ~30,000 tokens on a video the library holds is the one duplicate that can
be stopped before it exists. `heldOverviewOf` answers whether a library holds an overview
of a video, quarantined records included by their salvaged video id, the way the
extension's button already checked; the extension's worker now uses it too.

`useNewOverviewRun.start` asks it before anything else, unless the run names the
`overviewId` it writes under, which is a regeneration and the reader's deliberate act. Held,
it sets `held` instead of a run, counts `capture.newOverview.alreadyHeld`, and generates
nothing. The dialog shows a "You already have this" state with **Open your overview**,
which dismisses the dialog and opens the overview; the panel, which has no dialog, opens
it directly. The state reuses the dialog's own heading, text and action styles rather than
a shape of its own, which was looked at and shipped as it is (2026-10-07).

The capture queue does not check. It takes videos from followed playlists, and whether a
playlist's video the library already holds should be skipped is a queue question
(`docs/features/capture-queue.md`).

## Analytics and logging

The server logs the refusal as every refusal, `request refused` at warn with the code and
the held overview's id, so a device's fold can be followed from its request id. Each fold
of existing duplicates is logged at info by account, video and the ids kept and folded, by
`server.ts` as the migration runs. On the client, `capture.newOverview.alreadyHeld` counts a
reader asking for a video the library holds, with where they asked from and the overview's
id; the fold itself is a system outcome rather than a reader action, so it is not an event
(`docs/architecture/analytics.md`).

## Testing

`overviewRoutes.test.ts`: a second overview of a held video is refused naming the first; a
regeneration still replaces; a deleted video can be generated again; different videos and
unidentified videos sit side by side. `foldDuplicateOverviews.test.ts`: the earliest copy is
kept with the others' filing and state folded on and the rest tombstoned; an account with
one per video is untouched and the index then refuses a second; two accounts holding one
video are two overviews and a tombstone is not a duplicate; a copy at an older version is
migrated before it is folded. `twoDevices.test.ts`: both devices generate the same video
offline and both end with one overview carrying both devices' read, favourite, topics, tags
and reason; a device that generates a video the account holds before pulling it folds its
copy and tells the shell; an account seeded with duplicates ends with one per video on
every device once the migration runs. The sync package's unit tests cover the `held` outcome
and the engine's pull-fold-push order and its parked case; store-local's cover the fold
transaction.

`newOverviewRun.iwft.ts`: a held video offers to open the existing overview, the model is
never asked, and Open lands in the reader. **Not covered yet:** the fold notice, which has
no component to test.

## Departures, recorded

- **The check is in the repository and the decision, not only the decision.** The card
  placed it in `decideReplace`'s transaction; `decideReplace` stays a pure function over
  what it is handed, and the repository hands it the held overview.
- **A transcript test is gone.** "Deleting one of two notes on a video keeps the transcript
  the other still uses" described a state one account can no longer be in; the rule it
  checked survives for two accounts, in the test beside it.
- **Test fixtures give each overview a video of its own** (`storedOverview`,
  `distinctVideo`), since the shared `example` video now makes a second fixture a duplicate.
- **The fold waits for the winner to be readable here.** The card's resolution assumed the
  winner could be merged onto; where it cannot be read, parking with the reason is the
  honest degrade. It stays parked and counted, as every parked write does, until retrying
  parked writes after an update is built (`sync-client.md`, "Not built").
