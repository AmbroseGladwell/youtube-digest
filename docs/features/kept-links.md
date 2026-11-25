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

| Stage   | Holds                                                   | Waits for                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kept`  | the pasted address, and the source if it was read       | `waitingFor`: `turn` (a playlist video waiting in the queue), `server` (our server's daily cap or a slow-down), `extension` (only the extension can read it), or `reset` (it needs transcribing and no hours are left); `resumesAt` when that's known |
| `saved` | the source and, for anything but a page, its transcript | the reader choosing to make its overview                                                                                                                                                                                                              |

Both carry `sourceKey`, `keptAt`, `keptFrom` (`web`, `phone`, `panel` or `playlist`), the
reader's `captureReason`, and the title and thumbnail when known. A saved one also keeps
`notes`: the description, show notes or caption its overview is written with. A playlist video also
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
`capture_saves`: **Free 50, BYO Plus 50, Plus 300** (`saveQuotas` in `@overview/domain`; BYO Plus came down from 150 to Free's in OV-351's design round, 25 Nov 2026).
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
Show group while there are any. Keyword search finds one by its title, and **Said in the
transcripts** by what its transcript says (`itemTranscriptMatches` on the server, which also
resolves a source to a live saved capture; the MCP connector's `transcriptMatches` still
resolves only overviews). Its "Said in the video at 1:05" opens the item with its
transcript at that moment. A capture whose
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
- with overviews left, **Make its overview now.** with **Make overview**, which writes it
  at once from what was kept (`runSavedOverviewGeneration`): the transcript on this device
  and the capture's `notes`, the description, show notes or caption the run had when it
  saved, under the capture's id, so nothing is read or fetched again and it's filed into
  projects as a new overview is. A page keeps no text, so an article opens Create with its
  link instead; so does a source whose transcript isn't on this device
  (`SavedSourceNeedsReadingError`). Either way the capture goes when its overview is
  written (`tombstoneCapturesOf`).

Nothing is made on its own when the month resets.

## Several in a row

Designs 358a–358d; decided with the owner on 24 Nov 2026 to follow them with one change:
**overviews are written one at a time**, while later links' transcripts may be fetched
meanwhile.

- **Create** is one field with **Make my overview** inside it and the usage line under it.
  Making one clears the field and keeps it focused, so the next link can go straight in.
  The dialog no longer turns into a progress screen.
- **Just now** lists every link given since the dialog was opened, in order (`JustNowList`).
  Each row says where it has got to, worked out from the same steps the old progress view
  used (`justNowRowOf` over `generationRunSteps`): fetching or writing, with "Step 1 of 2"
  and a bar; **Made** with "Overview written · 2 min read" and **Read overview**; **Saved ·
  no overview yet**; or the run's error. A link given while another is being made waits as
  **Next**; a YouTube link's transcript is fetched for it straight away (`usePrefetchVideo`),
  so its title shows and its run starts from the stored words.
- **One at a time.** `useNewOverviewRun` keeps a queue for runs started from Create: the
  next starts as the last finishes, whether or not the dialog is open, and Done (or
  closing) leaves them running. A run started elsewhere (the panel, a regeneration, a saved
  item's Make overview) replaces what's running, as before.
- **When the month runs out mid-way** (358b-3), the next link waiting is saved with its
  transcript instead of made, and a run the server refuses for the month is saved instead
  rather than failing.
- **Add a reason** sits on the row being made (left out on a phone), and opens the reason
  field for that link.
- The foot line "You can close this, it keeps going." stays while anything runs, and in the
  extension still says that closing the side panel stops it. There's no Cancel for a run.
- **Already in your library. Open it** shows under the field (358c) in place of a screen of
  its own.

## Kept links

Design 358g, 358i. When our server can't fetch a YouTube link right now (its daily cap, or
asked to slow down), the run's row in Create says **This one can't be fetched right now.**
with when fetching is back, **Keep it** and **Not now**. Keep it writes a `kept` capture
(`waitingFor: "server"`, `resumesAt` from the server's own `Retry-After`), and the row says
**Kept. It'll be made after 01:00.** with "Continues after 01:00".

`useKeptLinks`, beside the playlist queue in the app shell, makes each kept link when it's
due (`keptLinkDue`): after its time on our server, at once on a device with the extension
(which fetches for itself), and not while the reader's own run is going. It claims the
source first (see "Made once") and makes it under the capture's id, so the overview takes
its place. With the month spent by then, it's saved with its transcript instead; asked to
wait again, its time moves on; any other failure marks it **Needs attention**, with Try
again and Dismiss. Only YouTube links are kept for now: the extension-only TikTok case comes
with the extension's banner.

The **Queue page** shows them below the playlist's groups (`KeptLinksSection`): Making now,
**Continues after 01:00 · n** with "Fetching from YouTube is paused on us until 01:00. These
carry on then, or now in the extension on a computer.", **Ready in the extension · n**, and
Needs attention. Each row's line says what it waits for and where it came from ("Added by
you", "From your phone").

**The queue is off the Overviews list** (358h-6 to 358h-10). Since OV-399 it is the sidebar's
Queue item, or a line under the search row without one (`navigation.md`); what follows is how
it was first built. `QueueLink` sat at the top of
the sidebar, which is the Filters sheet on a phone, with how many wait, shown only while
something does, and "1 needs attention" in the alert colour when something does. The strip
under the masthead is gone on the web and the phone; the link is the way in, and the first-run
and Start screens carry it too while the library is empty.

**Make all** (358h-5): on Show › No overview yet, once overviews are back, "Make all 2 ·
uses 2 of your 5" makes each saved video, episode, TikTok and post one after another
(`makeAllSaved`, queued behind whatever is being made), up to what's left this month.
Articles still need Create.

## In the extension

Design 358j. The extension makes kept links itself as soon as its panel opens, since it
reads YouTube in the reader's own browser; nothing waits for a press, because the reader
already pressed Make. While any are waiting or being made, the panel's page says so above
everything else (`KeptHereBanner`): "1 link from your phone is ready to make here.", then
"Making 1 link from your phone here. Keep this panel open until they're done." The design's
Make them button and list are left out for that reason, and its "they carry on while the
browser is open" isn't said, since closing the side panel stops them.

## In chat

Design 358l-5. Until it has its overview an item is left out of chat, as a reason to
upgrade: there is no Ask on it, and library and project chat read only overviews. Chat's @
picker still finds it by title, among overviews by date, but muted and never chosen
(`aria-disabled`; the arrow keys and Enter pass over it). Under it, "No overview yet, so it
can't be asked about yet", then **Get Plus**, or **Make its overview** once overviews are
back, which opens it. Get Plus sits outside the option, so it isn't read as disabled with
it.

## Events

Under `keptLinks` in the catalogue, each with `plan` and `captureSurface` (web, phone or panel),
never the link. Until 25 Nov it was `surface`, which the event's context overwrote with
`web` or `extension`, so earlier events don't say where:

- `queue.linkKept`: Keep it pressed, with what the link waits for.
- `queue.keptLinkMade`: an overview written for a kept link, with how many minutes it
  waited, what for, where it was kept, and whether the extension made it.
- `queue.keptLinkRemoved`, `queue.keptLinkFailed` (with the problem).
- `saved.savedWithoutOverview`: whether it was transcribed and whether it was a kept link.
- `saved.overviewMadeLater`: hours waited, and `after`: `reset` when the UTC month turned
  since it was saved, `sameMonth` when more overviews came another way (a plan, a key).
- `saved.saveCapReached`: the wall met with no saves left.

The server logs `capture claim expired` when a device takes over a claim another left to
run out. The "Kept links" dashboard in PostHog reads these.

## Already here

Design 358c-2. Before a run starts, Create checks the library for the video (`alreadyHeld`):
an overview says "Already in your library. Open it"; a saved capture "Already saved · no
overview yet. Open it"; a kept or queued one "Already in your queue. See queue". Nothing is
counted, and `capture.newOverview.alreadyHeld` carries which (`held`). Open it and See queue
close the dialog without cancelling links still waiting in Just now. A link already being
made or waiting in Just now is never added again, and Try again on a failed row takes that
row's place.

## Out of transcribing

When a podcast needs transcribing and the month's hours are used, the stop under the link
(`EpisodeWordsNote`) offers **Keep it until 1 November**, the usage's reset. It keeps the
link with `waitingFor: "reset"` and `resumesAt` at the reset, with its podcast source, and
says "Kept. It's transcribed and made on 1 November, when your hours are back." Saving at
the limit that meets the same refusal mid-run keeps it the same way (`keepUntilReset`). Once
the reset has passed, the kept-link runner reads the episode again (`POST /podcasts/read`),
transcribes it and makes it under the kept id; still short of hours, it waits for the next
month. On the Queue page it reads "Continues on 1 November". TikToks and posts wait for
OV-403, since only the extension reads some of them.

## Removing one

Remove on a kept link hides it at once and says "Removed “title”." with **Undo** for the
toast's six seconds (`usePendingRemovals`); focus goes to the Kept links group. The capture
is removed, and `keptLinkRemoved` sent, only once the Undo has passed, or at once if the page
closes first.

## Not built yet

- Keeping a TikTok only the extension can read, and making it there (OV-403).
