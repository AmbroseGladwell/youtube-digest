# Pre-rendered speech with Kokoro

Design note. Status: prototype proven on one note, not integrated.

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

## Where the audio lives

This is the open problem. The artifact's own asset store would be the natural home, but **the `assets` capability is not available on this account**, so it cannot be used.

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

- About 0.6 seconds of CPU per second of audio, in each daily run. Six videos of 2.5 minutes each is roughly nine minutes of synthesis, which needs checking against the task's time limit.
- Storage that grows with the library, roughly 0.6 MB per note as AAC.
- A regeneration problem. If the note format or the script builder changes, existing audio is stale. Audio should be treated as derived and disposable, keyed by a hash of the spoken text, so a changed note re-renders and an unchanged one never does.

## Open questions

- Which voice. Four samples are in the test page; this needs an ear, not an argument.
- AAC or Opus. Opus is a third smaller, but Safari support is inconsistent and this is an iPhone-first use case. AAC is the safe default.
- Whether the daily task's time limit accommodates synthesis for a large queue, and whether audio should be generated in a separate follow-up run if not.
- Whether older notes get backfilled, at roughly 90 seconds of CPU each, or whether audio only exists for notes created from here on.

## Staging

1. **Done.** Prove synthesis, timing capture and timing-driven highlighting on one note, offline.
2. Pick a voice and a format.
3. Prove the database storage path: write one note's audio as parts, read and reassemble in the published page, play it.
4. Wire synthesis into the daily task, keeping Web Speech as the fallback for any note without audio, which is the same degradation pattern the page already uses when the database is unreachable.
5. Decide on backfill.
