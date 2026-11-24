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
| `kept` | the pasted address, and the source if it was read | `waitingFor`: `server` (our server's daily cap or a slow-down), `extension` (only the extension can read it), or `reset` (it needs transcribing and no hours are left); `resumesAt` when that's known |
| `saved` | the source and, for anything but a page, its transcript | the reader choosing to make its overview |

Both carry `sourceKey`, `keptAt`, `keptFrom` (`web`, `phone` or `panel`) and the reader's
`captureReason`. A capture is never in a share, and goes with the account
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

## Not built yet

- The synced queue: playlist captures as entries of this kind, a server claim so each is
  made once, and pause and choices per account.
- Create's "Just now" list, the soft wall's *Save it for now*, the item without an
  overview, *Show › No overview yet*, and Make all.
- Kept links at the server cap, the queue's new home, and the extension's banner.
- The @ picker's muted row, the events and the "Kept links" dashboard.
