# Podcast links

Turning a podcast link into one episode, as its show's own feed describes it. Trello OV-106's
first slice, 12 Nov 2026. Nothing here is visible to a reader yet: no client calls the route, and
no transcript is fetched. The transcript rungs, the note and the screens are the next slices.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Which kind of link this is, from its shape | `parsePodcastLink` in `packages/domain` |
| What an episode is, and how a read can fail | `PodcastEpisode`, `PodcastRead`, `podcastSourceId` in `packages/domain` |
| From a link to the episode | `apps/api/src/podcasts/createPodcastReader.ts` |
| Apple's directory | `appleDirectory.ts` |
| What a Spotify episode page says | `spotifyEpisodeFacts.ts`, `pageMeta.ts` |
| Reading a feed as it arrives | `readFeedEpisode.ts` |
| When two descriptions are one episode | `sameEpisode.ts` |
| The fetch every one of these goes through | `apps/api/src/publicWeb/createPublicWebFetch.ts`, shared with pasted article links |
| The route | `POST /api/podcasts/read`, `src/routes/podcastRoutes.ts` |

## Why the feed

The open path to an episode's words is the show's RSS feed: its `<podcast:transcript>` tag, and its
audio for speech to text as the last resort. Apple and Spotify publish no transcripts through any
API. So every link, whatever platform it came from, ends at the same item in the same feed, and
the episode's identity is that feed's: the feed address and the item's `guid`
(`podcastSourceId`, a hash of both, as an article's id is a hash of its address). The canonical
link is the episode's own, never the Apple or Spotify page it was shared from.

## From a link to an episode

**Apple.** The link carries the show's id and the episode's (`?i=`). Apple's free lookup, asked
for the show with `entity=podcastEpisode`, returns the feed address and the newest 200 episodes
with their guids. The episode's id is found among them, and its guid in the feed. An older episode
isn't in the 200 and reads as `not-listed`: Apple's page isn't read for its title since the terms
review (OV-297; "Terms" below). Apple's lookup won't answer for an episode's id on its own, which
was tried.

**Spotify.** No API key and no account: an episode's public page carries the tags every link
preview reads, `og:title`, the show in its description ("Listen to this episode from … on
Spotify."), `music:release_date` and `music:duration`. Podcast Index, then Apple's directory, is
searched for a show of exactly that name ("The directories" below), at most three are tried, and
the episode is matched by title, date and length among each one's newest 200, or in its feed when
it is older. A short `spotify.link` is followed to the episode it names first.

- **No show of that name in either directory** is `no-public-feed`, with the show's name: most
  likely a Spotify exclusive, and the reader is told so plainly.
- **A public show whose feed lacks the episode** is `not-found`, with the show's name. Some shows
  keep bonus episodes on Spotify alone. It is never matched to a different episode instead.

**A show's own episode page.** Most hosts' pages point to their feed with
`<link rel="alternate" type="application/rss+xml">` (Acast, Audioboom, Podbean, Buzzsprout), and the
episode is the item linking back to the page, or the one with the page's title. A page naming no
feed (Omny keeps it in page data) is searched in Apple's directory by its title, and taken only
where an episode has exactly that title **and** the page names that episode's show too. A page
built by script with nothing in its markup (Simplecast) reads as `not-an-episode`.

**A show's link, a feed, or any other page** is `not-an-episode`: a reader pasted a whole show, or
something that isn't a podcast.

### Checked against real links, 12 Nov 2026

The Daily from Apple and from Spotify (the same guid from both), and episode pages on Acast,
Audioboom, Podbean and Omny, each read the right episode in 0.3–1.9 seconds. A feed address and a
Spotify show read as `not-an-episode`, and a Simplecast page as well, for the reason above.

## Matching an episode

`sameEpisode` is strict on purpose, because a confident wrong match is worse than none: the
reader would get an overview of an episode they didn't ask for.

- **The same title**, once case, quotes and punctuation are set aside. A near title is a
  different title: "(Part 2)" is another episode.
- **Nothing known that disagrees.** The dates within two days, the lengths within a minute or 2%.
  Either side not knowing is not disagreement. The date is what tells a rerun from its original,
  since shows rerun episodes under the old title.
- **Of several matches, the closest in date.**

## Reading a feed

Feeds are large: in a sample of 189 chart shows, the median feed was 1.9MB and a quarter were over
4MB, and some run to tens of megabytes. They list the newest first, so `readFeedEpisode` parses as
the bytes arrive and stops at the wanted item, and the rest is never downloaded. It reads at most
50MB. htmlparser2 in XML mode parses it, because real feeds carry HTML entities and other things a
strict XML parser refuses.

From the item it keeps: title, guid, date, length, the audio file (`enclosure`), its page, its
artwork (else the show's), its notes as plain text (at most 20,000 characters), every
`<podcast:transcript>` with its type and language, and `<podcast:chapters>`. In the same sample
no feed carried chapters and 6% carried transcripts, but Omny's shows carry both SRT and VTT.

## The directories

Since OV-294 (14 Nov 2026), a Spotify link's show is looked up in **Podcast Index** first, and in
**Apple's directory** where Podcast Index fails, is busy or doesn't know it. Podcast Index is the
open directory built for podcast apps, free with a key, and it has the same two things Apple's
lookup gives: a show's feed by its name, and its newest episodes with their guids, dates and
lengths (`podcastIndexDirectory.ts`). It is asked only where it can do Apple's job:

- **An Apple link** still goes to Apple alone, since its episode id is Apple's own and only Apple's
  directory maps it to the feed's episode.
- **A show's own page that names no feed** is still searched in Apple's directory, by the episode's
  title. Podcast Index's term search finds shows, not episodes.

Without `PODCAST_INDEX_API_KEY` and `PODCAST_INDEX_API_SECRET`, Apple's directory is asked alone, and
startup says which directories are on.

**Their limits.** Each directory sees our server's address, not each reader's, so every call this
process makes to one shares a budget (`callBudget.ts`). Apple's is 15 a minute, under its "approximately
20", waiting up to 15 seconds past it, with lookups kept an hour and searches a day. Podcast Index
publishes no number, so its budget is a polite 20 a minute, and a call that would wait more than two
seconds goes to Apple instead. Its terms allow keeping an answer only as long as its cache header says,
so nothing of its is kept.

## What the server will fetch

Every request, to Apple, to Spotify or to a feed, goes through `createPublicWebFetch`: public
addresses only, checked when connecting, redirects followed by hand and each checked again, no
cookies or credentials, 20 seconds. These are `pasted-article-links.md`'s rules, moved out of the
article fetcher so both use the same code rather than two copies. Feed hosts sit behind
measurement redirects (Podtrac, Chartable and others), which those rules already allow. Podcast
Index is the exception: one fixed address of ours, not a reader's link, signed with our key, so it
is asked directly, within 10 seconds and 5 MB.

## The route

`POST /api/podcasts/read` takes `{ url }` and answers with a `PodcastRead`: the episode, or the
reason it couldn't be read, and the show's name where it is known. An account reads without
counting; signed out, onboarding's trial token reads it as one of its reads (`onboarding.md`,
"Any kind of link"). It is limited to 120
an hour per address, like article reads. The log line says which platform the link came from, how
it went, how many transcript tags the episode has and how long it took. It never logs the link.

## Terms

Checked by the terms review, 13 Nov 2026 (the owner's doc "Podcast support: terms and privacy
review"), and acted on in OV-297:

- **Apple's Search API** says little about use like ours. It is "limited to approximately 20 calls
  per minute" and asks large users to cache. Apple sees our server's address, not each reader's, so
  every Apple call shares one budget ("Their limits" above).
- **Apple's web pages** fall under its website terms' bar on scraping, so they aren't read. An Apple
  link to an episode older than the newest 200 its directory lists can't be matched, and says so
  (`not-listed`), pointing to the Spotify link or the show's own page.
- **Spotify's public episode page** is read once per pasted link, with an honest User-Agent, for
  four meta tags, and not kept. Its user guidelines bar scraping on a literal reading; the risk is
  low, and the official route doesn't fit (below).

### Official routes, checked 14 Nov 2026 (OV-294)

- **Podcast Index API: fits, and is used** ("The directories"). Its terms (v1.1, March 2021) were
  read from its own repository, since its site refuses automated fetches. They name no bar on
  commercial use. They ask that answers not be kept "longer than permitted by the cache header",
  that credentials not be "embedded in open source projects" (ours are references in the secret
  manager, `docs/conventions/secrets.md`), and that we "display all attribution(s) required … as
  described in the documentation". No attribution requirement was found in the API's docs; the
  owner checks its site when registering the key.
- **Spotify Web API: doesn't fit.** Client credentials could read an episode's title, show, date and
  length, but the Developer Policy (15 May 2025) says "commercial uses are not permitted" beyond
  selling access to an app that streams nothing, the Developer Terms' licence is for "private
  personal use", and both bar putting Spotify content into "a machine learning or AI model". An app
  in development mode is meant for up to five allowlisted users, and since 15 May 2025 extended
  quota goes only to organisations with a launched service and about 250,000 monthly users. So the
  page's four meta
  tags stay, the same tags any link preview reads. Its oEmbed endpoint gives only the episode's
  title, not its show, date or length, so it can't stand in either.
- **YouTube Data API: fits, and is used** for finding the episode on its show's channel
  (`podcast-on-youtube.md`, "Our server's search").
- **Links back** read "Listen on Spotify" and "Listen on Apple Podcasts", as both companies'
  guidelines ask, and the terms carry their trademark lines.
- **Transcripts** are each reader's own (`podcast-transcripts.md`, "Each reader's own copy").

## What comes next

The next slices of OV-106, decided 12 Nov 2026 (free routes first, speech to text last):

1. The transcript rungs: the shared cache and the feed's transcript tag are built
   (`podcast-transcripts.md`). The same episode on the show's YouTube channel, matched by title and
   length, with the YouTube description as the fallback when the upload was retitled, comes next.
   That was measured on the card: about 47% of recent chart episodes can be had for free.
2. The podcast note, a small fork of the video note.
3. The screens, after a design round, and podcasts joining onboarding's table.
4. Speech to text, whose options are talked through with the owner first.
