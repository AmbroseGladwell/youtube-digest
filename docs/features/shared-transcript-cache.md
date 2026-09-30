# The shared transcript cache

The first rung of the ladder in `docs/features/transcript-retrieval.md`. A video's captions
are the same for every reader, so once any account has stored them, nobody needs to fetch
them again. A hit costs one row read, and nobody contacts YouTube or Supadata.

Only transcripts are shared. An overview is personal to the reader it was written for
(`docs/architecture/architecture-options.md`), and nothing about one goes near this.

## Who reads it, and who adds to it

`docs/features/sync-api.md` recorded that the cache's gating contradicted itself across the docs.
`v1-architecture-decisions.md` listed the cache as paid-gated infrastructure and also
described it as the first rung for everyone. It was settled on 2026-09-30 (OV-16):

| | Who | Why |
|---|---|---|
| **Reading** | Anyone, with no session: `GET /api/shared-transcripts/:videoId` | What it serves is public captions of a public video. A signed-out web reader is exactly who a free transcript helps most. |
| **Adding** | A signed-in account, only through `PUT /api/transcripts/:videoId` for a video one of its live notes uses | Adding writes to shared infrastructure, which is what `v1-architecture-decisions.md` says auth exists to gate. Every contribution has an account to trace it to and to limit. |

Plus gating is not part of this. The server has no idea which plan an account is on
(`Plan` is a local placeholder, `docs/features/plus-upsell.md`), and a cache that only
some readers could hit would save less for everyone.

**Contributions come only from notes.** The transcript store also holds captions the
extension fetched just because a video was open (`docs/features/watching-detection.md`).
None of those are sent, for the same reason they never reach the account
(`docs/features/transcript-storage.md`, "Only the transcripts behind a note go up"): that
would hand us the reader's viewing history.

## Every client asks it first, except in the background

The rung (`sharedCacheTranscriptSource`) comes first in `createTranscriptSources` on every
surface, signed in or not. It asks the server the shell knows (`useKnownApiUrl`): the web
app's own origin, or, in the extension, the server the reader named or the one it was
built for. So a signed-out extension user's **Create** now tells our server which video
they are summarising. `BYO_KEY_NOTE` says so. It is still true that no key ever passes
through us.

**The background prefetch never asks it.** `watchedTranscriptQuery` builds its rungs with
no shared-cache URL, so merely watching a video tells our server nothing. That is a
property of what the query is handed, the same way "the background never spends" is
(`transcript-retrieval.md`), rather than a rule to remember. An IWFT pins it.

**Anything that goes wrong asking it counts as a miss.** A 404, a 429, a server that can't
be reached or an answer of the wrong shape all fall through to the next rung, and none of
them is what the reader is told about. A copy with no video metadata is a miss too,
because a rung has to answer with the video as well as its captions.

## What a contribution has to be

`transcriptFault` checks every upload before anything is kept:

| Fault | Why it is refused |
|---|---|
| `another-video` | the body, or its metadata, names a different video from the path |
| `no-segments` | nothing to read, and InnerTube already treats an empty track as blocked rather than as captions |
| `no-words` | every segment is blank |
| `times-out-of-order` | a segment ends before it starts, or starts before the one before it. Two captions starting on the same millisecond are allowed, because one cue can hold two lines. |

A faulted upload is answered `204` and kept nowhere, neither shared nor on the account,
and logged as `transcriptRefused` with the fault. It isn't answered `400`, because a `400`
would park the entry in the reader's outbox (`docs/features/sync-client.md`) and show them
"waiting to send" for a transcript nobody could use.

Before it is shared, the copy's `video.url` is rewritten to the video's own
`watch?v=` address. The url a reader pasted can carry a `si=` share tracker or a playlist,
which is about them rather than the video. Each client puts its own url back when it
reads the copy.

## First valid copy wins

The first copy that passes is kept, and a later upload replaces it only if it is strictly
better (`outranks`):

1. written by a person, over machine-heard, then
2. carrying the video's metadata, over a copy stored before metadata was kept.

Anything else leaves the held copy alone. So a machine-heard track never overwrites a
written one, and an account that uploads second can't swap in its own version of a video
someone else already contributed. Each outcome is logged as `transcriptContributed`:
`added`, `upgraded`, `kept` or `not-noted`.

The contributing account is recorded on the row (`contributed_by`) and moves with an
upgrade. It is the only link from the shared table back to an account. It exists so that
abuse can be cleaned up, and it goes back to null if the account is deleted.

**Two readers get the same track.** InnerTube is always asked with `hl: "en"`, and
`selectCaptionTrack` is deterministic, so one copy per video is the copy either reader
would have fetched. That rests on nothing but those two facts. A rung that picks a track
by the reader's language would need the language in the key.

## Storage: one copy, and a link per account

`V0008__shared_transcripts.sql` splits what used to be one per-account table:

- `shared_transcripts`: one row per video, holding the body, the contributor and when.
- `account_transcripts` (the old `transcripts`, with no body): a link from an account to
  a video, which only lasts while one of its notes uses that video.

Under this split:

- **`GET /api/transcripts/:videoId`** joins through the link, so an account reads the
  shared copy. That may not be byte-for-byte what it uploaded, but it is the same video's
  captions, and a better copy if someone contributed one.
- **Deleting a note** drops only the account's link (`forgetUnnoted`). The shared copy
  stays, with no account attached apart from its contributor. That's the change
  `transcript-storage.md` asked for when this cache arrived.
- **The migration** keeps the best copy of each video already stored, using the same
  order as `outranks` and then the oldest, credits its uploader, and links every account
  that had stored one. Rows with no segments were never usable and are dropped, links
  and all. The migration does not run the other fault checks: those rows predate them,
  and they were already on the server.

## Removing one

A wrong or poisoned transcript is found by a reader reporting it, not by the server. The
server has no way to fetch the captions and compare. Then, in `apps/api`:

```
npm run forget-shared-transcript -- <video-id>                 # that video's copy
npm run forget-shared-transcript -- <video-id> --contributor   # everything its contributor added
```

Removing a shared copy removes every account's link to it (`on delete cascade`). Nothing
is lost that can't be fetched again. Readers keep their device's own copy, and the next
upload of that video, from any account, contributes afresh. Each run prints the
contributor, so it is visible whose contributions were taken.

**Why this is enough for now.** What a poisoner can change is a transcript that other
readers' overviews are then written from. That is real, but it is bounded: each
contribution needs a signed-in account with a live note on that video, it only wins where
nothing was cached before, one command undoes a whole account's contributions, and a
written track displaces a machine-heard one. Requiring two accounts to agree before a
copy is served was considered and not built, because the cache would then help nobody
until a video's second reader arrived.

## Logs

The hit rate comes from the server's own logs, since no client analytics exist:

| Event | Fields | Answers |
|---|---|---|
| `sharedTranscriptRead` | `hit` | how often the cache spares a fetch |
| `transcriptContributed` | `contribution`, `generated` | how often the cache grows, and how often a written track upgrades a machine-heard one |
| `transcriptRefused` | `fault` | what bad uploads look like |
| `throttled` | `limit: sharedTranscriptAddress` | whether 300 an hour is ever reached (`docs/architecture/api.md`) |

No video id or address is logged with these.

## What this does not do

- **Which rung answered, on a miss.** A miss is followed on the client by whichever
  rung answered, and there is no client analytics to report which. `hit: false` counts the
  fetches that happened. What happened after them is not recorded.
- **Refill a reader's Transcript tab.** When neither the device nor the account has a
  transcript, the tab doesn't ask the cache. That is OV-25, which runs the ladder this
  rung now leads.
- **Let a web reader with no key make a note.** `useGenerationReadiness` still asks for a
  rung that can answer every video, and a cache can only answer the videos someone
  stored. The extension bridge (OV-54) and the server-side service (OV-55) are the rungs
  that change that.
