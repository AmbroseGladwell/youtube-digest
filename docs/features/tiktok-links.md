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
| The player, speaking TikTok's embed messages | `TikTokEngine`, `useTikTokEngine` in `app-core/src/features/reader/tiktok` |
| Where it sits, and the bar that stands in for it | `TikTokPlayer`, `TikTokMiniBar`; `ReaderPage` places them |
| A pasted link read, its card, its stops and failures | `useTikTokLink`, `TikTokLinkStatus`, `tiktokLinkFailureCopy` in `newOverview` |
| The panel's offer on a TikTok tab | `useTikTokTab`, `TikTokOffer` in `capture` |

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

**The panel's offer** (designs 130i, 130i-2). On a TikTok video's tab the panel shows "On this tab"
and "Make an overview of this TikTok". Looking at a tab spends nothing: with TikTok's access already
granted the browser reads it for the whole card, and without it the card is the tab's own title. The
press asks Chrome for TikTok (it must be inside the click), then reads it, the browser first and the
vendor silently after. Only when both fail does it say "This TikTok can't be read right now … Nothing
was used." with Try again. A TikTok tab is never offered as an article.

**When it falls back** (`readTikTokLink`): without that access, or on the web, the vendor reads it.
With access, a read that comes back with words is used and the vendor is never asked
(`transcriptSource: "tiktok-tab"`). A page saying the post is a photo post is believed, and costs
nothing. Anything else (no captions, a page that won't read, a refusal, a network failure) goes
to the vendor, whose answer is the one shown (`tiktok-vendor`).

## Onboarding

Step 5 of the card, 22 Nov 2026. `onboardingSources.tiktok` is a full entry: it reads the link
through `readTikTokLink` (the extension's own read, then the vendor, a trial's read signed out),
shows the card from the read, and writes the note with the words it came with once there is an
account (`runTikTokOverviewGeneration`), as a video's does. A link it can't read stops with
`TikTokReadError`, and a video with no captions with `TikTokNoCaptionsError`, each before
anything is spent on writing. Their words in `onboardingFailureCopy` follow the other kinds' until
the Design round's failure frames.

**Switched on with the screens** (`TIKTOK_AT_START`, 23 Nov 2026), in the PR that names ScrapeCreators
in `/privacy`: a TikTok link at Start, or in a shared page's promo, now goes to this entry, and
`ACCEPTED_LINKS` names TikTok. A profile or photo-post address isn't taken. Production also needs
the vendor's key (`task deploy:secrets`) before a read works there.

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
found, and with speech-to-text on, the read also says whether it can be transcribed
(`transcription`, the podcast `TranscriptionOffer`: needed, not enough hours left, free because it
already was, too long, or no file). See "Transcribing a TikTok with no captions".

## Transcribing a TikTok with no captions

Slice 5, 23 Nov 2026. **The owner chose our own Whisper on Modal (OV-305) over the vendor's AI
transcript** (`/v1/tiktok/video/transcript` with `use_ai_as_fallback`: 1 credit up to 2 minutes,
then 10 credits a started minute). That gives the same model and quality as episodes, at fractions
of a cent. It also means Modal downloads the video file from TikTok's CDN: the one place our
infrastructure fetches from TikTok, and only when the reader asks.

**The file's address never comes from the caller.** `POST /api/tiktok/transcription { url }` (an
account only, the transcription rate limit) reads the TikTok afresh through the vendor, without the
captions (one credit), and takes the file's address from that answer: the smallest of
`video.bit_rate`'s renditions, else `video.play_addr`, HTTPS only (`mediaUrl`, which stays on the
server and is never in a read's answer). That is the podcast rule (a caller can't name what our GPU
host downloads), and it also gets a fresh address, since TikTok's are signed and expire. Checked
on 23 Nov 2026: every address the vendor gave (play, download, and the "original sound" MP3) answered
206 to a plain request with no cookies and an honest user agent.

**Then it is an episode's transcription.** `startAudio` (split out of `createPodcastTranscriptions`)
queues it under `tiktok:<id>` on the same jobs table, queue, host, allowance (hours per month, held
from the TikTok's length, settled to what was heard), cost tally entry and failures.
`GET /api/tiktok/transcription/:id` answers its progress, the podcast `PodcastTranscription`. A
TikTok over four hours, or with no file, is refused as an episode is, and a TikTok that no longer
reads answers `transcript_unavailable` with `{ tiktok: <reason> }`. The words reach the reader as an
episode's do: collected from the ready answer within a day, then kept as the account's own copy.

A trial's read signed out gets the words too, as a YouTube read does: onboarding shows the card
from the read and writes the note once there is an account.

**The words are the account's own copy**, returned to the caller and kept nowhere on the server,
the rule since OV-295.

## A TikTok in the library

Step 4 of the card, 22 Nov 2026. `TikTokSource` joins `Source` with the key `tiktok:<id>`, the
video's own digits (`source-identity.md`, "Adding a kind"). It keeps the video's address, a title
made from the caption (`tiktokTitle`, design 130g: the caption without the hashtags after its words;
one that is only hashtags as written; none, "A TikTok by @handle"), the handle and display name,
the length, the posting date and the cover.

**The cover's address expires.** TikTok signs its cover links and they stop working after about a
day, so a library row falls back to the name tile, as an article's dead image does
(`OverviewThumbnail`). Keeping a copy, or asking oEmbed for a fresh one, is a question for the
screens.

**How it looks** (design 130g, 130j): the portrait cover is matted on the stone tint in the 16:9
slot of the library row and the note's head, never cropped, as a podcast's square art is. The
note's byline is the display name with the handle after it.

**What every card says of it:** the creator's name (or `@handle`), a quiet "TikTok" kind chip (the
owner's call, 22 Nov 2026: a TikTok is its own kind, not a "video" with no chip, OV-232), and
its length, in seconds under a minute: "58 s video" (design 130g, 130j). In the library's filter it counts as a video. Its ways out
say "Watch on TikTok" and "Copy TikTok link".

**No time links.** TikTok's address takes no start time, so Markdown and chat answers give a
TikTok's times as plain text, as an episode's are. The embed player can seek, and that is for the
screens.

### Pasting a link

Designs 130a to 130f and 130l to 130n. In the New dialog and the home field, a TikTok link is read as
it settles (`useTikTokLink`), through `readTikTokLink`: the reader's own browser first in the
extension, our server's vendor read elsewhere. It needs an account, as an episode's read does.
**A TikTok link is never read as an article or an episode**: both of those readers fetch the page
on our server, and our server never reads TikTok's pages.

The card shows the 9:16 cover with the length on it, "@handle · TikTok", the caption as written
with the hashtags after its words muted (an empty caption reads "A TikTok by @handle" in muted
italics), and "0:58 · Posted 18 Nov 2026". Create starts the run with the video and the words the
read came with, so making only writes: "Found the video · TikTok · 0:58", "Captions found · 228
words", then writing.

**Stops, found before Create and never counted:** no captions ("This TikTok has no captions", with
the two steps it got through) and fewer than 30 caption words ("There's no speech in this to make an
overview from"), both counted in code. Music or sound is the kind check's answer, after Create:
"This one is music or sound rather than talk". That run stop (`RunError` `noSpeech`) serves every
kind, so a YouTube Short with no speech says so too.

**Failures**, each ending "Nothing was used." and never naming the vendor: private or removed;
TikTok refused (Try again); a photo post or a profile, known from the address without a read; and
our server not reading TikTok at all ("TikTok links aren't working right now").

### The player

Designs 130g, 130h, 130h-3, 130p and 130p-3. TikTok's v1 embed (`/player/v1/<id>`) is driven by
`postMessage`: the page sends `{ "x-tiktok-player": true, type, value }` with `play`, `pause` and
`seekTo` (seconds), and the player answers `onPlayerReady`, `onStateChange` (1 playing, 2 paused,
0 ended), `onCurrentTime` (`currentTime` and `duration` in seconds) and `onPlayerError`. Only
messages from `https://www.tiktok.com` and that iframe are heard. `TikTokEngine` turns them into
the same `PlaybackSource` an episode gives, so the note follows playback and its times play in
place without anything new in the note itself: a time is a play chip, as an episode's is.

**The embed is made only when pressed** (the cover's play button or a time), since TikTok limits
embeds per site. A time pressed before then opens the player and seeks there once it says it is
ready. **A player that won't load** says "TikTok didn't load the video here" with Watch on TikTok:
an `onPlayerError`, or no `onPlayerReady` within 12 seconds. After that a time opens the clip on
TikTok. A browser refusing autoplay (error 3002) only leaves the player waiting for a press inside
it. The note's narration and the clip never play together.

**Where it sits:** docked beside the note on the web (280px, sticky, the column chat uses) while
chat is closed; above the title, centred, with chat open (200px at 1440, 170px at 1024); in the
head's place on a phone and in the panel. Watch on TikTok is always under it. Scrolled away from it
while it plays, a slim bar (cover, pause, time, progress, Back to the video) sticks to the top of
the note.

### The shared page and the link preview

Designs 130q, 130q-2 and 130q-3. The shared page keeps its own layout, with a "TikTok" chip before
the channel line and Watch on TikTok. Signed out, the promo has the column beside the note, so the
player sits centred above the title; signed in without a copy, there is no promo and the player
docks in that column; on a phone it takes the head's place and the promo follows the note. Its times
play in place there too.

**The link preview stays the text card** every shared page has (`shareCard.ts`). 130k draws the
portrait cover in the preview's image slot, but the card is drawn from the snapshot alone, and
putting the cover in would mean our server fetching from TikTok's CDN, which it doesn't. The
preview's description already says "58 s video".

**A cover that won't load leaves the stone tint** (`TikTokCover`), never a broken picture, since
TikTok's cover links expire after about a day.

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
words included, is one credit, and asking to transcribe a TikTok spends one more for the fresh
read, plus the GPU time recorded under `transcripts` / `speech-to-text`. Each one is recorded in the cost tally under `transcripts` /
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
