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
Those want a `sourceUrl` helper, and a moment in an episode links to its audio by a media fragment
(`audio.mp3#t=135`).

## Not measured yet

No real note has been generated: that is a paid run, and the owner is asked before one. The obvious
first one is a few long episodes through the model-comparison harness, to read Listen to it anyway's
answers and to see that key points reach the end of an hour-long conversation.

Chapters from the feed's `<podcast:chapters>` aren't used: none of the 189 chart feeds carried them
(`podcast-links.md`). Chapters come from the transcript, as for a video without creator chapters.
