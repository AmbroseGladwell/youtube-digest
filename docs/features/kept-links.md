# Kept links, and sources saved without an overview

Card: OV-358 (with OV-99 and the capture half of OV-11). Design: "OV-358 1–3" (358a–358l),
hand-off `design_handoff_ov358_kept_links/`. Decided with the owner on 23 Nov 2026.

On a phone or the web, a link that can't be made right now no longer hits a dead end:

- **Nothing in the way:** it's made at once, as before.
- **The month's overviews are spent:** it's saved with its transcript as a library item
  without an overview. It doesn't count against the month, and the reader makes the
  overview later.
- **Our server can't fetch it right now, or only the extension can read it:** it's kept
  as a link in the queue and made as soon as that clears.

This doc covers the record and the server, which landed first. The screens follow in
later slices of the same card.

## The record

A **capture** is a synced record kind (`capture`, `packages/domain/src/Capture.ts`): a
source before its overview, under the id its overview will take. It has two stages:

| Stage | Holds | Waits for |
|---|---|---|
| `kept` | the pasted address, and the source if it was read | `waitingFor`: `turn` (a playlist video waiting in the queue), `server` (our server's daily cap or a slow-down), `extension` (only the extension can read it), or `reset` (it needs transcribing and no hours are left); `resumesAt` when that's known |
| `saved` | the source and, for anything but a page, its transcript | the reader choosing to make its overview |

Both carry `sourceKey`, `keptAt`, `keptFrom` (`web`, `phone`, `panel` or `playlist`), the
reader's `captureReason`, and the title and thumbnail when known. A playlist video also
carries `fromPlaylist`, its place, when it was chosen to make now, and its queue status and
problem (`capture-queue.md`). A capture is never in a share, and goes with the account
(`account-deletion.md`: records and `capture_saves` cascade).

**Why a kind of its own, and not an overview with its note left out.** Every reader of an
overview (chat, MCP, shares, topic counts, time saved, search by meaning) assumes a note,
and the schema requires one. Items without an overview are meant to be left out of exactly
those, so a separate kind leaves them out without touching any of them. The library and
keyword search read both kinds.

It's written whole, like a followed playlist: `POST /api/captures` creates it, or replaces
it with `If-Match`; `DELETE /api/captures/:id` tombstones it. A client before version 31
is never sent one (`sync-api.md`, "A kind a client was built before").

## One live item per source

An account holds one live overview or capture per source (`one-overview-per-video.md`):

- A capture of a source the account holds an **overview** of is refused with
  `video_already_held`, naming the overview. So is a capture under the id of a live
  overview.
- A second capture of a kept source is refused with `capture_already_held`, naming the
  first (`records_one_live_capture_per_source`, V0047).
- On a device, either refusal makes the push `superseded`: the device forgets its copy and
  its pending writes (`SyncStorage.forgetRecord`), since the account's copy will come down
  the feed.

## Becoming an overview

The overview is written under the capture's id, through the usual reservation
(`tiers.md`, "Counting"), so making it later counts once, like any other. When
`POST /api/overviews` writes it, the server tombstones the capture with that id and any
other live capture of the same source (`tombstoneCapturesOf`). A device drops its local
capture as it saves the overview, without journaling, and the tombstone confirms it.

## Made once

A capture waiting in the queue is made by one device at a time. The device claims its
source first (`POST /api/capture-claims/:sourceKey` with a holder id per tab), and gets a
10-minute lease; another device's claim answers `409 claimed_elsewhere` with when it runs
out, and that device leaves the capture alone until then. The holder releases the claim
when its run ends (`DELETE` with the same holder), and a tab that closes mid-run lets the
lease run out (`capture_claims`, V0049). See `capture-queue.md`, "One queue on every device".

## Transcripts

A saved capture holds its transcript the way an overview does
(`transcript-storage.md`, "Following the reader across devices"): saving it journals the
transcript behind it, the server keeps an upload only while a live overview or **saved**
capture uses the source, and removing the capture forgets it. A kept link holds no
transcript. The passages index follows the transcript, so transcript search can find a
saved item.

## The save limit

Saves without an overview are counted on the server, per account per UTC month, in
`capture_saves`: **Free 50, BYO Plus 150, Plus 300** (`apps/api/src/usage/saveQuotas.ts`).
A capture counts once, when it is first written as `saved` (new, or moving from `kept`).
Past the limit the write is refused with `429 too_many_requests`, `quota: "saves"`, the
count, the limit and `resetsOn`; a refused write gives its count back.
`GET /api/overview-usage` reports `saves` beside the overview counts, so the app can show
"6 of 50 saves left this month." when 10 or fewer are left.

**Fetching at the limit.** `POST /api/service-transcripts` used to refuse once both keys'
overviews were spent. It now lets the fetch through while saves are left, so a YouTube
link can still be saved with its transcript (logged as
`api.serviceTranscripts.fetchedForSave`). The owner accepted that proxy spend on 23 Nov
2026; the daily cap per account still holds. With no saves left either, it refuses as
before. Transcribing a podcast or reel at the limit uses the reader's hours
(`speech-to-text.md`), which this doesn't change.

## Saving at the limit

Design 358f. When the month's overviews are made, the soft wall (OV-327) has a second way on
beside Plus: **Wait for {reset}** · "Save it now with its transcript, and make its overview
when your 5 are back." · **Save it for now**. It shows only while saves are left, and adds
"6 of 50 saves left this month." once 10 or fewer are (`overview-usage`'s `saves`).

Save it for now starts the ordinary run with `saveInstead` set (the surface it came from).
The run reads the link and keeps its transcript as usual (a podcast or reel is transcribed
on the reader's hours, as ever); then, where it would write the overview, `writeOverview`
writes a `saved` capture instead (`savedCaptureOf`) and ends with `SavedWithoutOverview`.
That ending is not a failure: the run controller records it on the run (`run.saved`), and
the dialog shows **Saved, with its transcript.**, with the link under "In your library",
**Done** and **Read the transcript** (design 358f-2).

## In the library

Design 358h-5. A saved capture is an ordinary row (`LibraryCaptureCard`): thumbnail,
source, title and "No overview yet · Transcript ready". It counts as unread, so it shows
under Unread only, and is never under a topic, a verdict, a tag, Read or Only favourites,
which its overview decides. **Show › No overview yet** shows only these, and appears in the
Show group while there are any. Keyword search finds one by its title. A capture whose
source already has an overview (made on another device, say) is left out until its
tombstone comes down.

## Opening one

Design 358l. `/overviews/:id` with no overview but a saved capture opens `SavedItemPage`:
the thumbnail, source and length, the title, "Saved 23 Nov · no overview yet", the way to
the source (Watch on YouTube, Open the article, Play the episode), Remove, and the
**Transcript**. Topics, verdict, read and listen times, Listen, Share, Ask, Chapters and
Questions are left out, not greyed out. In the overview's place, one card:

- with the month spent, **No overview yet.**, saying when the overviews are back, and
  **Get Plus**;
- with overviews left, **Make its overview now.** with **Make overview**. A YouTube video
  is made at once under the capture's id, reading the transcript it already has; another
  kind opens Create with its link, and the capture goes when its overview is written
  (`tombstoneCapturesOf`).

Nothing is made on its own when the month resets.

## Not built yet

- Create's "Just now" list, and falling back to a save when the month runs out mid-run.
- Make all, which needs saved items in the queue (slice 4).
- Kept links at the server cap, the queue's new home, and the extension's banner.
- The @ picker's muted row, the events and the "Kept links" dashboard.
