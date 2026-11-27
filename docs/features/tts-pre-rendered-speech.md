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

## Against GPU models (OV-340)

Kokoro stays. Measured 23 Nov 2026: two GPU models with better-reviewed voices, Ming-3.0-tts 0.5B (MIT) and
Qwen3-TTS CustomVoice (Apache 2.0), both render **slower than realtime** on a Modal L4. That makes them 25 to
50 times Kokoro's cost per note, and moves a 3-minute note's first play from under a minute to 4 to 7 minutes.
The owner judged that no voice could be good enough to justify that.

Every engine rendered the five `samples/records/` and a pronunciation probe. Each line went through
production's own `render_script` and `encode_m4a`, after `speakable` from `@overview/domain`. Kokoro ran on an M1;
its Fly figures are in "Measured on Fly.io" above.

| Engine, voice | Card | Realtime factor | Render cost per note |
|---|---|---|---|
| Kokoro `af_heart` | Fly `performance-4x` | 3.2x | about $0.002–0.003 |
| Ming-3.0-tts `US_Emma` | L4, $0.80/h | 0.70x | $0.068 |
| Ming-3.0-tts `UK_George` | L4 | 0.72x | $0.073 |
| Ming-3.0-tts `UK_Charlotte` | L4 | 0.47x | $0.109 |
| Qwen3-TTS 1.7B `Ryan` | L4 | 0.41x | $0.133 |
| Qwen3-TTS 0.6B `Aiden` | L4 | 0.45x | $0.119 |

- **The GPU is not the limit.** In both models' runs, CPU time equalled wall time: one Python thread was busy
  the whole time, handing the GPU a step at a time. Both generate audio step by step: Qwen runs once for each 12 Hz
  audio token, and Ming decodes each roughly 24-character piece of text separately, with guidance. So the 0.6B Qwen
  is no faster than the 1.7B. Batching a note's lines (Qwen takes a list), vLLM-Omni serving, or splitting a note
  across containers might change the numbers. None of them was tried, because they are only worth the work
  if a voice clearly wins by ear.
- **Few English voices.** Ming has three built-in English voices and Qwen two, against the fifteen
  `NarrationVoice` offers. Anything more means voice design from a text description, or cloning.
- **Memory:** about 2.9 GB of GPU memory for Ming and 4.2 GB for Qwen 1.7B; model load was 6–14 s once the image was on the card.

The owner listened blind afterwards, 23 Nov 2026: 30 pairs, each GPU voice against the closest Kokoro voice on
the five notes and the probe.

| Pair | GPU voice | Kokoro | No real difference |
|---|---|---|---|
| Ming `UK_Charlotte` vs `bf_emma` | 6 | 0 | 0 |
| Ming `UK_George` vs `bm_george` | 3 | 1 | 2 |
| Ming `US_Emma` vs `af_heart` | 1 | 5 | 0 |
| Qwen 1.7B `Ryan` vs `am_michael` | 0 | 5 | 1 |
| Qwen 0.6B `Aiden` vs `am_michael` | 0 | 3 | 3 |

Qwen never won. The owner found Ryan "way too emotive for the content", heard laughter mid-sentence on the probe,
and said Aiden sounded like Chinese English. Ming's British voices beat Kokoro's, Charlotte on every pair, although
both Georges sounded "tinny". Heart, the default, beat Ming's American voice 5 to 1. So one Ming voice is clearly
better, and it is also the slowest (0.47x, $0.11 a note). That isn't enough to move the fifteen voices.

Run it again from `services/tts/` (`uv sync --group benchmark`). Kokoro needs the dev shell and `models/`.
The GPU engines need the Modal token from `overview-dev` through `scripts/secrets.sh run`:

```sh
.venv/bin/python modal_benchmark.py --voice af_heart
.venv/bin/modal run modal_benchmark.py --engine ming --voice UK_George [--only probe]
python3 blind_listen.py --name <listen> --pair kokoro/af_heart:ming/US_Emma [--pair …] [--report]
```

Renders, results and picks go to `.local/tts-benchmark/`. Start Modal runs one at a time: starting six at once got a
429 from the secrets fetch. Keep the Mac awake, too, because Modal stops an app whose client stops sending heartbeats.

## On Modal (OV-423)

`services/tts/modal_app.py` runs the same service (`create_app`, `/render/stream`, `/health`) on a Modal GPU:

- **GPUs, in order:** T4, then an A10, then an L4, so a slow L4 never holds a reader up.
- **Containers:** one render per container (`@modal.concurrent(max_inputs=1)`), staying up 20 s after its last request.
- **Kokoro on the GPU:** `KokoroSynthesiser(providers=["CUDAExecutionProvider", …])`. A container where Kokoro didn't land on the GPU refuses to start rather than render slowly.
- **Token:** every request needs `Authorization: Bearer <TTS_TOKEN>`, the Modal secret named after the app.
- **Apps:** `overview-tts` for dev and `overview-tts-prod` for production, each deployed by `task deploy:tts:modal [ENV=prod]`. That puts the Bitwarden project's `TTS_TOKEN` into the secret, deploys, and checks that a call without the token gets 401.

Measured through its HTTPS endpoint from London, 26 Nov 2026 (dev app):

| | First line | Whole response |
|---|---|---|
| A sentence (4.9 s of audio), warm | 1.29 s | 1.38 s |
| A sentence, cold | 6.56 s | 6.65 s |
| A full note (274.5 s of audio), streamed | 1.05 s | 26.7 s (10x playback) |
| 5 three-sentence chunks at once, warm | 0.7 s, 1.9 s, 3.1 s, 4.1 s, 5.3 s | |

- **The endpoint adds about 0.7 s** to a warm sentence over calling the function directly (0.55 s). That's the trip from London to Modal's US region and its web routing.
- **A whole note streams through without a cut.**
- **Five readers at once queued on one warm container** instead of starting four more. Modal's autoscaler waits before adding containers, and the service renders one request at a time. Rendering several at once on one GPU, or keeping a spare container while busy (`buffer_containers`), is for when concurrency is real.

## The spoken script

What gets narrated is `spokenScript(overview)` in `@overview/domain`: one entry for every `NoteLine` the reader shows, in order, headings included. Each entry is the line's `spoken` text when it has one and its `text` otherwise, passed through `speakable`. Five decisions are packed into that:

- **One entry per line, so a timing is a line index.** The service renders line by line and records where each starts, and the player highlights line `i` from timing `i` with no mapping in between. No finer chunking is needed: `kokoro-onnx` already splits a long line into phoneme batches internally.
- **A line can say something different from what it shows.** Read aloud word for word, the note sounded like a document: bare labels, a verdict word before its reasoning, and lists with nothing to mark where one item ends. So a `NoteLine` carries an optional `spoken`, set where the two should differ, and the reader keeps rendering `text`. Nothing on screen changes. `overviewMarkdown` (copy, PDF, share) is a visible format and keeps the visible words.
- **Headings are spoken, in their own words.** They are the listener's only section cue, as they were in the prototype, which spoke each section name as its own highlighted chunk. They are said as a person would: "The premise", "The core claim", "The verdict", "How you could apply it", "What it's selling", "Should you watch it anyway?". "No clear claim" is said as shown.
- **Lists are counted and linked.** The key points heading says how many there are ("There are five key points"), counted in code. Each point then opens with a linking word: "First,", then a fixed sequence ("Then", "Also", "On top of that", "Next", "Beyond that"), then "And finally,". Repeating "Next," on every middle item was the first version, and it was tiring to hear on a list of seven. How to apply items are steps, so they take "First, … Then, … And finally,". A single item takes no linking word. The sequence is fixed rather than varied at random because the audio is cached by a hash of the words: the same note must always produce the same script. After a linking word the item's first letter is lowered, unless the first word is "I", an all-caps acronym, or has a capital inside it. Names are lowered too; casing has no effect on the voice.
- **It lives in the domain, beside the lines it reads.** `overviewNoteLines` and the three label maps it speaks (`NOVELTY_LABEL`, `SELLING_LABEL`, `WATCH_ANYWAY_LABEL`) moved out of `app-core` with it, so the extension, the web app and the API build the same words.

**An empty entry is a line shown but not spoken.** The verdict's label ("Widely covered") was the first such line: it stays on screen but is not read, because the reasoning says it better, and the label before it was the most document-like moment in the narration. Since OV-94 it is a chip beside the Verdict heading rather than a line of its own, so it needs no entry at all. A line that is shown but not spoken still needs an entry, or every timing after it would point one line early, so its entry is empty. The service gives an empty line a start time where the line before ended, renders no audio for it, and adds no gap. `SpokenScript` and the service both refuse a script with nothing in it to say. The service had refused any blank line before this, so it has to be live before the app that sends these scripts. CI makes sure of that by deploying the TTS pool before the app (`docs/architecture/deploy.md`, "Deploy order").

**Watch it anyway is answered aloud.** The spoken line is the answer, then the reason: "Yes, it's worth watching.", "No, you can probably skip the video, the overview covers it.", or for a partial answer "Yes, it's worth watching one part, from 12 minutes 30 to 18 minutes 45." The range is said by `spokenDuration` from the stored milliseconds, never by the model. `WatchAnyway` holds one range, so "one part" is what the data supports.

**Numbers and symbols stay on screen and are converted for speech in code.** The prompt keeps `$600`, `20%` and `8×7` as written, because digits read better than words in a note and finance or maths notes depend on them. `speakable` then rewrites what espeak-ng, the phonemiser Kokoro uses, reads badly. Checked against espeak itself: it reads `$600` as "dollar six hundred", `8x7` as "eight ex seven", `1/4` as "one slash four", `mass^0.75` as "mass zero point seven five" (the power is lost), `$5k` as "dollar five kay" and `vs` as "vee ess". `speakable` makes those "600 dollars" ("a 600 dollar coat" after "a" or "an"), "8 times 7", "one quarter", "to the power of", "5 thousand dollars" and "versus". It also expands "e.g.", "i.e." and "etc.", says `401k` as "four oh one k", and drops a bracketed aside, which the prompt only allows for a year or a citation. Percentages, years, plain numbers, acronyms and words in capitals espeak already reads correctly, so they are left alone. A decimal point is said as a word, with the digits after it one by one: `0.75` is "0 point 7 5", `2.5%` "2 point 5 percent" and `v2.5.1` "v2 point 5 point 1" (OV-417). kokoro-onnx phonemises with `preserve_punctuation=True`, so phonemizer splits the text at every punctuation mark, a decimal point included: `Use 1.5 litres.` was spoken as "use one." and the rest of the line was lost. An amount with exactly two decimal places and no magnitude is money and minor units: `£4.99` is "4 pounds 99", `£4.00` "4 pounds" and `£0.99` "99 pence". A full stop after a number with no digit following, as in "in 2026.", is untouched.

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

## Streaming

Built for OV-42, so a first play can start before the whole note is rendered. `POST
/render/stream` takes the same request as `/render` and answers NDJSON, one event a line, as
each line is spoken: `{ type: "line", index, startSeconds, segments }`, then `{ type: "done",
… }` carrying everything `/render` returns plus the segments after the last line. A failure
partway is `{ type: "error", error }`, since the status has already been sent. A wrong version
or an unknown voice is still refused with a status before anything streams.

- **One encoder for the whole note.** Lines are fed to a single ffmpeg AAC encoder as they are
  spoken, and its output is read back as raw ADTS frames, 1,024 samples each. The note is never
  encoded line by line, which would put the encoder's start-up delay in front of every line and
  drift the timings.
- **A segment is about a second of frames, and a line starts a new one.** Each line's segments
  end halfway through the 0.4 s gap after it. The encoder has already let go of those frames,
  because the gap is written with the line rather than before the next. So a line can be played
  as soon as it is spoken, and no segment ever waits for the next line (the ~3.5 s stalls the
  device test heard from a segmenter that held each line's tail).
- **The encoder is told not to analyse its input** (`-probesize 32 -analyzeduration 0 -fflags
  nobuffer`). ffmpeg 6, which Ubuntu's CI and older images ship, otherwise reads about five
  seconds of input before encoding any, so no line went out until the stream closed. Newer
  ffmpeg doesn't, which is why it passed on a Mac and failed on CI.
- **Segments are HLS packed audio:** an ID3 tag carrying the segment's start on the timeline in
  90 kHz units, then the frames as they are. The encoder's 1,024 samples of priming put every
  line 43 ms later on the segments' timeline than in `lineStartsSeconds`, a constant too small to
  see in the highlight.
- **The stored file is unchanged.** When the stream ends, the whole note is encoded by
  `encode_m4a` exactly as `/render` does it, so the M4A, its timings and the render version are
  what they were.
- `test_kokoro_model.py` checks against real speech that each streamed line goes from silence to
  speech where its start says.

The API (`httpNarrator`) reads the stream as it arrives. For each line the worker stores the
segments in R2 (`<key>/segments/<n>.aac`) and records the line starts and every segment's length
on the render (`segment_seconds`), but only from the attempt that claimed it. A retry starts the
lists again.

## The API side

`apps/api/src/audio` and `routes/audioRoutes.ts`. The routes:

| | |
|---|---|
| `POST /api/audio` | `{ lines, voice?, priority? }`, checked with `SpokenScript` and `NarrationVoice`. Ready audio answers `200` with its timings at once; anything else is queued and answers `202` |
| `GET /api/audio/:key` | the status to poll: `queued`, `rendering`, `ready` with `lineStartsSeconds`, `durationSeconds` and `fileUrl`, or `failed`. A render streaming its first lines is `rendering` with the `lineStartsSeconds` so far, `renderedSeconds` and `playlistUrl` |
| `GET /api/audio/:key/file` | the M4A, with single byte ranges answered `206`, which Safari needs before it will play media |
| `GET /api/audio/:key/playlist.m3u8` | public: while the render streams, an HLS event playlist of the segments so far, starting at zero; closed with `#EXT-X-ENDLIST` once ready. `404` once its segments are swept |
| `GET /api/audio/:key/segments/:n.aac` | public: one segment, with byte ranges |
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
  up to `TTS_CONCURRENCY - TTS_LIVE_SLOTS` at once (4), one per machine the pool can start;
  the other slot reads chat answers aloud (`chat-read-aloud.md`). Someone pressing play
  is `interactive` and goes ahead of every `background` render, and asking for a waiting
  background render interactively promotes it.
- **Failures wait, then give up.** A failed attempt is retried after 30 s, then 2 minutes;
  the third failure marks the job `failed`, and asking for it again starts it from nothing. A
  job whose worker vanished (the API machine stopped mid-render) is taken up again after 15
  minutes.
- **Segments are kept an hour after the render finishes,** long enough for any first play that
  began on them to reach the end, then swept whenever a worker finds the queue empty
  (`SEGMENTS_KEPT_MS`). Deleting a render, or the account that asked for it, deletes its
  segments with the file, listed by prefix in R2.
- **Three waiting per account.** An account with three renders queued or running is refused a
  fourth with `429 too_many_requests`; asking again for one already waiting is never refused.
- **Every render is logged** as `audio rendered`, with its voice, priority, attempt, line
  count, time spent waiting, synthesis time, audio length, size in bytes and time from
  request to ready: the numbers that say whether the pool is big enough. A failed attempt
  is `audio render failed` at `warn` while it will be tried again, and `audio render gave
  up` at `error` once it won't. Its message is redacted.
- **Every request is logged** with its priority and what it found under its key: nothing,
  or a render in some state and at some priority. That is where "was a new note's audio
  ready by its first play" is read from (`audio-player.md`, "A note just made"). A request
  that put a render on the queue is also logged as `audio queued`.

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
