# Podcast transcripts

Where a podcast episode's words come from. Trello OV-106's second slice, 13 Nov 2026. The owner
decided on 12 Nov 2026 that every free route is used up before speech to text, in this order: the
shared cache, the feed's transcript tag, then the same episode on YouTube, with speech to text last
and talked through before it is built. This slice builds the first two. No client calls the route
yet.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The rungs, and keeping what they find | `apps/api/src/podcasts/createPodcastTranscripts.ts` |
| Reading each transcript format | `parsePodcastTranscript.ts` |
| Reading the episode again from its feed | `fetchFeedEpisode.ts`, shared with `podcast-links.md`'s reader |
| An episode's key | `podcastSourceKey`: `podcast:` and `podcastSourceId`, the hash of feed and guid |
| No upload under another kind's key | `isYouTubeKey` in `src/routes/transcriptRoutes.ts` |
| The route | `POST /api/podcasts/transcript`, `src/routes/podcastRoutes.ts` |

## How much each rung can answer

Measured 12 Nov 2026 on 1,877 recent episodes of 189 Apple-chart shows. The method is in the card's
comments.

| Rung | Episodes | Built |
|---|---|---|
| The feed's transcript tag | 6% | here |
| The same episode on the show's YouTube channel, by title and length | 34% | `podcast-on-youtube.md` |
| The same, confirmed by the YouTube description when the upload was retitled | +9% | `podcast-on-youtube.md` |
| **Every free route** | **about 47%** | |
| Speech to text on the audio | the rest | after the owner's call |

## The rungs

1. **The shared cache:** a row read, under the episode's key. An episode is fetched once, ever,
   and every later reader of it costs nothing.
2. **The feed's `<podcast:transcript>`:** the episode is read **again from its own feed** by its
   guid (or, for an item without one, its audio address, as `podcast-links.md`'s reader names it).
   Its transcript tags are tried in order of how well they are timed, and the first that reads
   cleanly answers.

Each answer is checked by the same `transcriptFault` an upload is, kept in the shared cache as our
own fetch (`putServiceFetched`, confirmed at once, since no account touched it), and returned.
`generated` is true: a host's transcript is almost always machine-made, and the label says so rather
than presenting it as the show's own words.

**Failures are named as the YouTube ladder names them** (`transcript-retrieval.md`), so the client's
existing copy applies:

| Failure | When |
|---|---|
| `no-captions` | the episode offers no tag we can read; the next rung is worth asking |
| `video-unavailable` | the episode isn't in its show's feed any more |
| `source-unavailable` | the feed didn't answer |

### Why the caller sends only the feed and the guid

The route takes `{ feedUrl, guid }`, not the episode the reader route returned, and reads the feed
itself. The shared cache is shared between accounts, so nothing a caller sends may decide what is
kept under an episode's key. With only those two, the worst a caller can do is name a feed it
controls, and that feed's episodes have keys of their own. For the same reason `PUT
/transcripts/:key` refuses every key holding a colon (`source-identity.md`): no account can file a
podcast transcript, and what the cache holds for an episode came from our fetch of its feed.

## The formats

Built against one real file of each type from the sample's feeds (Captivate, Omny, Spreaker), in
order of preference:

| Type | Format | What it gives |
|---|---|---|
| `text/vtt` | WebVTT | cues with start and end. Omny's hours have one digit (`0:00:05.320`), and speakers come as `<v Speaker 1>`, which is dropped |
| `application/srt`, `application/x-subrip`, `text/srt` | SRT | cues with start and end. Speakers the host wrote into the text ("Speaker 2: …") are kept as written |
| `application/json` | Podcasting 2.0 JSON | often a time for every word. Words are joined into lines at a sentence's end, a change of speaker, a pause over 1.5 seconds, or 30 words |
| `text/html` | `<time>` and `<p>` pairs | a time where each paragraph starts |
| `text/plain` | Omny's text with timestamps | a time line before each paragraph |

A paragraph's time ends where it starts, because no end was given, as for any cue without a
duration (`transcript-retrieval.md`). **A transcript with no times at all reads as none.** It gives a
key point nothing to link to. Whether an untimed transcript is worth taking over speech to text is
for the slice that builds that rung.

Captivate's JSON, SRT and HTML for one episode each give the same 5,218 words.

### Times that run backwards

Omny's VTT for one episode runs 8 seconds backwards about 30 minutes in, where an ad was spliced in.
The shared cache refuses a transcript out of order, and the whole format was being lost to a few
seconds of it. So the parser drops the cues that run backwards, and keeps the rest, unless they are
over 2% of the file, when it trusts none of it and the next format is tried.

### Checked against real episodes, 13 Nov 2026

Behind the Bastards (72 min) and Stuff You Should Know (44 min), from their Omny pages: VTT,
1,477 and 834 cues, reaching the last minute of each, in 0.5–0.7 seconds, then 3–4 ms from the
cache. The Daily offers no tag and reads as `no-captions` in 65 ms.

## Logs

`podcast transcript resolved`, at `info`, with the rung that answered (`cache`, `tag`), the
format, the number of segments and the time, or the failure. Never the feed or the episode.

## Terms

Keeping a host's transcript in the shared cache is the use `podcast-links.md`, "Terms, still to
check", names. It is checked before any reader can reach this route, in the slice that adds podcasts
to `/privacy`.
