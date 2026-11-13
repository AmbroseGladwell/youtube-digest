# Podcast transcripts

Where a podcast episode's words come from. Trello OV-106's second slice, 13 Nov 2026. The owner
decided on 12 Nov 2026 that every free route is used up before speech to text, in this order: the
shared cache, the feed's transcript tag, then the same episode on YouTube, with speech to text last
and talked through before it is built. This slice builds the first two. No client calls the route
yet.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The rungs, and remembering where they found the words | `apps/api/src/podcasts/createPodcastTranscripts.ts` |
| Where an episode's words are, shared | `EpisodeWordSourcesRepository.ts`, table `podcast_transcript_sources` |
| A reader's other device, by the key | `GET /api/transcripts/:key`, `src/routes/transcriptRoutes.ts` |
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

## Each reader's own copy

Decided with the owner after the terms review, 13 Nov 2026 (OV-297). A show's transcript is its
own work: keeping the whole text on our server and serving it to other readers is copying and
communicating it, which no UK exception covers. So **the words are never kept for everyone**. Each
reader's words are fetched from their source for that reader, sent to their device and kept there.

What is shared is **where the words are**: the feed's transcript URL and type, or the YouTube video
the episode was matched to, under the episode's key. That's a fact about the episode, not the show's
expression, and it saves the next reader the search. A reader's other device, holding only the
episode's key, asks `GET /api/transcripts/:key`, which fetches the words afresh from that source. A
source that no longer answers is forgotten and the rungs run again.

Podcast words already in the shared cache were deleted by migration `V0032`, and
`/shared-transcripts/:key` has no podcast words to serve.

## The rungs

1. **Where the words were found before:** fetched afresh from there, the feed or YouTube not
   searched again.
2. **The feed's `<podcast:transcript>`:** the episode is read **again from its own feed** by its
   guid (or, for an item without one, its audio address, as `podcast-links.md`'s reader names it).
   Its transcript tags are tried in order of how well they are timed, and the first that reads
   cleanly answers.

Each answer is checked by the same `transcriptFault` an upload is and returned; where it was found
is remembered.
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
itself. Where an episode's words are is shared between accounts, so nothing a caller sends may
decide it. With only those two, the worst a caller can do is name a feed it controls, and that feed's
episodes have keys of their own. `PUT /transcripts/:key` refuses every key holding a colon
(`source-identity.md`): no account files a podcast transcript, and our server keeps none.

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
`transcriptFault` refuses a transcript out of order, and the whole format was being lost to a few
seconds of it. So the parser drops the cues that run backwards, and keeps the rest, unless they are
over 2% of the file, when it trusts none of it and the next format is tried.

### Checked against real episodes, 13 Nov 2026

Behind the Bastards (72 min) and Stuff You Should Know (44 min), from their Omny pages: VTT,
1,477 and 834 cues, reaching the last minute of each, in 0.5–0.7 seconds. The Daily offers no tag and reads as `no-captions` in 65 ms.

## Logs

`podcast transcript resolved`, at `info`, with the rung that answered (`remembered` with `from`,
`tag`, `youtube`), the format, the number of segments and the time, or the failure. Never the feed or
the episode.

## Terms

The terms review (13 Nov 2026) found keeping a host's transcript in a shared cache high risk, which
is why the words are now each reader's own (above, OV-297). `/privacy` says so.
