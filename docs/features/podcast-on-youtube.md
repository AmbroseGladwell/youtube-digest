# A podcast episode on YouTube

Finding the same episode on the show's own YouTube channel, whose captions are free. Trello OV-106's
third and fourth slices, 13 Nov 2026: the matching, then the rung that uses it, from the reader's
extension to our server's check. Since OV-297, what is kept for everyone is which video is the
episode, never its captions (`podcast-transcripts.md`, "Each reader's own copy").

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
| Checking a video someone else found | `confirmEpisodeOnYouTube` in `packages/transcripts` |
| The reader's part of the rung | `podcastTranscript` in `packages/app-core/src/features/podcasts/api/` |
| Our server's part | the YouTube step in `apps/api/src/podcasts/createPodcastTranscripts.ts` |
| Any YouTube request through our address, then the proxy | `throughService`, `ServiceTranscripts.onYouTube` |

## How it finds the episode

1. **The show's channels:** YouTube's search, filtered to channels, for the show's name. The first
   three are tried.
2. **By title, on each one's first page of uploads:** the episode's title nearly word for word
   (80% of its words) on an upload within 10% or 3 minutes of its length. A clip has the title and
   not the length, so it is never taken for the episode. Titles whose numbers disagree are two
   episodes: "Part 2" is not "Part 1", though every other word matches. A number on one side only
   is fine, since shows drop the episode number on YouTube.
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
- **Run again once titles with disagreeing numbers were ruled out:** still 43% (134 by title, 28 by
  description). It corrected two title matches the first run had wrong: "It Could Happen Here
  Weekly 256" had taken Weekly 251's video, and "NFL Week 9 Preview" Week 10's. The other changes
  between runs were YouTube's listings moving on. One title match looks wrong by its YouTube title
  and isn't: YouTube tries more than one title on some videos, and the listing showed the episode's
  own title while the player showed another.
- **The description matches checked by hand.** All 27 were read against their YouTube titles. The
  three whose titles didn't make it obvious (an HRC episode and two of Still Counting) were checked
  against the descriptions themselves, and each carries the episode's notes word for word.

## The rung, from the reader to our server's check

Decided with the owner, 13 Nov 2026, and changed by the terms review the same day (OV-297): what is
kept is **which video is the episode**, under the episode's own key, so once one reader's episode is
matched, nobody searches for it again; each reader's captions are fetched for them. What one
reader's extension found decides where every later reader's words come from, so our server checks
it before anything is kept.

### The reader's part

`podcastTranscript` asks our server first (`POST /api/podcasts/transcript` with the feed and the
guid): where the words were found before, then the feed's own transcript (`podcast-transcripts.md`). Only when that
answers `no-captions`:

1. **With the extension,** it runs `findEpisodeOnYouTube` over the extension's `YouTubeFetch`, on
   the reader's own connection, which costs us nothing. A video found is sent to our server
   (`youTubeVideoId`) to be checked.
2. **The extension looked and the episode isn't there:** `no-captions`. Our server isn't asked to
   look again, since it would search the same way and find the same nothing.
3. **YouTube turned the extension away, or there is no extension:** our server is asked to search
   itself (`searchYouTube: true`).
4. **Our server couldn't confirm the video:** the reader's extension fetches that video's
   captions and the reader uses them, `keptForEveryone: false`. Nothing is kept for anyone else.
   The extension's search had a runner-up to beat, so its pick is usually right; it just isn't
   right enough to give other people.

### Checking a match

`confirmEpisodeOnYouTube` decides from **one** player response, against the episode as our server
read it from the feed itself, never as the caller describes it: the title and length rule above,
or the description holding 40% of the episode's own words, its exact date within three days, and a
length within 3% or 90 seconds. There is no runner-up to lead, so the search's lead is the one rule
taken on trust from whoever searched.

Checked against real videos, 13 Nov 2026:

| Case | Confirmed |
|---|---|
| The video the search found (15 by title, 15 by description) | 30 of 30 |
| Another show's episode's video | 0 of 30 |
| The same show's other episode's video (62 pairs) | 0 of 62, once titles with disagreeing numbers were ruled out. Before that, "Closing Up for the Season, Part 2" took Part 1's video |

### Our server's part

After the feed's own transcript, the ladder takes what the caller asked for: a video to check, a
search, or nothing (then `no-captions`). Either way, every request goes the way server-side
captions do: our own address first, then the residential proxy within the day's budget, with its
bytes recorded against the account (`throughService`, `ServiceTranscripts.onYouTube`). The video's
captions come from `ServiceTranscripts.resolve`, so they are the YouTube shared cache's when it has
them, and fetched once under the video's own key otherwise, counted against the caller's daily
cap like any server-side caption fetch. The video is remembered under the episode's key; its captions
are not kept there.

A video that doesn't pass is answered `422` with `failure: "no-captions"` and `match:
"unconfirmed"`. The daily cap is a `429`, and a spent proxy budget a `422` with `budget-exhausted`, as
`/service-transcripts` answers them. With server-side YouTube fetching switched off, the YouTube
step answers `no-captions`.

The log line says `via: "youtube"`, `matchedBy` (title or description) and `searchedBy`
(extension or server), or the failure, whether the video was unconfirmed and what was asked.

## Next

- **The note:** a podcast note, a small fork of the video note, generated from whichever rung
  answered.
- **The screens,** after a design round, which call `podcastTranscript` with the extension's
  `YouTubeFetch` in the panel and `null` on the web.
- **The YouTube terms position** in `server-side-transcripts.md` covers fetching a video's captions
  on a reader's behalf. Searching YouTube and reading a channel's pages from our server is new, and
  is checked with the privacy policy before a reader can reach it.
