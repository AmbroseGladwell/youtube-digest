# A podcast episode on YouTube

Finding the same episode on the show's own YouTube channel, whose captions are free. Trello OV-106's
third slice, 13 Nov 2026. This slice is the matching. Running it in the extension, falling back to
our server, and remembering what was found are the next.

**Decided by the owner, 13 Nov 2026:** the matching runs **in the extension**, on the reader's own
connection, as the free YouTube captions already do (`transcript-retrieval.md`). Only when that
can't answer does our server do it, directly and then through the residential proxy within a daily
budget, as server-side captions do (`server-side-transcripts.md`). The matching is one function over
a `YouTubeFetch`, so the same code runs in both places.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Finding the episode | `findEpisodeOnYouTube` in `packages/transcripts/src/podcastOnYouTube/` |
| When an upload is the episode | `titleMatch`, `retitledCandidates`, `descriptionShare` in `matchUpload.ts` |
| What is read from YouTube's pages | `channelsIn`, `uploadsIn`, `ageInDays` in `youTubeListings.ts` |
| An episode's own words | `episodeKeywords`, `noteWords` in `noteWords.ts`; `PodcastEpisode.notesKeywords` |
| The notes of the episodes beside it | `neighbourNotes` from `readFeedEpisode` in `apps/api` |

## How it finds the episode

1. **The show's channels:** YouTube's search, filtered to channels, for the show's name. The first
   three are tried.
2. **By title, on each one's first page of uploads:** the episode's title nearly word for word
   (80% of its words) on an upload within 10% or 3 minutes of its length. A clip has the title and
   not the length, so it is never taken for the episode.
3. **Further down the show's channel,** the first of the three whose name carries the show's
   (60% of its words), five more pages of 30, by title the same way.
4. **By description, for an upload that was retitled:** shows often give the YouTube upload a
   different title ("241. Susie Wiles Out, Stephen Miller In…" goes up as "It's Official: Trump's
   Grift…"). Candidates are uploads within 3% or 90 seconds of the episode's length, listed around
   its date. Each one's player response, at most five, gives its full description and exact date.
   An upload is the episode when the description holds at least 40% of the episode's own words, its
   date is within three days, and it leads the next candidate by at least 0.1.

At most 14 requests to YouTube: one search, three first pages, five more pages, five player
responses. A failure YouTube answers with (429, a block, a shape we don't know) is the same named
`TranscriptFetchFailure` the caption rungs use, so the ladder above decides what to try next.

## An episode's own words

A show's notes carry the same sponsor reads, links and sign-offs on every episode, and those would
match any upload on its channel. So the feed reader keeps the notes of up to ten episodes beside the
wanted one: the ten before it, or, for one of the newest, those after it, which costs reading ten
more items. Any word in 30% or more of them is the show's, not the episode's. The rest, words of four
letters or more with links removed, are `PodcastEpisode.notesKeywords`. An episode with fewer than
eight such words isn't judged by description at all.

## How sure a match is

Every threshold above was measured on 12 Nov 2026 against a control: each show's episodes matched
against a different show's channel, where any match is a wrong one. Card comments have the method.

| Rule | Adds | Wrong matches in the control |
|---|---|---|
| Title and length | 34% of episodes | not measured separately; the length rules out clips |
| Length and date alone | — | 7.4%, so it is not used |
| Description, date and lead | +9% | 0 of 594 |

**Title always wins over description.** The Bulwark reuses a guest's notes across several of its
videos, and where the two disagreed the title match was the right one (6 of 214 cases). That is why
the description is only asked when no title matched.

## What is read from YouTube

The web client's own screens, not an API: `youtubei/v1/search` with the channel filter,
`youtubei/v1/browse` on a channel's Videos tab and its continuation pages, and
`youtubei/v1/player`. They are read loosely: an upload is a `lockupViewModel` (or an older
`videoRenderer`), its length is the thumbnail's clock badge, its age the "… ago" text, and anything
missing or moved reads as nothing found rather than as an error. Upload dates on a channel page are
only relative ("2 weeks ago"), so the exact date comes from the player response.

In the extension these requests go through the service worker like every other YouTube request, and
`youTubeOriginRule` already strips the `Origin` header for every youtube.com request the extension
makes, so search and browse need no change there.

## Re-measured with this code, 13 Nov 2026

`findEpisodeOnYouTube` itself, run over a direct `YouTubeFetch` on the same 189 chart shows, two
episodes each (the 2nd and 6th newest, 376 with a title):

- **Found: 43% of episodes.** 36% by title and 7% by description, which fits the 34% and 9% the
  scripts measured. No request failed.
- **Cost:** a median of 4 requests to YouTube (the most was 13), and a median of 0.9 seconds
  (90th percentile 1.9 seconds).
- **The control, on this code:** 150 episodes each searched under a different show's name (pairs
  sharing a word were skipped, so Pod Save America never stood in for Pod Save the World). **No
  match**, so no wrong one.
- **The description matches checked by hand.** All 27 were read against their YouTube titles. The
  three whose titles didn't make it obvious (an HRC episode and two of Still Counting) were checked
  against the descriptions themselves, and each carries the episode's notes word for word.

## Next

- **The extension rung:** the panel asks the extension to find the episode, then fetches that
  video's captions by the existing path. They are shared under the YouTube video's own key, so
  they are fetched once ever like any video's.
- **Our server's fallback:** the same function over the service's `YouTubeFetch`, direct then
  proxied, counted against its own daily budget.
- **Remembering a match**, so the next reader skips the search. What our server matched can be
  shared as it stands. What one reader's extension matched decides what other readers are given,
  so it needs the same care the shared cache takes (two accounts agreeing, or our server
  confirming), and is decided in that slice.
