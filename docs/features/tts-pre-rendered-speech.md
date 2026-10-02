# Pre-rendered speech with Kokoro

Design note. Status: prototype proven on one note, measured on Fly.io, not integrated.

## Why change anything

The library currently speaks notes with the browser's Web Speech API. That has four problems, and only the first is about voice quality.

1. **The voice depends on the device.** What you hear on an iPhone and on a Mac are different voices from different vendors, at different quality.
2. **It stops when an iOS screen locks.** That is precisely the listening situation the feature exists for.
3. **The read-along is a guess.** Position is estimated from elapsed time against a characters-per-second constant, so highlighting drifts and the skip buttons do arithmetic on an estimate rather than seeking.
4. **`onboundary` is unreliable.** Safari gives a character index but no length, and Chrome on Android never fires it at all, so word-level highlighting is already degraded on some devices.

## The constraint that determines the design

Kokoro cannot run in the page. The artifact runs under a content security policy that blocks `fetch`, XHR and WebSocket to every host except a small script CDN allowlist, and that block includes a library's own runtime downloads. `kokoro-js` would load and then fail when it tried to pull its weights. Embedding the weights is worse: the model is 325MB and the page is capped at 16MB.

So the model runs where the pipeline runs, not where playback happens. **Render ahead, ship audio.**

## Proven

Measured in the session container on one real note (`one-pocket-notebook-capture-filter-migrate`, 24 chunks):

| | |
|---|---|
| Audio produced | 145.2 s |
| Generation time | 88.2 s (1.65x faster than realtime, CPU only) |
| Size, AAC 32k mono | 616 KB |
| Size, Opus 24k mono | 420 KB |
| Size, MP3 48k mono | 851 KB |
| Chunk timings recorded | 24, matching the note's chunk count exactly |

Highlighting driven by those timings was verified: seeking to 61.5 s activates chunk 11, whose recorded start is 61.137 s.

### Operational findings

- **HuggingFace is blocked by the egress proxy** (403 at the tunnel). So is jsdelivr and the OpenAI API. PyPI, npm and GitHub release downloads are reachable.
- The model therefore comes from the `kokoro-onnx` GitHub release: `kokoro-v1.0.onnx` (325 MB) and `voices-v1.0.bin` (28 MB), Apache 2.0, 54 voices.
- `ffmpeg` and `espeak-ng` are already present in the container. `pip install kokoro-onnx` is the only new dependency.
- Generation consumes container CPU, **not model tokens**. This matters: unlike every other part of the pipeline, adding speech does not meaningfully increase the Claude usage cost of a run. An earlier estimate in conversation guessed 10 to 20% more per video; that guess was wrong, and the real answer is close to zero.

## Measured on Fly.io

The Cowork figure above is wall-clock time on a container whose core count was never recorded, so it said nothing about what a Fly machine would do. `services/tts/benchmark.py` measures it: it loads Kokoro once, speaks each record in `samples/records/` one spoken chunk at a time (the chunks the prototype already split at sentence boundaries, headings skipped), and reports wall time, CPU time, peak memory and the M4A size. `services/tts/benchmark.Dockerfile` bakes the model into the image with its SHA-256 checked, so the same thing runs anywhere.

Two notes, 347.9 s of audio, voice `af_heart`, region `lhr`, `kokoro-onnx` 0.6.1 on `onnxruntime` 1.30.0, measured 2026-09-29:

| Machine | Wall time | Realtime factor | A 3-minute note | Peak RSS | Model load |
|---|---|---|---|---|---|
| `shared-cpu-2x`, 2 GB | 2791 s | 0.12x | ~25 min | 857 MB | 21.1 s |
| `performance-1x`, 2 GB | 317.7 s | 1.1x | ~2m 45s | 850 MB | 6.6 s |
| `performance-2x`, 4 GB | 183.5 s | 1.9x | ~1m 35s | 857 MB | 4.7 s |
| `performance-4x`, 8 GB | 108.6 s | 3.2x | ~56 s | 857 MB | 4.8 s |
| Apple M1, 8 cores (all five notes) | 281.9 s for 1005 s | 3.6x | ~50 s | 747 MB | 1.5 s |

What it showed:

- **Synthesis costs about 1.05 CPU-seconds per second of audio**, on every machine. The Cowork run's "1.65x faster than realtime" was that work spread over several cores, not a cheap model.
- **Shared CPUs are unusable for this.** The shared machine started at 0.17x and fell to 0.10x as its burst balance ran out; a one-off job long enough to exhaust the balance is exactly what synthesis is.
- **Cores help with diminishing returns.** Two to four vCPUs cut wall time by 41%, not 50%, and total CPU time rose from 361 s to 419 s.
- **Memory is about 860 MB regardless of size**, so any performance preset has room.
- Encoding to AAC adds about 2 s per note; the files are 670 to 750 KB for a 3-minute note, as the Cowork run found.

At London's prices ($0.0489, $0.0977 and $0.1954 an hour for the three performance presets), rendering a note costs about $0.002 to $0.003 on any of them: doubling the price roughly halves the time. So the choice is `performance-4x`, the fastest first play for about $0.0005 more per note than `performance-2x`. Two costs outweigh synthesis and shape the service: a minute of idle before a machine stops costs about as much as rendering a note, so the worker stops itself when its queue is empty; and one machine is a queue, so the service is a pool of stopped machines, one job each, which cost only their image storage (about $0.09 a month each at the 578 MB image) until they run.

For comparison, hosted APIs charge $4 per million characters for the robotic standard voices and $15 to $80 for voices comparable to or better than Kokoro. Kokoro on `performance-4x` works out at about $1.08 per million, at the price of running the service ourselves. ElevenLabs and OpenAI sound better; Kokoro was judged good enough to ship first.

## The spoken script

What gets narrated is `spokenScript(overview)` in `@overview/domain`: one entry for every `NoteLine` the reader shows, in order, headings included. Each entry is the line's `spoken` text when it has one and its `text` otherwise, passed through `speakable`. Five decisions are packed into that:

- **One entry per line, so a timing is a line index.** The service renders line by line and records where each starts, and the player highlights line `i` from timing `i` with no mapping in between. No finer chunking is needed: `kokoro-onnx` already splits a long line into phoneme batches internally.
- **A line can say something different from what it shows.** Read aloud word for word, the note sounded like a document: bare labels, a verdict word before its reasoning, and lists with nothing to mark where one item ends. So a `NoteLine` carries an optional `spoken`, set where the two should differ, and the reader keeps rendering `text`. Nothing on screen changes. `overviewMarkdown` (copy, PDF, share) is a visible format and keeps the visible words.
- **Headings are spoken, in their own words.** They are the listener's only section cue, as they were in the prototype, which spoke each section name as its own highlighted chunk. They are said as a person would: "The premise", "The core claim", "The verdict", "How you could apply it", "What it's selling", "Should you watch it anyway?". "No clear claim" is said as shown.
- **Lists are counted and linked.** The key points heading says how many there are ("There are five key points"), counted in code. Each point then opens with a linking word: "First,", then a fixed sequence ("Then", "Also", "On top of that", "Next", "Beyond that"), then "And finally,". Repeating "Next," on every middle item was the first version, and it was tiring to hear on a list of seven. How to apply items are steps, so they take "First, … Then, … And finally,". A single item takes no linking word. The sequence is fixed rather than varied at random because the audio is cached by a hash of the words: the same note must always produce the same script. After a linking word the item's first letter is lowered, unless the first word is "I", an all-caps acronym, or has a capital inside it. Names are lowered too; casing has no effect on the voice.
- **It lives in the domain, beside the lines it reads.** `overviewNoteLines` and the three label maps it speaks (`NOVELTY_LABEL`, `SELLING_LABEL`, `WATCH_ANYWAY_LABEL`) moved out of `app-core` with it, so the extension, the web app and the API build the same words.

**An empty entry is a line shown but not spoken.** The verdict's label ("Established.") stays on screen but is not read: the reasoning says it better, and the label before it was the most document-like moment in the narration. The line still needs an entry, or every timing after it would point one line early, so its entry is empty. The service gives an empty line a start time where the line before ended, renders no audio for it, and adds no gap. `SpokenScript` and the service both refuse a script with nothing in it to say. The service had refused any blank line before this, so it has to be live before the app that sends these scripts. CI makes sure of that by deploying the TTS pool before the app (`docs/architecture/deploy.md`, "Deploy order").

**Watch it anyway is answered aloud.** The spoken line is the answer, then the reason: "Yes, it's worth watching.", "No, you can probably skip the video, the overview covers it.", or for a partial answer "Yes, it's worth watching one part, from 12 minutes 30 to 18 minutes 45." The range is said by `spokenDuration` from the stored milliseconds, never by the model. `WatchAnyway` holds one range, so "one part" is what the data supports.

**Numbers and symbols stay on screen and are converted for speech in code.** The prompt keeps `$600`, `20%` and `8×7` as written, because digits read better than words in a note and finance or maths notes depend on them. `speakable` then rewrites what espeak-ng, the phonemiser Kokoro uses, reads badly. Checked against espeak itself: it reads `$600` as "dollar six hundred", `8x7` as "eight ex seven", `1/4` as "one slash four", `mass^0.75` as "mass zero point seven five" (the power is lost), `$5k` as "dollar five kay" and `vs` as "vee ess". `speakable` makes those "600 dollars" ("a 600 dollar coat" after "a" or "an"), "8 times 7", "one quarter", "to the power of", "5 thousand dollars" and "versus". It also expands "e.g.", "i.e." and "etc.", says `401k` as "four oh one k", and drops a bracketed aside, which the prompt only allows for a year or a citation. Percentages, years, plain numbers, acronyms and words in capitals espeak already reads correctly, so they are left alone.

**The narration opens by naming the video.** `spokenScript` starts with `spokenOpening(video)`: "*Title*, from *Channel*, published in *Month Year*.", the month and year formatted in code from `publishedAt` in UTC, leaving out any part that is missing rather than guessing. No line on screen stands for it, so it is the one exception to one entry per line: the player sets the first timing aside as the opening, and the rest line up with the lines as before. While it plays, no line is highlighted and the bar says "Now playing" with the video's title. The masthead is deliberately not tinted. A render made before the opening existed has exactly one timing per line, and the player still accepts it, so shares made before this change keep their audio.

The client sends the script; the server keys the audio on a hash of the script's text and the voice, plus a render version of its own. No script-format version is needed: a builder change that alters the words alters the hash. That also means a change to the script's wording re-renders every note's narration the next time it is played, lazily and one note at a time, never as a batch. A render version is: changing pauses, the encoder or how timings are cut changes the audio without changing the text. `SpokenScript` caps a script at 20,000 characters, about five times the longest sample note.

## Voices

`voices-v1.0.bin` holds 54 voices, of which 28 speak English: 20 American (`af_*`, `am_*`) and 8 British (`bf_*`, `bm_*`). The rest are Spanish, French, Hindi, Italian, Japanese, Portuguese and Chinese voices, and would mispronounce an English note. `NarrationVoice` offers a shortlist of 15 of the English ones. Each carries its accent as data, and the accent picks the phonemiser's language: `en-us` or `en-gb`. The default is `af_heart`, and readers choose their own from a sample of each: `narration-voice.md`.

## The service

`services/tts` is the private half: a FastAPI app with one route that matters, `POST /render`.
It takes `{ lines, voice, language, renderVersion }`, speaks each line with Kokoro, joins them
with 0.4 s of silence, and returns the M4A (AAC, 32 kbps, `faststart` so playback can begin
before the whole file arrives) as base64 beside `lineStartsSeconds`, `durationSeconds` and
`synthesisSeconds`. `GET /health` names the render version and the voices.

- **It holds nothing.** No database, no storage credentials: the API owns the job queue, its
  priorities and R2, and hands this service one script at a time. That keeps the Python side
  small enough to test without any of them.
- **The render version is checked, not trusted.** The API keys audio on the script, the voice
  and the render version it believes in, and sends that version with the request; the
  service refuses a different one with `409 render_version_mismatch`. A deploy that changes how
  audio is made (the gap, the encoder, how timings are cut) bumps `RENDER_VERSION`, and a
  half-rolled-out pair fails loudly rather than storing new audio under an old key.
- **It stops itself** after `IDLE_EXIT_SECONDS` without a render, because on
  `performance-4x` a minute of idle costs about what rendering a note does. Deploying it as a
  pool is `docs/architecture/deploy.md`, "The TTS service"; testing it is
  `docs/conventions/tts-testing-guide.md`.

Measured locally, a three-line script in `bm_george` renders in 2.7 s to 6.4 s of audio.

## The API side

`apps/api/src/audio` and `routes/audioRoutes.ts`. The routes:

| | |
|---|---|
| `POST /api/audio` | `{ lines, voice?, priority? }`, checked with `SpokenScript` and `NarrationVoice`. Ready audio answers `200` with its timings at once; anything else is queued and answers `202` |
| `GET /api/audio/:key` | the status to poll: `queued`, `rendering`, `ready` with `lineStartsSeconds`, `durationSeconds` and `fileUrl`, or `failed` |
| `GET /api/audio/:key/file` | the M4A, with single byte ranges answered `206`, which Safari needs before it will play media |
| `POST /api/audio/lookup` | `{ keys }`, up to 32: every render that exists under them, in any state. How a note finds narration in a voice other than the chosen one (`narration-voice.md`, "Old audio") |
| `DELETE /api/audio/:key` | the render and its file, for the account that asked for it and no other; `204`, or `404` for anyone else |
| `GET /api/audio/samples` | public: the current voice samples that are ready, one per voice (`narration-voice.md`, "The samples") |

- **The key is the content.** `audioKey` is SHA-256 over the render version, the voice and the
  lines, computed by the server from what it was sent. Two accounts asking for the same words
  in the same voice share one render and one file.
- **The file is public; the status is not.** An `<audio>` element sends no bearer, so the
  extension could not play a file behind one, and nor could a lock screen resuming playback.
  The key is only computable by someone who already holds the words, so it serves as its own
  capability, and the file is immutable and cached for a year.
- **The queue is a table.** `audio_renders` holds each job's lines, voice, priority, attempts
  and a `not_before`. Workers claim the most urgent, oldest job with `for update skip locked`,
  up to `TTS_CONCURRENCY` at once, one per machine the pool can start. Someone pressing play
  is `interactive` and goes ahead of every `background` render, and asking for a waiting
  background render interactively promotes it.
- **Failures wait, then give up.** A failed attempt is retried after 30 s, then 2 minutes;
  the third failure marks the job `failed`, and asking for it again starts it from nothing. A
  job whose worker vanished (the API machine stopped mid-render) is taken up again after 15
  minutes.
- **Three waiting per account.** An account with three renders queued or running is refused a
  fourth with `429 too_many_requests`; asking again for one already waiting is never refused.
- **Every render is logged** with its voice, priority, attempt, time spent waiting, synthesis
  time and audio length, the numbers that say whether the pool is big enough.
- **Every request is logged** with its priority and what it found under its key: nothing,
  or a render in some state and at some priority. That is where "was a new note's audio
  ready by its first play" is read from (`audio-player.md`, "A note just made").

Storage is behind `AudioStore`: Cloudflare R2 through its S3 API, signed with `aws4fetch`,
one private bucket per environment (`the-overview-audio`, `the-overview-audio-dev`) with a
token scoped to that bucket alone. R2 is on exactly when `R2_BUCKET` is set, so keys imported
into Fly ahead of the bucket's name are held rather than refused at startup. A directory
(`AUDIO_DIR`) stands in for working offline; it never goes to production, where a machine's
disk does not outlive a restart. Production has narration on since 2026-09-30, through the pool in `docs/architecture/deploy.md`, "The TTS service".

## Where the audio lives

*Superseded: `docs/architecture/v1-architecture-decisions.md` puts audio on Cloudflare R2 behind the API. What follows is the prototype's workaround, kept as the record of why.*

This was the open problem. The artifact's own asset store would be the natural home, but **the `assets` capability is not available on this account**, so it cannot be used.

The remaining option is the artifact database, which is already wired up. Documents are capped at 256 KiB, so a note's audio has to be split:

```
audio/<noteId>/meta            duration, voice, marks[]
audio/<noteId>/parts/<n>       base64, roughly 180 KB each
```

A 2.5 minute note as AAC is about 4 parts. The page fetches parts only when you press play, assembles a Blob, and sets it as the audio source. The database allows 5000 documents per artifact, so at roughly 5 documents per note the ceiling is around 900 notes, well beyond the current 30.

Critically, the audio bytes never pass through the model's context: Python writes the part files, and the task's `write_db` call references them by `file_path`, exactly as note records already work.

## What it buys

- One consistent voice on every device, chosen once.
- Playback that survives a locked screen, plus lock screen and Bluetooth controls via the MediaSession API.
- Sentence highlighting that is exact rather than estimated, because the timings come from the audio itself.
- Skip buttons that genuinely seek.
- Word-level highlighting stays interpolated, since Kokoro does not return per-word timings, but interpolating inside a sentence whose true start and end are known is far better than today.

## What it costs

- About 1.05 seconds of CPU per second of audio (see "Measured on Fly.io"; the earlier 0.6 was wall-clock time on several cores).
- Storage that grows with the library, roughly 0.6 MB per note as AAC.
- A regeneration problem. If the note format or the script builder changes, existing audio is stale. Audio should be treated as derived and disposable, keyed by a hash of the spoken text, so a changed note re-renders and an unchanged one never does.

## Open questions

- Which voice. Settled by giving the choice to the reader: `af_heart` by default, with a sample of each English voice to pick from.
- AAC or Opus. Opus is a third smaller, but Safari support is inconsistent and this is an iPhone-first use case. AAC is the safe default.
- ~~Whether the daily task's time limit accommodates synthesis~~ — there is no daily task in the real build; synthesis is a queued job on its own machines.
- Whether older notes get backfilled, at roughly 90 seconds of CPU each, or whether audio only exists for notes created from here on.

## Staging

1. **Done.** Prove synthesis, timing capture and timing-driven highlighting on one note, offline.
2. **Done.** Format: AAC in M4A (`v1-architecture-decisions.md`). Voice: the reader's choice, default `af_heart`.
2a. **Done.** Measure it where it will run: `performance-4x` ("Measured on Fly.io").
3. ~~Prove the database storage path~~ — superseded by R2.
4. Build the service, storage and API, then the player, keeping the existing read-along pacer as the fallback for any note without audio.
5. **Done.** New notes proactively, old ones lazily on first play (`v1-architecture-decisions.md`). The client asks once a note is saved: `audio-player.md`, "A note just made".
