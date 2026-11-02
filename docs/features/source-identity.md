# Source identity

What identifies the thing an overview is of, once that thing need not be a YouTube video.
Decided 2026-11-02 (Trello OV-77, first slice). Web pages (OV-77), podcasts (OV-106) and reels
(OV-130) all need it, so it was changed once, ahead of any of them. Nothing here is visible
to a reader.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| What an overview is of: a union on `kind`, with one member so far | `packages/domain/src/Source.ts` |
| The one string every store keys by | `sourceKey`, `storedSourceKey` in `packages/domain/src/sourceKey.ts` |
| `video` becoming `source`, at overview schema version 10 | `moveVideoToSource` in `overviewMigrations.ts`, `overviewCorpus.ts` |
| The same key as a column, for both shapes of body | `apps/api/migrations/V0024__source_keys.sql`, `records.source_key` |
| One live overview per source | `records_one_live_overview_per_source`, `RecordsRepository.ts` |
| Shares moved, and their hashes with them | `apps/api/src/shares/moveSharesToSource.ts`, run from `db/migrationSteps.ts` |
| A client at an older version can still share | `ShareRequest` in `packages/domain/src/Share.ts` |

## Two things, deliberately separate

**`Source` is what an overview is of.** A union on `kind`, where each kind carries the fields
it really has. An article has no channel and no duration, so it does not get a null one:
`{ kind: "web", … }` joins the union with its own fields, and the compiler then names every
reader that assumed a video. That is the point of the union having one member today.

**`sourceKey` is how stores find it.** One string, from one function:

| Kind | Key |
|---|---|
| `youtube` | the bare video id: `abc123XYZ_-` |
| anything else | `kind:id`: `web:9f2c…` |

## Why YouTube's key is unprefixed

A uniform `youtube:abc` is tidier, and it was turned down on what it would cost. A bare id keys
three Postgres tables (`account_transcripts`, `shared_transcripts`, `transcript_contributions`,
whose rows also carry a check that the body's `videoId` matches), two IndexedDB stores and
the reading positions in localStorage. Prefixing would rewrite all of them, bump
`DATABASE_VERSION`, and leave every client still on `/transcripts/<id>` needing the old form
served, since the write floor is 1 and an extension updates on Chrome's schedule.

Leaving YouTube bare moves nothing: no row is rewritten, no local store is re-keyed, and a
stale client keeps working. The cost is that YouTube is a special case, in exactly one
function.

**A video id must never look like a prefixed key.** YouTube's ids hold no colon, and
`extractYouTubeVideoId` now refuses one that does, so `?v=web:9f2c` is not a way to name
another kind's key. `POST /overviews` does not check this: a forged body only reaches its
own account's library, but the slice that lets another kind into the shared cache has to
close that, since that cache is shared between accounts.

## What did not change

- **`StoredTranscript.videoId` keeps its name**, and it holds a source key. Transcripts carry
  no schema version and the name is in two table checks, so renaming it would be the
  rewrite above. `SourceKey` and `VideoId` are one type for the same reason.
- **The capture queue, playlists, InnerTube, following playback and the generation pipeline
  still say video**, because they are about videos. Extraction and note layout stay separate
  per kind (OV-77), so `run.video`, `resolved.video` and generation's `input.video` are right
  as they are. Components take `video={overview.source}`, which holds while the union has one
  member; a new kind makes the compiler say where it stops holding.
- **`video_already_held` keeps its name**, because clients at older versions match on it.
- **Whether a non-YouTube kind stores its text at all is still open.** Nothing here needs
  it answered: the card's open question about what the cache keeps for articles is the third
  slice's.

## Rolling this out

`server.ts` migrates on start and the deploy is rolling, so for a moment old machines run
against the new schema. So:

- **`records.video_id` and its unique index stay, for now.** V0024 adds `source_key` beside
  them, because dropping a column an old machine is querying would fail its writes. Removing
  them is a later migration of its own. `foldDuplicateOverviews` queries `video_id` directly,
  since it runs at V0018, before `source_key` exists.
- **`source_key` reads both shapes.** The server stores records at the version they were
  written and permanently holds a mix (`record-migrations.md`), so this is the steady state
  rather than a transition. `sourceKeyColumn.test.ts` holds the SQL and `storedSourceKey` to
  the same answers, and proves an old-shape and a new-shape copy of one video are one item.
- **A stale client holds back every overview written at version 10**, as with any schema
  bump, through the banner and cards `record-migrations.md` describes. One difference: an
  older client's salvage knows only `video`, so its card for a version 10 record has no title
  or link, and its check for whether it already holds the video misses. If it then generates
  that video, the server's `video_already_held` refusal still stops the duplicate.
- **A share written by an old machine during the rollout keeps the `video` shape**, because the
  move runs once. Its page would fail until it is shared again. The window is seconds and
  was not worth a second read path.

## Shares

A snapshot is a frozen copy with no schema version, so V0024 moves the stored ones, with its
`moveSharesToSource` step. `content_hash` is taken over the note's keys, so it is recomputed
over the moved note. Without that, every existing link would read as edited since it was
shared. A share whose overview really was edited still differs, and still says so.

## Testing

`sourceKey.test.ts`: the key at each kind and at both body shapes.
`overviewMigrations.test.ts` and the corpus: the move, through the registry-driven checks.
`sourceKeyColumn.test.ts`: the column agrees with the domain for every body shape, the two
shapes of one video cannot both be live, one id under two kinds is two items, and shares
move with their edited state intact. `shareRoutes.test.ts`: an older client's share is
accepted. The existing transcript, sync and IWFT suites are what show YouTube is unchanged.
