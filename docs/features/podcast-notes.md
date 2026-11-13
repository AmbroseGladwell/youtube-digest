# Podcast notes

What generation makes of a podcast episode. Trello OV-106's fifth slice, 13 Nov 2026. A reader can't
make one yet: the screens are the next slice.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The episode as a source | `PodcastSource` in `packages/domain/src/Source.ts`; `PodcastOverview` |
| The episode as the sections read it | `PodcastGenerationInput`, `episodeAsVideo` in `packages/generation/src/podcast/` |
| The prompt, in a podcast's words | `composePodcastPrompt.ts`, `inPodcastWords.ts` |
| Listen to it anyway | `listenAnywaySection.ts` |
| Making the note | `generatePodcastOverview.ts` |
| Videos unchanged | `videoPromptGolden.test.ts` |

## A small fork

The card expected "a small fork of the video template, wording only", and that is what it is.
Unlike articles (`article-notes.md`), an episode is timed speech with a transcript, as a video is,
so every section, limit, budget and check applies as it stands. The spoken rows of the shared note
budget apply too, since that budget is keyed on spoken against written rather than on the medium
(`overview-generation-decisions.md`, "One note budget"; decided on OV-87). So:

- **The sections are the video's own,** read through a video-shaped view of the episode
  (`episodeAsVideo`): the show as the channel, the episode's notes as the description, its audio
  or page as the address. Nothing in a section is copied.
- **Their wording is translated, not rewritten:** `inPodcastWords` turns "video" into "episode",
  "watch" into "listen to", "channel" into "show", "a video" into "an episode", "the description"
  into "the episode's notes", and the "talking head" in the In one line example into a
  conversation. A test renders every prompt a podcast note can be written from (both kinds, short
  and long, with and without the steps) and fails on any video word left, so a section that gains
  one later can't leak it.
- **The context** is `<episode>` with `<title>`, `<show>`, `<notes>` and the numbered
  `<transcript>`, escaped as a video's is, so an episode's own markup can't close it.
- **The fields asked for are exactly the video note's.** A test compares the two schemas, so a
  podcast note assembles through `assembleOverview` like a video's, with the episode as its
  source and its times from the transcript.

## Listen to it anyway

Watch it anyway is the one section **forked rather than translated**. Its yes is "the visual or the
sound IS the claim": a technique, a demonstration, something shown. An episode shows nothing, so
the translated text would ask the wrong question. Listen to it anyway keeps the same default (no),
the same bluntness ("a soft yes costs me an hour I will not get back"), the same partial range and
the same field (`watchAnyway`), with its own reasons for a yes: a story whose telling is the point,
a performance or music, an exchange whose tone carries what the words would lose, a voice worth
hearing for itself. Pleasant company or nicer-than-reading is not a yes.

## The kind check

The kind is checked as for a video, from the title, the show, the notes and the opening. A process
episode gets the steps it gives. **An episode the check calls a recipe gets the default note,** since
a recipe note is built from a page's structured recipe or a video's stated amounts (`recipe-notes.md`),
and an episode has neither.

## Videos unchanged

The definition of done says YouTube overviews are unchanged, so `videoPromptGolden.test.ts` pins a
fingerprint of the video prompts (default, process, recipe, and a long one): system prompt, context
and the provider's JSON schema. It was taken from `main` before podcasts touched anything and still
matches, so the video prompts are byte for byte as they were. The one shared change, the key-point
check's correction message, takes its noun as a parameter defaulting to "video", with the same text.
A deliberate change to the video prompt updates the fingerprints, in a PR that says so.

## Not joined to `Source` yet

Decided with the owner, 13 Nov 2026: `PodcastSource` joins the `Source` union **with the screens**,
after the design round and the `/privacy` and terms update, and not here. A kind in `Source` is one
readers can reach. Onboarding's table must have a real entry for every kind ("a kind joining Source
can't ship until it has an entry"), and the library, the reader and the share page must handle it.
Until then a podcast note is a `PodcastOverview`: an `Overview` with the episode as its source. On
joining, that becomes an `Overview` like any other, and the compiler names every place that assumed
a video or an article. A trial join on this branch named 29, chiefly code reading `source.url`.
Those want a `sourceUrl` helper. Where a moment in an episode goes is the next section.

## Times and the episode's audio

The design round (13 Nov 2026) put an episode player inside the note, and Claude Design asked whether
a transcript's times can be trusted against the audio a reader hears. **They can't.** The five
episodes above were each downloaded twice, once as a podcast app asks and once as Chrome does, and
measured with ffprobe against the span their transcript covers:

| Episode | Transcript covers | Served, app | Served, browser |
|---|---|---|---|
| Diary of a CEO | 6938 s | +94 s | +124 s |
| Behind the Bastards | 5106 s | +132 s | +62 s |
| Stuff You Should Know | 2797 s | +56 s | +66 s |
| My Favorite Murder | 3748 s | +13 s | +13 s |
| Page 94 | 2729 s | +80 s | +49 s |

The audio served runs one to two minutes longer than the audio the transcript was timed against.
In four of the five, two downloads a moment apart differ by 10 to 70 seconds, so ads are stitched in
per request. So a moment can be off by anything up to two minutes, and differently on each play.
Ads sit differently in each show (the owner, 13 Nov 2026), so no single correction fixes it. Lining
the times up on our server can't work either, since the copy lined up isn't the copy the reader
streams.

**Decided with the owner, 13 Nov 2026:**

- **The episode plays inside the note,** from its audio file. Playing it from our page needs no
  permission from the host, but the content security policy must allow media from any host, on the
  web and in the panel. Check that on a few real feeds before building.
- **Every time jumps the episode's audio,** wherever the transcript came from. A reader who shared
  a Spotify or Apple link is listening to a podcast, and where the words came from is ours to know,
  not theirs (the owner, 13 Nov 2026). So a podcast note has one player and no YouTube player or
  link, and its way out is the link the reader shared: Spotify, Apple, or the show's page.
- **So times can land away from the moment, and that is accepted.** In all five episodes above the
  served audio was longer than the transcript, which fits ads added before a moment, so a jump would
  land at or before it. That wasn't checked against the words.

A transcript from YouTube (about 43% of episodes) is timed to the video, which drifts the same way.
Twelve matched episodes, one per show and 30 minutes or more, were downloaded once as a podcast app
asks and compared with the matched video's length:

| Served audio against the video | Episodes |
|---|---|
| Within 12 s | 5 (Ramsey, This American Life, The World and Everything In It, No Such Thing As A Fish, Bongino) |
| 26 s to 3 min longer | 6 (Page 94, Joe Rogan, The Square Ball, Sword and Scale, Planet Money, Football Weekly) |
| 7 min longer | 1 (Adam Carolla) |

So a YouTube transcript is often exact against the audio, usually within three minutes, and
occasionally further out, where the podcast carries more ads or a different cut than the video.
Lengths only: where in the episode the difference sits wasn't checked.

## Measured on five long episodes, 13 Nov 2026

Asked for by the owner. Five chart episodes of 45 to 116 minutes, each the newest episode of 45
minutes or more in its feed with a transcript tag. Each was read and transcribed by the real feed
reader and rungs, then sent through the harness's `runGeneration` with this prompt. The episodes:
Diary of a CEO (an interview, 116 min), Behind the Bastards (a comic history, 85), Stuff You Should
Know (an explainer, 47), My Favorite Murder (two stories, 63) and Page 94 (a panel, 45), each written
by Sol and by Sonnet 5.5. The run is `.local/runs/ov-106-podcasts`.

- **Every note assembled on its first attempt.** No video word was left in any note.
- **Key points reach the end.** In all ten notes the last key point ends between 86% and 99% of
  the way through. The lowest is Sonnet on the interview (99 of 116 minutes), whose last 15 minutes
  are the guest's family. Chapters run to the close in every note.
- **Listen to it anyway defaulted to no**, nine notes out of ten, including the comic history and
  the storytelling show, where the banter was judged personality rather than substance. The one
  partial was Sol on the interview: the guest's account of his father's decline, a reason the
  section allows ("a voice worth hearing for itself"). Sonnet said no to the same episode.
- **Sol is the stricter fact-checker.** On the explainer it flagged three errors: 2.5 million
  heartbeats in a lifetime where the hosts' own figures give about 2.6 billion, driving yourself to
  hospital during a heart attack, and the ion line below. Sonnet flagged none. Sonnet also placed one
  of that note's key points out of time order.
- **The kind check called the interview a process episode** (both models), and its steps are the
  guest's prevention advice. The other four were default notes.
- **Two of Sol's 44 key points came back unplaced** (the flat -1 range, shown without a time), as
  a video's can. All 38 of Sonnet's were placed.
- **Cost moves with length,** about $0.07 for a 45-minute episode to $0.14 for 116 minutes on Sol,
  kind check included. Sonnet was 5% to 14% dearer, episode for episode.
- **Machine transcripts make dubious claims of their own.** Sol flagged "strip them into charged
  ions, which they shoot at the heart", which may be the transcript mishearing rather than the host
  misspeaking. Auto captions on a video carry the same risk.

Maintenance Phase had a transcript tag that wasn't read. Buzzsprout serves it as HTML paragraphs with
speakers and no times, and a transcript with no times reads as none (`podcast-transcripts.md`). Such
a transcript is hand-made and exact, but has nothing for a key point to link to. Whether to use one
instead of speech to text, with times estimated or none shown, is a question for that slice.

Chapters from the feed's `<podcast:chapters>` aren't used: none of the 189 chart feeds carried them
(`podcast-links.md`). Chapters come from the transcript, as for a video without creator chapters.
