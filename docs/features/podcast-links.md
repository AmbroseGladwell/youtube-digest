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
isn't in the 200, so its title is read from the Apple page's `og:title` and matched in the feed by
title. Apple's lookup won't answer for an episode's id on its own, which was tried.

**Spotify.** No API key and no account: an episode's public page carries the tags every link
preview reads, `og:title`, the show in its description ("Listen to this episode from … on
Spotify."), `music:release_date` and `music:duration`. Apple's directory is searched for a show of
exactly that name, at most three are tried, and the episode is matched by title, date and length
among each one's newest 200, or in its feed when it is older. A short `spotify.link` is followed to
the episode it names first.

- **No show of that name in Apple's directory** is `no-public-feed`, with the show's name: most
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

## What the server will fetch

Every request, to Apple, to Spotify or to a feed, goes through `createPublicWebFetch`: public
addresses only, checked when connecting, redirects followed by hand and each checked again, no
cookies or credentials, 20 seconds. These are `pasted-article-links.md`'s rules, moved out of the
article fetcher so both use the same code rather than two copies. Feed hosts sit behind
measurement redirects (Podtrac, Chartable and others), which those rules already allow.

## The route

`POST /api/podcasts/read` takes `{ url }` and answers with a `PodcastRead`: the episode, or the
reason it couldn't be read, and the show's name where it is known. An account reads without
counting; signed out, onboarding's trial token reads it as one of its reads (`onboarding.md`,
"Any kind of link"). It is limited to 120
an hour per address, like article reads. The log line says which platform the link came from, how
it went, how many transcript tags the episode has and how long it took. It never logs the link.

## Terms, still to check

Before readers can use this, check: Apple's terms for its search and lookup API used this way;
reading Spotify's public episode pages (tags any link preview reads, but still Spotify's pages);
and writing a transcript of an episode and keeping it in the shared cache, which is a different use
from playing the episode and needs its own answer. `/privacy` names them since the screens' slice
that lets a reader paste a podcast link (`legal-pages.md`, 13 Nov 2026); the terms checks above are
the owner's, and still open until that slice merges (`podcast-screens.md`, "Before it merges").

## What comes next

The next slices of OV-106, decided 12 Nov 2026 (free routes first, speech to text last):

1. The transcript rungs: the shared cache and the feed's transcript tag are built
   (`podcast-transcripts.md`). The same episode on the show's YouTube channel, matched by title and
   length, with the YouTube description as the fallback when the upload was retitled, comes next.
   That was measured on the card: about 47% of recent chart episodes can be had for free.
2. The podcast note, a small fork of the video note.
3. The screens, after a design round, and podcasts joining onboarding's table.
4. Speech to text, whose options are talked through with the owner first.
