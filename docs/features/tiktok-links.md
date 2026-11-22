# TikTok links

Turning a TikTok link into one video and its words. Trello OV-130's first slice, 22 Nov 2026.
Nothing here is visible to a reader yet: no client calls the routes. The short-video note, a Design
round, the screens (where `TikTokSource` joins `Source`, and the extension reads the reader's own
tab) and speech-to-text for videos without captions are the next slices, in the card's order.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Which kind of TikTok link this is, from its shape | `parseTikTokLink` in `packages/domain` |
| What a video is, and how a read can fail | `TikTokVideo`, `TikTokRead` in `packages/domain` |
| What a TikTok page says, for the extension to read the reader's own tab | `readTikTokPage`, `spokenCaptionTrack` in `packages/transcripts` |
| The vendor our server reads TikTok through | `apps/api/src/tiktok/createScrapeCreatorsTikTok.ts` |
| From a link to the video, and from the video to its words | `createTikTokReader.ts` |
| The route | `POST /api/tiktok/read`, `src/routes/tiktokRoutes.ts` |
| What an overview of a TikTok is of | `TikTokSource`, `tiktokSource` in `packages/domain/src/Source.ts` |
| Writing its note as a video's, and giving it back its source | `clipAsVideo`, `isTikTokInput` in `packages/generation/src/tiktok` |
| From a read and its words to a saved note | `runTikTokOverviewGeneration` in `app-core`'s `generationPipeline.ts` |
| The reader's own browser first, the vendor when it can't answer | `readTikTokLink` in `app-core/src/features/tiktok/api` |
| The extension's own read, and the access it asks for | `chromeTikTokPages.ts` in `apps/extension` |

## Who reads TikTok

The owner, 22 Nov 2026: **the extension first, the vendor everywhere else.**

- **In the extension**, the reader's own browser reads the TikTok page, from the tab they're on or
  by fetching a pasted link. That is free, it stays closest to the reader's own viewing, and nothing
  goes to the vendor. `readTikTokPage` is that reading, shared so the extension can use it
  ("The extension's own read" below).
- **On the web, on a phone, and in the extension when its own read can't answer**, our server
  asks ScrapeCreators (https://scrapecreators.com). **Our server never reads TikTok's pages
  itself.** Doing that as well would add a second exposure to TikTok's terms ("Terms" below) for
  little gain.

## Why the page, and what it carries

TikTok publishes no API for other people's videos. A video's public page, read signed out, carries
the data its own script renders from: `__UNIVERSAL_DATA_FOR_REHYDRATION__` → `webapp.video-detail`
→ `itemInfo.itemStruct`. That holds the author, the description, the length, the cover, the
posting time, and `video.subtitleInfos`: TikTok's own caption tracks, WebVTT files on its CDN.
Most are `ASR`, TikTok's speech recognition of the video, and some are `MT`, machine translations.
The vendor reads the same data and hands back TikTok's internal shape (`aweme_detail`).

Measured on 22 Nov 2026 (the card's comments): 20 of 21 recent videos from news, cooking and
explainer accounts carried an `ASR` track, read from a home connection, and 8 of 8 read the same way
from a Fly machine. The one without was music over on-screen text. `readTikTokPage` was checked
against live pages the same day, with our own user agent and no cookies.

## The extension's own read

Step 4 of the card, 22 Nov 2026. Nothing calls it yet: the panel offer and the paste flow are
the screens, after the Design round.

**It fetches the video's page rather than reading the tab.** TikTok is a single-page app, so the
page data in a tab is from whichever video the tab first loaded, not the one now playing. Fetching
the video's own address gives that video's data whether the link came from the tab or was pasted.
The fetch goes from the extension with no cookies (`credentials: "omit"`), so TikTok sees a
signed-out visitor, as it did in the measurements above. Then the spoken caption track's WebVTT
is fetched and parsed by the same parser the server uses (`parsePodcastTranscript`, now in
`packages/transcripts`), so a note made from either route has the same lines.

**Access is asked for once, for TikTok and its CDNs together:** `*.tiktok.com` (pages and short
links) and `*.tiktokcdn.com`, `*.tiktokcdn-eu.com`, `*.tiktokcdn-us.com` and `*.tiktokv.com`, where
the caption files are (a read from the UK on 22 Nov 2026 got them from `tiktokcdn-eu.com`). They sit
inside the manifest's existing optional `https://*/*`, so the manifest doesn't change, and Chrome
asks the reader only when the screens call `requestAccess` from a click.

**When it falls back** (`readTikTokLink`): without that access, or on the web, the vendor reads it.
With access, a read that comes back with words is used and the vendor is never asked
(`transcriptSource: "tiktok-tab"`). A page saying the post is a photo post is believed, and costs
nothing. Anything else (no captions, a page that won't read, a refusal, a network failure) goes
to the vendor, whose answer is the one shown (`tiktok-vendor`).

## From a link to a video

| Link | Read as |
|---|---|
| `tiktok.com/@handle/video/<id>`, `m.tiktok.com/…`, with any parameters | that video |
| `/embed/<id>`, `/embed/v2/<id>`, `/player/v1/<id>`, `/v/<id>.html`, `/share/video/<id>` | that video |
| `vm.tiktok.com/…`, `vt.tiktok.com/…`, `tiktok.com/t/…` | a short link, for the vendor to follow |
| a profile, a photo post (`/photo/`), a sound, a tag | `not-a-video` |

A video link goes to the vendor as its own address without the sharer's parameters. A link with
no handle goes as `https://www.tiktok.com/@/video/<id>`, which TikTok answers. The kept address is
the canonical one with the real handle. The id is TikTok's own numeric one, so the source key is
`tiktok:<id>` (`source-identity.md`).

How a read fails, by name:

- `not-a-video`: the link isn't a TikTok video, the vendor says it was a bad request (400), or the
  post is a photo post (`image_post_info`).
- `unavailable`: the vendor couldn't find it (404).
- `blocked`: TikTok refused the vendor (403).
- `unreadable`: an answer in a shape we don't know, never guessed at.
- `no-answer`: nothing came back, or the vendor itself failed (401 for a bad key, 402 for no credits,
  500). The log carries the vendor's status, so a spent account or a bad key shows by name.

## From a video to its words

**The words come with the read** (step 3 of the card, 22 Nov 2026). `POST /api/tiktok/read` asks
the vendor with `get_transcript=true`, which returns TikTok's own captions as WebVTT in the same
answer for the same one credit, so a read answers `{ status: "read", video, transcript }`. Slice 1
had a second route, `POST /api/tiktok/transcript`, for the words alone: two credits a note. It was
removed before any client called it.

The captions are parsed by the podcast transcript parser (`parsePodcastTranscript`) into
`StoredTranscript` segments, keyed `tiktok:<id>`. `generated` is true unless the caption track is one
the creator wrote (`is_auto_generated: false`), so the reader is told when the words are
machine-heard. No captions, or empty ones, is a read with `transcript: null`: the video is still
found, and the client decides what to say. The vendor's AI transcript endpoint, and our own
speech-to-text, are slice 5's question.

A trial's read signed out gets the words too, as a YouTube read does: onboarding shows the card
from the read and writes the note once there is an account.

**The words are the account's own copy**, returned to the caller and kept nowhere on the server,
the rule since OV-295.

## A TikTok in the library

Step 4 of the card, 22 Nov 2026. `TikTokSource` joins `Source` with the key `tiktok:<id>`, the
video's own digits (`source-identity.md`, "Adding a kind"). It keeps the video's address, the caption
as its title (or `@handle` when there is none, which is common), the handle and display name, the
length, the posting date and the cover.

**The cover's address expires.** TikTok signs its cover links and they stop working after about a
day, so a library row falls back to the name tile, as an article's dead image does
(`OverviewThumbnail`). Keeping a copy, or asking oEmbed for a fresh one, is a question for the
screens.

**What every card says of it:** the creator's name (or `@handle`), a quiet "TikTok" kind chip (the
owner's call, 22 Nov 2026: a TikTok is its own kind, not a "video" with no chip, OV-232), and
its length as a clock: "0:42 TikTok". In the library's filter it counts as a video. Its ways out
say "Watch on TikTok" and "Copy TikTok link".

**No time links.** TikTok's address takes no start time, so Markdown and chat answers give a
TikTok's times as plain text, as an episode's are. The embed player can seek, and that is for the
screens.

### The note

A TikTok is written by the video note (`generateOverview`, the kind check included, so a recipe
clip gets the recipe note), sized by the short rows in "One note budget"
(`overview-generation-decisions.md`), and then given back its `TikTokSource`. The generator sees it
as a video through `clipAsVideo`: the caption's first 150 characters as the title, its first 400 as
the description (`VideoSource` caps it there), and the whole caption, up to 5,000, as
`fullDescription` when it is longer. The harness run found three captions over 400 characters.

`OurKeyGenerationRequest` takes a TikTok before a plain video, as it does an episode: the video
member would accept the body and drop the `tiktok` field.

### Its words

The client keeps the words under `tiktok:<id>` and puts them in the account's own copy, like any
transcript. **Another device with no copy is given none** (`GET /api/transcripts/:key` answers 404):
fetching them again means a read, and a read costs a credit. Which route found them is
`transcriptSource` on the capture events: `tiktok-tab` (the reader's own tab) or `tiktok-vendor`.

## Cost

Every call is one ScrapeCreators credit, priced at `SCRAPECREATORS_PRICE` ($47 for 25,000 on the
Freelance plan, from its homepage on 22 Nov 2026, since its pricing page was missing). A read,
words included, is one credit. Each one is recorded in the cost tally under `transcripts` /
`tiktok-vendor`, on the account, or on no one yet for a trial's read. Credits only ever come from
what the vendor's answer says it charged.

## Switching it on

The routes answer `unavailable` until `SCRAPECREATORS_API_KEY` is set. The startup log says
which (`api.startup.tiktok`). The key is a secret:

1. The key is in Bitwarden, in `overview-dev` and `overview-prod` (22 Nov 2026).
2. `.env.tpl` and `.env.prod.tpl` carry `SCRAPECREATORS_API_KEY`.
3. `task deploy:secrets` puts it into Fly, which switches TikTok on in production.

## Checked against the vendor

Checked with a real key on 22 Nov 2026, through the built reader and with direct calls:

- **The length is in milliseconds.** `aweme_detail.video.duration` was 80,600 for an 80-second
  video (and `music.duration` was 80).
- **The words are WebVTT** in `transcript`, with `cla_info.caption_infos[].is_auto_generated: true`
  for TikTok's own track. A video without captions answers `transcript: null` and still costs one
  credit, for its details.
- **A missing video** answers 404 `Video not found`, with `credits_charged: 0`.
- **Not yet seen:** a real `vm.tiktok.com` short link. The docs don't say whether the vendor follows
  one, and none was to hand. If it doesn't, it comes back as a failure, and following the redirect
  ourselves is a one-request fix.

## Who may ask

Reading a link runs signed out on a trial's reads, like articles and podcasts, under
`tiktokReadAddress`. Fetching the words needs an account (`generation-behind-account`). Neither
counts against the month. The log carries the link's shape, the outcome, the number of caption
tracks, the credits and the vendor's status. It never holds the link, the handle or the video's id.

## Terms

TikTok's terms (EEA §4.5, July 2026; US §3.4, 15 July 2026; rest of world §5, 1 December 2025)
forbid extracting data or content with automated software without TikTok's written approval.
Paying a vendor moves who does the reading, not whether it happens, and our product still holds
the words either way. The owner decides it with the solicitor before real readers (the card's
definition of done). The extension reading the reader's own tab is the closest to their own use.

`/privacy` and `/terms` are unchanged in this slice, because no client reaches these routes. They
change with the screens, and `/privacy` will then name ScrapeCreators.
