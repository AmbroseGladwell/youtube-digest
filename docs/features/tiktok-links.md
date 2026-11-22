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
| The routes | `POST /api/tiktok/read`, `POST /api/tiktok/transcript`, `src/routes/tiktokRoutes.ts` |

## Who reads TikTok

The owner, 22 Nov 2026: **the extension first, the vendor everywhere else.**

- **In the extension**, the reader's own browser reads the TikTok page, from the tab they're on or
  by fetching a pasted link. That is free, it stays closest to the reader's own viewing, and nothing
  goes to the vendor. `readTikTokPage` is that reading, shared so the extension can use it. It is
  built in the screens slice.
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

`POST /api/tiktok/transcript` takes `{ url }`, the video's address from the read. It asks the same
vendor endpoint with `get_transcript=true`, which returns TikTok's own captions as WebVTT for
the same one credit. Those are parsed by the podcast transcript parser (`parsePodcastTranscript`)
into `StoredTranscript` segments, keyed `tiktok:<id>`. `generated` is true unless the caption
track is one the creator wrote (`is_auto_generated: false`), so the reader is told when the words
are machine-heard.

No captions, or empty ones, is `transcript_unavailable` with `failure: "no-captions"`. The vendor's
AI transcript endpoint, and our own speech-to-text, are slice 5's question.

**The words are the account's own copy**, returned to the caller and kept nowhere on the server,
the rule since OV-295.

## Cost

Every call is one ScrapeCreators credit, priced at `SCRAPECREATORS_PRICE` ($47 for 25,000 on the
Freelance plan, from its homepage on 22 Nov 2026, since its pricing page was missing). A read and a
transcript are two credits. Each one is recorded in the cost tally under `transcripts` /
`tiktok-vendor`, on the account, or on no one yet for a trial's read. Credits only ever come from
what the vendor's answer says it charged.

## Switching it on

The routes answer `unavailable` until `SCRAPECREATORS_API_KEY` is set. The startup log says
which (`api.startup.tiktok`). The key is a secret:

1. The owner registers at ScrapeCreators and puts the key in Bitwarden, in `overview-dev` and
   `overview-prod`.
2. Only then does `SCRAPECREATORS_API_KEY="${SCRAPECREATORS_API_KEY}"` go into `.env.tpl` and
   `.env.prod.tpl`. A placeholder Bitwarden doesn't carry refuses the whole render (`secrets.md`).
3. `task deploy:secrets` puts it into Fly.

## What is not yet checked

These need a real key, and the first live call should check them:

- **The length's unit.** `aweme_detail.video.duration` is read as milliseconds, as TikTok's
  own API counts it and as the vendor's sample suggests. Their docs don't say outright.
- **Short links.** The docs don't say whether `vm.tiktok.com` links are followed. If they aren't,
  they come back as a failure, and following the redirect ourselves is a one-request fix.
- **What a failure costs.** The docs give each call as one credit and "no transcript" as none.
  The tally records whatever the answer says it charged.

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
