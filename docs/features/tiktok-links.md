# TikTok links

Turning a TikTok link into one video and its words. Trello OV-130's first slice, 22 Nov 2026.
Nothing here is visible to a reader yet: no client calls the routes. The short-video note, a Design
round, the screens (where `TikTokSource` joins `Source`) and speech-to-text for videos without
captions are the next slices, in the card's order.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Which kind of TikTok link this is, from its shape | `parseTikTokLink` in `packages/domain` |
| What a video is, and how a read can fail | `TikTokVideo`, `TikTokRead` in `packages/domain` |
| What a video's page says | `apps/api/src/tiktok/readTikTokPage.ts` |
| From a link to the video, and from the video to its words | `createTikTokReader.ts` |
| The fetch every one of these goes through | `apps/api/src/publicWeb/createPublicWebFetch.ts`, shared with articles and podcasts |
| The routes | `POST /api/tiktok/read`, `POST /api/tiktok/transcript`, `src/routes/tiktokRoutes.ts` |

## Why the page

TikTok publishes no API for other people's videos. A video's public page, read signed out with our
own user agent and no cookies, carries the data its own script renders from:
`__UNIVERSAL_DATA_FOR_REHYDRATION__` → `webapp.video-detail` → `itemInfo.itemStruct`. That holds
the author, the description, the length, the cover, the posting time, and `video.subtitleInfos`:
TikTok's own caption tracks, WebVTT files on its CDN. Most are `ASR`, TikTok's speech recognition
of the video. Some are `MT`, machine translations of it.

Measured on 22 Nov 2026 (the card's comments): 20 of 21 recent videos from news, cooking and
explainer accounts carried an `ASR` track, read from a home connection, and 8 of 8 read the same way
from a Fly machine in `lhr`. The one without was music over on-screen text. Rate limits at real
volume are not yet known: a refusal reads as `blocked`, which the log counts.

## From a link to a video

| Link | Read as |
|---|---|
| `tiktok.com/@handle/video/<id>`, `m.tiktok.com/…`, with any parameters | that video |
| `/embed/<id>`, `/embed/v2/<id>`, `/player/v1/<id>`, `/v/<id>.html`, `/share/video/<id>` | that video |
| `vm.tiktok.com/…`, `vt.tiktok.com/…`, `tiktok.com/t/…` | a short link, followed to the page it names |
| a profile, a photo post (`/photo/`), a sound, a tag | `not-a-video` |

A video is always read at `https://www.tiktok.com/@/video/<id>`: TikTok answers without the handle,
so the reader's link, its handle and its sharer's parameters never matter. The kept address is
the canonical one with the real handle, from the page. The id is TikTok's own numeric one, so the
source key is `tiktok:<id>` (`source-identity.md`).

How a read fails, by name:

- `not-a-video`: the link isn't a TikTok video, or the page is a photo post (`imagePost`).
- `unavailable`: the page says so with a status and no item (10204 for a removed video), or
  answers 404.
- `blocked`: TikTok refused us (401, 403, 429 and the like).
- `unreadable`: the page answered with no data in the shape above. That is a verification page,
  or TikTok changing its format, and is never guessed at.
- `no-answer`: nothing came back in time.

## From a video to its words

`POST /api/tiktok/transcript` takes `{ videoId }` and reads the page again, since the caption
addresses expire. The spoken track wins: `ASR` first, a translation only when there is nothing
else. The WebVTT is parsed by the podcast transcript parser (`parsePodcastTranscript`) into
`StoredTranscript` segments, keyed `tiktok:<id>`. `generated` is true for `ASR` and `MT`, so the
reader is told the words are machine-heard.

No caption track, or an empty one, is `transcript_unavailable` with `failure: "no-captions"`.
Speech-to-text for those is slice 5.

**The words are the account's own copy**, returned to the caller and kept nowhere on the server,
the rule since OV-295.

## Who may ask

Reading a link runs signed out on a trial's reads, like articles and podcasts, under
`tiktokReadAddress`. Fetching the words needs an account (`generation-behind-account`). Neither
counts against the month. The log carries the link's shape, the outcome, how many tracks there
were, the track's source and the segment count. It never holds the link, the handle or the video's
id.

## Terms

TikTok's terms (EEA §4.5, July 2026; US §3.4, 15 July 2026; rest of world §5, 1 December 2025)
forbid extracting data or content with automated software without TikTok's written approval.
robots.txt allows generic agents on `/@*/video/` but bars named AI agents site-wide. Reading the
page from our server is the posture server-side YouTube captions already take. The owner decides it
with the solicitor before real readers (the card's definition of done). Slice 4 reads the reader's
own tab first through the extension, with the server as the fallback.

`/privacy` and `/terms` are unchanged in this slice, because no client reaches these routes. They
change with the screens.
