# TTS testing guide

`services/tts` is the one Python service, so it gets its own guide rather than a section in
`backend-testing-guide.md`. The shape carries over: a test reads as a sentence about
behaviour, drives the service through its HTTP surface where a client would, and never
asserts on internals.

## Two kinds of test

| Kind | Marker | Runs against | For |
|---|---|---|---|
| **Fast** | none | a `FakeSynthesiser` | the render arithmetic, the HTTP contract, the idle exit, the M4A encoding |
| **Model** | `model` | Kokoro v1.0, loaded once per module | that real narration lines up with the timings, and that the model has the voices the domain offers |

The split is the model, not the layer. Anything that does not need Kokoro's voice to be
true runs against the fake, which returns a fixed tone per character at 1 kHz so the
expected starts are arithmetic a reader can check by eye. The model tests exist for the
claims only real audio can support: that each line's start is where the decoded M4A goes
from silence to speech, that the file lasts as long as the timings say, and that every
voice in `NarrationVoice` is in `voices-v1.0.bin`.

The model tests skip, with a reason, when `services/tts/models` is empty, so a fresh
checkout runs the fast suite without a 353 MB download. CI never skips them: the
`unit (tts)` job restores the model from a cache keyed on `download_model.sh`, which
pins both files' SHA-256, and downloads it only when the key changes.

## Running

```
task tts:model                     # once: Kokoro into services/tts/models, hash-checked
task test:tts                      # everything, about 30 s with the model
task test:tts -- -m "not model"    # the fast suite, under a second
task run:tts                       # the service on :8000 (IDLE_EXIT_SECONDS=600 by default)
```

The runner is `pytest` under `uv run --frozen`, so the lock file is the only source of
versions. The dev shell provides Python 3.12, `uv`, `ffmpeg` and `espeak-ng`. It also points
Kokoro's phonemiser at the shell's `espeak-ng`, because the copy `espeakng-loader` bundles
cannot find its data on macOS; on Linux, in CI and in the image, the bundled copy works and
nothing is set.

## Rules

- **No sleeping.** The idle exit takes its scheduler as an argument, and the tests hand it a
  `FakeSchedule` whose timers they fire by hand.
- **Errors are asserted by code**, `response.json()["error"]["code"]`, never by message
  text, as in the API.
- **One behaviour per test, named as a sentence.** The name is the documentation.
- **Shared test code lives beside the tests**, in `tests/fake_synthesiser.py`, and
  `src/overview_tts` never imports from `tests`.

## What is deliberately not covered

- **The cross-language constants.** `MAX_SCRIPT_CHARACTERS` and the language codes are
  repeated from `@overview/domain`'s `SpokenScript` and `NarrationVoice`. The API validates
  with the domain's before it calls this service, so a drift shows up as the service refusing
  what the API accepted, loudly. The voice list is the exception, and is checked, because a
  voice missing from the model would fail only for the readers who chose it.
- **Fly's proxy.** One render per machine, the autostart and the stop are Fly configuration
  (`services/tts/fly.toml`); what this suite proves is that the process exits when idle,
  which is the half Fly cannot do for it.
- **Voice quality.** A person listens; no test does.
