# Following feeds

Card: OV-219. Decided with the owner on 27 Nov 2026.

A reader follows a podcast, a blog or newsletter, or a YouTube channel, by pasting its link,
as with a YouTube playlist (`playlists.md`, "Pasting a link"). New items arrive in the queue as
`kept` captures (`kept-links.md`), waiting for the reader in *Waiting for you*
(`capture-queue.md`, "Waiting on a pace"). Nothing is fetched, transcribed or written until
the reader chooses one, and then it's made like any other link of its kind and counts once.

**Built so far:** reading a feed (slice 1). The shared feed store, the follow record, the
check and the screens follow in later slices of the same card.

## Decisions

- **Our server reads feeds**, never the reader's device. One stored copy of each feed serves
  every follower, read again at most every 30 minutes, and only when a follower opens the
  app. A feed none of its followers open is never fetched.
- **An entry carries only what the feed gives:** title, link, date, length, artwork and a
  short description. No premise, no transcript, no model call.
- **Entries don't count against the save limit** (`kept-links.md`, "The save limit"). Each
  source keeps its newest entries waiting, up to a cap. When a new one arrives and the cap is
  full, the oldest unmade one drops off. Never dropped: an entry the reader has chosen or
  that is being made.
- **The default pace for a feed is *Only when I choose*.** Every other pace is offered, as for
  playlists.
- **Every kind is named in words:** YouTube playlist (unchanged, `followedPlaylist`), YouTube
  channel, Podcast, Blog. A newsletter with a feed is a Blog.
- **50 feeds followed, on every plan.** Following costs nothing; making an overview is what
  the month's allowance counts. Playlists have no limit, and keep none.
- Following starts from a pasted link in Create, and in the side panel from Settings.

## Reading a feed

`readFeedItems` (`apps/api/src/feeds/`) reads RSS 2.0, RSS 1.0 and Atom as the bytes
arrive, with htmlparser2 in XML mode as `readFeedEpisode` does (`podcast-links.md`, "Reading a
feed"). It gives the feed's title, site and image, and its newest entries, each with an id
(the guid or Atom id, else its link), a kind, a title, its page, date, length, audio file,
YouTube video id, image and a description of at most 2,000 characters. A long post's full
text is never kept: the description is taken from the short fields first
(`description`, `summary`, `itunes:summary`, `media:description`), and from the full content
only when there is nothing shorter, and then cut.

An entry with nothing to open (no page, no audio, no video) is left out. A document whose
first element isn't `rss`, `rdf:RDF` or `feed` is `notAFeed`.

**When reading may stop early.** Most feeds list the newest first, and podcast feeds run to
megabytes, so reading stops as soon as it can:

- once it holds the most entries asked for, while the entries so far have come newest first;
- at an entry already held, if it's no older than the newest entry held
  (`newestKnownAt`) and the entries so far have come newest first.

A feed that lists the oldest first, or an older held entry met before newer ones, is read
to the end (within the byte cap), and the newest entries are the ones kept.

## Kinds

**Each entry has its own kind,** decided by what it carries:

| Carries | Kind | Made as |
|---|---|---|
| a YouTube video id (`yt:videoId`, or a `youtube.com/watch` link) | `video` | a YouTube overview |
| an audio file (an `enclosure`, Atom `rel="enclosure"` or `media:content` that is `audio/*`, or an audio file name with no type) | `episode` | a podcast overview |
| anything else with a page | `article` | an article overview |

An image enclosure is never audio: Substack and Cloudflare attach a JPEG or PNG to every
post.

**A feed's label is its main kind** (`feedKindOf`): a YouTube channel's own feed
(`youtube.com/feeds/videos.xml?channel_id=…`) is a YouTube channel; a feed that is at least
half episodes is a Podcast; anything else is a Blog. A newsletter that mixes episodes and
posts still makes each entry as its own kind.

## Finding a site's feed

`feedLinksInPage` reads a page's head for `<link rel="alternate">` of type
`application/rss+xml` or `application/atom+xml`, against the page's address (or its
`<base>`), each once, and stops at `<body>`. It is what *Follow this site* under an article
uses, and what a YouTube channel's page offers for its own feed.

## What real feeds showed, 27 Nov 2026

22 public feeds, read from the owner's Mac: 7 Substack, Ghost, WordPress and Medium
newsletters and blogs, 9 other blogs and news sites, 4 podcasts and a YouTube channel.

- 6 of 22 are Atom, every YouTube channel feed among them.
- 15 send an `ETag` and 9 `Last-Modified`, and 4 send neither (YouTube sends
  `Cache-Control: max-age=900` instead). The 30-minute stored copy does the work and a
  conditional request is a bonus.
- Blogs are 25–830KB. Podcasts are 2–6MB with 355–1,022 items. A YouTube channel feed is about
  50KB with its latest 15 videos.
- Many blogs carry the whole post (`content:encoded`, Atom `<content>`).
- 5 of 6 home pages named their feed.
- One podcast carried Podcasting 2.0 transcript tags (777 of 1,022 items).
- YouTube channel feeds load from our server in London with no proxy (three fetches from
  production, 13–388ms), so a followed channel spends neither proxy money nor Data API quota.

`readFeedItems` read all 22: every format, every entry's kind, and the podcasts stopped at
50 entries, each in under 20ms.

## Legal

Agreed with the owner on 27 Nov 2026, for the slice that first saves followed feeds to an
account: the privacy page names the feeds a reader follows beside playlists; the stored copy
of a feed is never linked to an account and goes after 90 days unchecked; publishers see our
server, never the reader; feed addresses are never logged. The terms name the 50-feed limit.
Reading a feed and finding a site's feed store nothing about a reader.
