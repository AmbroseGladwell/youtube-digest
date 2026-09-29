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
5. **Decided** in `v1-architecture-decisions.md`: new notes proactively, old ones lazily on first play.
