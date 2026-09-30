# The shared transcript cache

The first rung of the ladder in `docs/features/transcript-retrieval.md`. A video's captions
are the same for every reader, so once two accounts have each fetched the same words,
nobody needs to fetch them again. A hit costs one row read, and nobody contacts YouTube or
Supadata. So a video's third reader onward benefits, and its first two never do.

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

Plus gating is not part of this. The server does now know each account's plan
(`accounts.plan`, `docs/features/mcp-connector.md`), but reading needs no account at all,
and a cache that only some readers could hit would save less for everyone.

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

## Two accounts have to agree

The server can't see YouTube, so it can't check an upload against the real captions. A
modified client could upload anything for a video nobody has cached yet: spam, a false
claim, or instructions aimed at the model that writes every later reader's overview.
Checking a hash of "what the client fetched" wouldn't help, because the client that fakes
the text would fake the hash too. The only independent evidence the server can get is
another account fetching the same video itself.

So a copy is served only once **two different accounts** have uploaded the same words.
The words are compared by `wordsHash`: the segments' text joined, lower-cased, stripped of
everything but letters and digits, then SHA-256 along with whether a person wrote them.
Two fetches of one track agree however their captions were cut into segments, and a
written track and a machine-heard one never agree.

**Why only fetches can confirm a copy.** A reader served from the cache uploads that same
copy back with their note. That's an echo, not a second opinion, and it's why "serve at
once and pull it when someone disagrees" can't work: after the first hit, nobody fetches
independently again. An unconfirmed copy is never served, so every upload that counts
towards confirming one must have come from that account's own fetch.

What this does and doesn't stop:

- **One account can't poison the cache.** Its copy stays unconfirmed however often it
  sends it: the key is the account and the video, so a second device or a resend counts
  once.
- **Two accounts working together can.** Magic-link accounts are cheap, so this raises
  the bar rather than closing the door. Counting only accounts of some age is the next
  step if that is ever seen.
- **A rival copy doesn't displace a confirmed one.** A third account uploading different
  words starts its own unconfirmed copy beside it. If a written copy and a machine-heard
  one are both confirmed, the written one is served.

**Unverified: that InnerTube and Supadata give the same words for one track.** Supadata's
native mode returns YouTube's own track, so they should match, but that hasn't been
compared on a real video. If they differ, a mixed pair never confirms. That fails safe:
the copy waits for two fetches from the same kind of source.

**Two readers get the same track.** InnerTube is always asked with `hl: "en"`, and
`selectCaptionTrack` is deterministic, so two readers' fetches can agree at all. A rung
that picked a track by the reader's language would split them.

Each upload's outcome is logged as `transcriptContributed`: `pending`, `confirmed`,
`already-confirmed` or `not-noted`.

## Storage: copies, links and contributions, kept apart

`V0009__shared_transcripts.sql` replaces the per-account table with three:

| Table | One row per | Holds an account? |
|---|---|---|
| `shared_transcripts` | video and words hash, so rival copies sit side by side | no |
| `account_transcripts` (the old `transcripts`, with no body) | account and video, pointing at the copy that account sent | yes, while one of its notes uses the video |
| `transcript_contributions` | account and video: which words that account fetched | yes, for a year |

- **An account reads back its own copy.** `GET /api/transcripts/:videoId` joins through its
  link, so an account's other devices get exactly what it sent, confirmed or not. Sending
  again replaces it, as before this cache existed.
- **Deleting a note** drops only the account's link (`forgetUnnoted`). A confirmed copy
  stays. An unconfirmed copy that no account links to any more is deleted, because only
  linked accounts could ever read it. Its contributions stay, so a later matching fetch
  still confirms it.
- **Confirmation is kept on the copy.** `confirmed_at` is set once the second account
  agrees and is never unset. The contributions that confirmed it can then age out without
  taking the copy out of the cache.

**Who fetched what is kept apart from the transcripts themselves.**
`transcript_contributions` is the only place an account is tied to a video it no longer
has a note on. It serves two purposes: counting agreement, and removal when something
goes wrong. Two rules keep it from becoming a history of what people watched:

- **A year, then gone.** A contribution older than 365 days is deleted, and after that it
  no longer counts towards confirming anything. Nothing can run a scheduled job yet
  (`docs/architecture/deploy.md`), so the sweep runs inside every upload. It's one indexed
  delete.
- **It outlives the account.** `account_id` has no foreign key, so deleting an account
  (not built yet) will leave its contributions until the year is up. Once the account row
  is gone, the id leads to no email. The contributions still count, because the fetches
  happened, and a copy that account vouched for can still be removed along with
  everything else it vouched for. The privacy policy the store listing needs should say
  so.

**The migration keeps what each account had and shares none of it.** Existing rows become
copies keyed `legacy:<md5 of the body>`, each linked to the account that stored it, with
no contributions and nothing confirmed. The words hash can't be reproduced in SQL with
confidence of matching the TypeScript, and an old row isn't evidence of anything anyway.
So the cache starts empty.

## Removing one

A wrong or poisoned transcript is found by a reader reporting it, not by the server. Then,
in `apps/api`:

```
npm run forget-shared-transcript -- <video-id>                  # every copy of that video
npm run forget-shared-transcript -- <video-id> --contributors   # and everything its vouchers vouched for
```

Removing copies removes every account's link to them (`on delete cascade`), along with
the contributions behind them, so the same copy can't confirm again straight away.
Nothing is lost that can't be fetched again: readers keep their device's own copy, and
the next upload contributes afresh. Each run prints the accounts that vouched for the
video's served copy.

## Logs

The hit rate comes from the server's own logs, since no client analytics exist:

| Event | Fields | Answers |
|---|---|---|
| `sharedTranscriptRead` | `hit` | how often the cache spares a fetch |
| `transcriptContributed` | `contribution`, `generated` | how often copies wait, and how often a second account confirms one |
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
