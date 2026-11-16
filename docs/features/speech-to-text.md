# Speech-to-text for podcast episodes

Design note for OV-305. Status: provider chosen by measurement; the server rung is not built.

## The gap

`createPodcastTranscripts.ts` looks for an episode's words on three rungs: where they were found
before, the feed's `podcast:transcript` tag, and the show's YouTube channel
(`podcast-transcripts.md`). An episode with none of those has no overview at all. Speech-to-text
is the last rung: transcribe the episode's own audio.

What the owner settled on 15 Nov 2026, before anything was measured:

- **Our server pays**, not the reader's own key. Speech-to-text is not one of the BYO providers.
- **A model we host**, not a hosted speech-to-text API, provided the measurements back it.
- **Serverless GPUs are in the comparison**, beside CPU machines like the ones Kokoro runs on.
- **Plan limits wait for the costs**, which this note now has.

The rules the rung has to keep, from the card: limited by plan and metered; never run in the
background; the transcript is the account's own copy, never shared; the audio is not kept once
transcribed; `/privacy` names the new third party.

## How it is measured

`services/stt/` holds the harness. No model is asked to judge anything: the score is computed.

| File | What it does |
|---|---|
| `benchmark_episodes.json` | Four real episodes whose feeds carry the host's own transcript |
| `speech_engines.py` | The two engines behind one `load_engine("family:model:precision")` |
| `benchmark.py` | Finds an episode in its feed, caches the audio and transcript in `.local/stt-benchmark/`, scores, and runs the engines on the local CPU |
| `gpu_worker.py` | One job on a GPU: download the audio, decode, transcribe, time every stage |
| `modal_benchmark.py` | The worker on Modal, with a fallback list of GPU types |
| `runpod_handler.py`, `gpu.Dockerfile`, `runpod_benchmark.py` | The same worker on RunPod serverless; Actions builds the image (`stt-benchmark-image.yml`) |

The score is **missed or wrong**: substituted plus deleted words over the reference's words, from
`jiwer` on normalised text. Inserted words are reported but not scored, because podcast ads are
stitched into the audio per download and the host's transcript never contains them. Every run
saves each model's segments to `.local/stt-benchmark/output/`, so a new reference can be scored
without paying for another run.

The episodes: The Diary of a CEO (a neurologist, 116 min), Odd Lots (a law firm's collapse, 60 min),
Darknet Diaries ("Conti", 62 min) and Revisionist History (a live show, 62 min).

## The models

- **NVIDIA Parakeet TDT 0.6B v2** through `onnx-asr` 0.12.0, Silero for speech detection, speech
  cut at 30 s. English only.
- **Whisper large-v3-turbo** through `faster-whisper` 1.2.1, batched on a GPU. Multilingual.

Missed or wrong, against each host's transcript:

| | DOAC | Odd Lots | Darknet | Revisionist | All four |
|---|---|---|---|---|---|
| Parakeet int8, Apple M1 CPU | 3.38% | 2.73% | 5.15% | 3.40% | 3.62% |
| Parakeet fp32, Modal A10 | 3.54% | 2.55% | 5.20% | 4.12% | 3.80% |
| Whisper Turbo fp16, Modal T4 | 1.40% | 1.39% | 5.27% | 1.08% | 2.13% |
| Whisper Turbo fp16, RunPod RTX 4000 Ada | 1.32% | 1.48% | 5.20% | 1.05% | |

Darknet Diaries is high for both models alike, which points at its transcript, not the audio.

### The reference was favouring Whisper

Hosts often make their transcripts with a Whisper-based tool, which would hand Whisper its lead.
So one more episode was scored against two references: the Diary of a CEO's Robert Pape episode
(93 min), whose feed has the host's transcript, and whose video has YouTube's auto-generated
captions, which come from Google's recogniser.

| Missed or wrong | Whisper Turbo | Parakeet |
|---|---|---|
| Against the host's transcript | 1.8% | 2.8% |
| Against YouTube's captions | 4.4% | 4.5% |
| Words only one model got right, and the host's transcript agrees with | 274 | 140 |
| Words only one model got right, and YouTube agrees with | 227 | 218 |

The host's transcript sits closer to Whisper (1.8%) than to YouTube's captions (3.4%), and against
the independent reference the two models tie. YouTube's captions keep every stutter that both
models tidy away, so part of that 4.5% is the reference's.

**Quality does not separate the models.** Speed, cost and languages do: Whisper Turbo was faster on
the same card (124x realtime against 87x on an A10), cheaper, and handles episodes that are not
in English.

## Where it runs

On CPU, Parakeet int8 runs at 7.6x realtime on an M1: about 8 minutes for an hour of audio, at
1.8 GB peak memory. Fly's GPUs were withdrawn on 1 Aug 2026, so a GPU means another host. Two
serverless hosts were measured, both billing by the second and costing nothing while idle:

| | Modal | RunPod |
|---|---|---|
| Card used | T4 ($0.59/h; L4 $0.80, A10 $1.10) | RTX 4000 Ada, 16 GB pool ($0.58/h; 24 GB pool $0.75) |
| Whisper Turbo speed | ~75x realtime | ~100x realtime |
| An hour-long episode, request to result | 58–70 s | 59–63 s |
| Cost per hour of audio, from the host's billing | $0.010 | $0.0097 |
| Cold start with a card free | 3–6 s, of which the model load is 2–4 s | not yet measured; see below |

For scale, Groq lists Whisper Turbo at $0.04 an hour of audio and Cloudflare Workers AI at $0.03.
At $0.01 an hour, a two-hour episode costs us about 2 cents, and Modal's $30 monthly credit covers
about 3,000 hours of audio.

### Cold starts and running out of cards

Neither host fails when it has no card: it waits.

- **Modal** once waited more than 30 minutes for an L4 with nothing started. A fallback list of
  GPU types on `@app.cls(gpu=[…])` fixed it; `with_options` takes only one type.
- **RunPod's** first job waited 211 s, because it arrived seconds after the endpoint was created,
  before any machine had pulled the image. RunPod pulls images ahead of time onto stopped workers
  and does not bill the pull; the billing for that run confirms it (392 GPU-seconds billed for 363 s
  of transcribing). The worker was also seen throttled, waiting for a card, on 16 Nov.
- **RunPod scales an endpoint with no requests down**: two workers at most after 3 days, none after
  7. A fallback that goes unused for a week would fail on the day it is needed.

What a RunPod cold start costs in time after hours idle is being measured on 16 Nov 2026 (two
probes, 3 hours apart); this section gets the result.

## The choice

**Whisper large-v3-turbo, on Modal, with a list of card types.** RunPod is the fallback if its cold
start after hours idle is under about 20 s; otherwise more Modal card types do that job.

How long a reader waits for a card:

1. The worker tells the API it has started, before it loads anything. That separates "no card yet"
   from "transcribing", which Modal cannot show from outside.
2. **No start after 15 s** (about three times Modal's measured cold start): send the same job to the
   fallback as well, without cancelling. Whichever starts first does it; the other is cancelled
   before it does any work.
3. **Neither started after 2 minutes**: the attempt fails visibly, and it does not count against the
   reader's plan.
4. A health-check job once a day, a few seconds of audio on each host, keeps the fallback from being
   scaled to zero and records its cold start, for about $0.002 a day.

The reader sees which of these is happening: "Transcribing the episode, about a minute", and
"Waiting for a transcriber…" if the start is slow.

**Later: split long episodes.** Transcribing 15-minute pieces on four GPUs at once would bring an hour
down to roughly 15–20 s for about the same cost, since billing is per second and each extra worker
adds only its model load.

## Still to build

- The server rung: a job table claimed with `for update skip locked` and retried, as
  `audio_renders` is; the transcript saved as the account's own copy; the audio deleted after
  transcription.
- A slimmer production image carrying only Whisper Turbo, built from `main`, with its own keys in the
  production secrets project.
- `/privacy` naming Modal (and RunPod, if it stays), through the trigger list in `legal-pages.md`.
- Plan limits, now that the cost is known.
- A Design round for the "needs transcribing", waiting and limit-reached states.
- Analytics: transcription requested, started, finished and failed, with seconds of audio and host.

## Running the harness

Locally, from `services/stt/` (`uv sync --group benchmark` first):

```sh
.venv/bin/python benchmark.py onnx-asr:nemo-parakeet-tdt-0.6b-v2:int8
```

On Modal and RunPod, with the keys from `overview-dev` through `scripts/secrets.sh run`:

```sh
.venv/bin/modal run modal_benchmark.py --engine faster-whisper:large-v3-turbo:float16
.venv/bin/python runpod_benchmark.py setup ghcr.io/<owner>/overview-stt-benchmark:<sha>
.venv/bin/python runpod_benchmark.py run <endpoint> --engine faster-whisper:large-v3-turbo:float16
.venv/bin/python runpod_benchmark.py delete <endpoint>
```

`--episodes-file` takes another episode list, as the Pape comparison did. Measured 15–16 Nov 2026 on
CUDA 12.6.3 and `onnxruntime-gpu` 1.32.0.
