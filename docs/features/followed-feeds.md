# Following feeds

Card: OV-219. Decided with the owner on 27 Nov 2026.

A reader follows a podcast, a blog or newsletter, or a YouTube channel, by pasting its link,
as with a YouTube playlist (`playlists.md`, "Pasting a link"). New items arrive in the queue as
`kept` captures (`kept-links.md`), waiting for the reader in *Waiting for you*
(`capture-queue.md`, "Waiting on a pace"). Nothing is fetched, transcribed or written until
the reader chooses one, and then it's made like any other link of its kind and counts once.

**Built so far:** reading a feed (slice 1); the stored copy, the limits and the two routes
(slice 2); the synced follow record and a capture's feed (slice 3, server and sync). The
check that fills the queue, and the screens, follow in later slices of the same card.

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

## The stored copy

`feeds` (V0052) holds one row per feed address: its label, title, site and image, its newest
50 entries, the `ETag` and `Last-Modified` it last sent, when it was last fetched and last
checked, and how it has been failing. **It has no column for an account, a session or a
reader, and must never have one**: a test holds that. Who follows a feed is the follower's
own synced record, in a later slice.

`createFeedReader` answers for a feed address (`apps/api/src/feeds/`):

| The row | Answer (`freshness`) | Fetches |
|---|---|---|
| fetched under 30 minutes ago | `stored` | nothing |
| gone | `gone` | nothing, ever again |
| failing, before its next try | `failing`, the last good copy | nothing |
| none, or older, and within our limits | `read` | the feed, asking only for what changed |
| older, and over our limits | `stored`, the last good copy | nothing |
| none, and over our limits | failed, `busy` | nothing |

Every answer marks the row checked. A fetch that comes back `304` keeps the entries and moves
the fetched time on. A fetch with entries puts the new ones on top of the stored ones,
newest first, held to 50, and labels the feed again from them (`feedKindOf`).

**Failing.** Each failure waits twice as long as the last before the next try, from 30
minutes up to a day, or longer if the publisher's `Retry-After` asks for it (up to a day). A
`410 Gone`, or seven days of failing, marks the feed gone, and it is never fetched again.
The answer carries the last good copy, so a follower still sees what was there.

**Forgetting.** At most once an hour, a read deletes the rows no follower has checked for 90
days, logged as `api.feeds.forgotten` with the count.

## Load and spend

Feeds are read only when a follower asks, never on a schedule, so a feed none of its
followers opens costs nothing. Beyond the 30-minute stored copy, `FEED_LIMITS` holds:

- **One fetch per feed at a time.** Followers asking for the same feed while it is being
  fetched share that one fetch.
- **At most 16 fetches at once, and 4 to one host**, waiting up to 10 seconds for a slot.
  YouTube is one host, so a reader following 20 channels has them read four at a time.
- **At most 3,000 fetches an hour** on each machine. Past it, the stored copy answers.
- **At most 20MB of a feed and 2MB of a page** are read.
- Our own User-Agent, `FEED_USER_AGENT`, says it is a feed reader and where it's from.

The limits are in memory on each machine, like the rate limits (`api.md`, "Rate limits"),
so two machines during a deploy can briefly fetch twice as much.

## The routes

Both are signed in only, and never log the link, the feed or an entry (`api.feeds.read`,
`api.feeds.lookedUp`).

- `POST /api/feeds/lookup` `{ url }`: a pasted link to preview. A YouTube channel's
  `/channel/UC…` link reads its own feed straight away. Any other link is read as a feed, and
  if it isn't one, as a page whose feed link is read instead (`noFeedOnPage` if it names
  none). Answers a `FeedRead`. 60 an hour per account.
- `POST /api/feeds/check` `{ feedUrls }`: up to 50 followed feeds, each answered once, in the
  order asked, four at a time. 30 an hour per account.

Not yet looked up from a link: an Apple or Spotify show link (OV-106's directories find its
feed, in the slice that recognises links on paste), and a YouTube `@handle` link, which is
read as a page; whether YouTube serves that page to our server is still to check.

## Following

A followed feed is a synced record of its own kind, `followedFeed` (`FollowedFeed`,
followed-feed schema 1, `CLIENT_VERSION` 33, V0053, IndexedDB version 11), so every
signed-in device follows the same feeds. It holds the feed's address, its label (`kind`),
title, site and image as last read, when it was followed, its pace, its order and
`unavailable` (`gone`) once a check finds the feed gone for good.

- **Its id is the SHA-256 of the feed's address** (`feedIdOf`, hex). Two devices following
  one feed write one record, and the second is told to replace it rather than follow twice,
  as a playlist's natural id does. A hash rather than the address itself, because a route's
  parameter is capped at 100 characters and feed addresses run longer. The server refuses an
  id that isn't the hash of the record's `feedUrl`.
- **The pace** is a playlist's (`PlaylistPace`), defaulting to *Only when I choose*
  (`DEFAULT_FEED_PACE`). **The order** is *Newest first* (`DEFAULT_FEED_ORDER`) or *Oldest
  first*: a feed has no order of its own to keep, and since a source keeps its newest
  entries, newest first is the default.
- `POST /api/followed-feeds` writes it whole, create-only without `If-Match` and replace with
  it; `DELETE /api/followed-feeds/:id` tombstones it. A client before version 33 is never
  sent one (`sync-api.md`, "A kind a client was built before").
- **50 feeds** (`MOST_FEEDS_FOLLOWED`). Following one more is refused with
  `409 feed_limit_reached` and the limit, counted under the account's lock so two follows at
  once can't both pass (`countsLive` on the write). A feed already followed can still change,
  and unfollowing frees a place. The app stops at the limit first, so the refusal is a
  device that didn't: its push is `superseded` and its follow forgotten
  (`api.feeds.followLimitReached`).
- What a device has seen of a feed is its own, never synced (`FollowedFeedCheck`, the
  `feedChecks` store), as a playlist's is.
- **Another device unfollowing** takes this device's check, and the feed's entries still
  waiting, with it when the tombstone is pulled (`IndexedDbSyncStorage.applyChanges`).
  Entries being made, or needing attention, stay.

## Entries

An entry waiting for the reader is a `kept` capture (`kept-links.md`) with `keptFrom: "feed"`,
`waitingFor: "turn"` and `fromFeed`, the feed's id, label and title (`FeedOrigin`, capture
schema 2). Like `fromPlaylist`, it is on the capture so it outlives unfollowing. A client
before version 33 holds a capture written at schema 2 as one it can't read yet, until it
updates (`record-migrations.md`).

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
