# Instagram and Facebook posts

OV-365. A reader pastes an Instagram or Facebook link and gets an overview of the post. A
video post is written from its words and its description; a photo or text post from its
description alone. It builds on TikTok (`tiktok-links.md`): the same vendor, the same
transcription queue, the same short-video note.

## Who reads them

Only ScrapeCreators (https://scrapecreators.com), through our server. A signed-out server
gets nothing from either platform: an Instagram reel's page is an empty shell, Meta's
tokenless oEmbed returns only a placeholder, and there is no official API for other
people's posts. There is no extension read, unlike TikTok: the reader's own login would be
the only way in, and it never reaches us from a pasted link or a phone.

**Our server never reads Instagram's or Facebook's pages.** Modal downloads a video's file
when the reader asks for it to be transcribed (below), as it does for TikToks.

## What we keep, and what we never read

The post: its platform, id, link, the author's handle and name, **the description, whole**,
whether it is a video, photo or text post, a video's length, the cover's address and the
date. On these platforms the description often carries the post (the recipe, the steps, the
argument), so it goes to the model in full, for photos as much as videos.

**Comments are never read.** Creators sometimes put the main content in a comment, but
comments are other people's words, and the owner decided (23 Nov 2026) not to collect
them. ScrapeCreators' Instagram answer includes some comments whether asked or not; our
parser reads only the fields above, so they are dropped on arrival and never stored,
logged or sent on (`createScrapeCreatorsSocial.ts`, tested).

## From a link to a post

`parseSocialPostLink` (domain) turns a link into one of:

- **a post with its id**: Instagram `/reel/`, `/reels/`, `/p/`, `/tv/`, with or without the
  account in front (`instagram:<shortcode>`); Facebook `/reel/<id>`, `/watch?v=<id>`,
  `/<page>/videos/…/<id>` and `/video.php?v=<id>` (`facebook:<id>`);
- **a share link** the vendor follows, because only the redirect says which post:
  Instagram `/share/…`; Facebook `/share/r|v|p/…`, `fb.watch/…`, a page's `/posts/…`,
  `permalink.php` and `story.php`;
- **not a post**: profiles, stories, groups, explore pages, malformed ids;
- `null` for any other site.

The key is the vendor's id, not the link's: a Facebook video's `video.id`, or a photo
post's `post_id`; an Instagram post's shortcode.

## The vendor's answers

Checked live on 23 Nov 2026 (OV-365's card has the findings):

| | Instagram `GET /v1/instagram/post` | Facebook `GET /v1/facebook/post` |
|---|---|---|
| Cost | 1 credit; a missing post 0 | 1 credit, captions included |
| Kind | `__typename`: `XDTGraphVideo`, `XDTGraphImage`, `XDTGraphSidecar` (a carousel, treated as photos) | `video` present → video; else `image_url` → photo; else text |
| Description | `edge_media_to_caption.edges[0].node.text` | `description` |
| Length | `video_duration`, seconds | `video.length_in_second` |
| File | `video_url` | `video.sd_url` (smaller), else `hd_url` |
| Words | none | `get_transcript=true` → SRT: Facebook's own captions, or the vendor's AI up to 2 minutes |

Both files download with no cookies and a plain user agent. Both are signed and expire
(`oe=` is the expiry, days ahead), and **a cached vendor answer can hold an expired
address**: one cached Facebook answer's file had expired six days before. So a read made to
transcribe never asks for a cached answer.

## From a video to its words

- **Facebook:** the read asks for the transcript in the same credit. Any lines that come
  back are the account's own copy (`generated: true`: the vendor doesn't say whether they
  are the creator's captions or its AI).
- **Instagram:** no captions at all, so a reel's words come from transcribing it.
- **Photo and text posts** have no words; the description is the content.

## Transcribing a video

Exactly as for a TikTok (`tiktok-links.md`, "Transcribing a TikTok with no captions"): the
read offers it on the month's hours, nothing is transcribed unless the reader asks, and
`POST /api/social/transcription {url}` reads the post afresh for the file's address rather
than taking one from the client. A photo or text post answers `no-audio`.

## Routes

- `POST /api/social/read {url}` → `SocialRead`: the post, a Facebook video's words, and a
  transcription offer for a video without them. Signed out, a trial's reads (as TikTok).
- `POST /api/social/transcription {url}` and `GET /api/social/transcription/:id`: account
  only.
- Without `SCRAPECREATORS_API_KEY`, both answer `unavailable` and startup logs `social posts`
  disabled.

## Cost

Each credit goes into the cost tally under `transcripts` / `social-vendor`, on the account or
on no one yet. A read is one credit, and transcribing reads once more.

## Who may ask

Logged: the platform, the link's shape, the outcome, the media, how many caption lines, the
credits and the vendor's status. Never the link, the account, the description or the words
(`social post read`).

## A post in the library

`instagram` and `facebook` are two kinds sharing one shape, `SocialSource` (`Source.ts`),
told apart by `kind`, with `media` saying video, photo or text. `isClipSource` groups them
with TikTok wherever a short platform video differs from a YouTube video: named by its
creator, a chip with the platform's name, a matted portrait cover, a length in seconds under
a minute, no time in its address, and "Watch on Instagram/Facebook" for the way out.

The title is the description's first line, without the hashtags after its words, cut at a
word under 120 characters; with no description, who posted it ("An Instagram video by
@windowsillgarden"). The rest of a long description is the post, so it stays out of the
title and goes to the model.

## The note

A video post is written as a TikTok is: as a short video, from its words, then given back
its own source (`SocialGenerationInput.ts`). Its description goes in as the video's
description, and **the whole of it** as `fullDescription`, which a social post may fill to
20,000 characters (`FULL_DESCRIPTION_MOST`), where a YouTube description stops at 5,000.
Instagram's captions stop at 2,200 characters, so theirs always goes whole.

A photo or text post is written from its description alone, as a short article is
(`postAsArticle`): the description becomes a one-section article, its blank lines paragraph
breaks, with the platform as the site and the poster as the author, and the article prompt
writes it, then the post gets its own source back. A post's `wordCount` is its
description's, so the written budget (three key points under 400 words), time saved and
"Read it anyway?" all work as they do for an article. There are no words to look up, no
transcript is kept, and the note has no Transcript tab or player.

**Too few words, nothing spent.** A photo or text post under 30 words of description
(`POST_LEAST_WORDS`) is refused before anything is written: a note would only restate it
(`SocialPostTooShortError`). A video is never refused this way: its words count, as a
TikTok's do.

`isWrittenSource` (`Source.ts`) is the question "is this note read rather than watched?":
an article, or a photo or text post. Time saved, chat (answered from the note alone, as an
article's is), "Read it anyway?", the MCP transcript tools and onboarding's expected length
ask it. Article-only parts (chapter places on the page, resources, the article byline) still
ask for `web`, so a post's note has none of them. In the library a post files under
Articles; its chip still says Instagram or Facebook.

## Pasting a link

`useSocialLink` reads a pasted Instagram or Facebook link through `POST /api/social/read`
as soon as it settles, with an account (TikTok's flow, `tiktok-links.md`, without the
browser read). `SocialLinkStatus` shows the post's card: who posted it and the platform, the
title, and "0:59 · Posted 21 Nov 2026" for a video or "Photo post · 56 words" otherwise.
What it can't make stops before Create, and costs nothing (`socialStopCopy`):

- a video with no words and nothing to transcribe with, or under 30 words said;
- a photo or text post with under 30 words of description.

A video with no words offers Transcribe and create, on the month's hours, as a TikTok does,
and transcribing sends the post's own address, without the sharer's parameters. Failures say
what happened and never name the vendor (`socialLinkFailureCopy`).

**Never read as a page.** An Instagram or Facebook link is never an article: the article and
podcast readers skip it, the extension panel doesn't offer such a tab as a page, and
right-clicking one opens the paste dialog with its link instead of reading the tab (where
comments sit beside the post). TikTok links get the same right-click treatment.

## Timestamps

No player can seek an Instagram or Facebook video, so a note's times show as plain text:
`youtubeMomentUrl` answers only for YouTube, and key point, chapter, dubious-claim and chat
citation times link out only where it does. The Transcript tab still reads along.

## Not yet

- Onboarding: it takes no Instagram or Facebook link yet (the next slice).
- The extension panel offers nothing for an open Instagram or Facebook tab; paste the link.
- Videos inside a carousel: a carousel is read for its description only.
- Comments, by decision (above).
