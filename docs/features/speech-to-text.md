# Speech-to-text for podcast episodes

A TikTok with no captions is transcribed by the same rung since OV-130 slice 5: see
`docs/features/tiktok-links.md`, "Transcribing a TikTok with no captions".

Design note for OV-305. Status: provider chosen by measurement; the server rung and the screens built behind `STT_URL`.

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
| Cold start with a card free | 3–6 s, of which the model load is 2–4 s | 3 s model load; the card is the wait, below |
| Waiting for a card after 3 hours idle | | 118 s and 55 s |

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

**RunPod after hours idle**, measured on 16 Nov 2026: an endpoint with its image staged was left
idle for 3 hours, sent an hour of Odd Lots, left 3 hours more, and sent it again.

| | Probe 1 | Probe 2 |
|---|---|---|
| Waiting for a card | 118 s | 55 s |
| Request to result | 186 s | 119 s |
| Model load, once on a card | 2.5 s | 3.1 s |
| Missed or wrong | 1.5% | 1.4% |

Both times the staged worker's card was `THROTTLED` (its machine busy) just before the job
arrived, so RunPod started a worker on another machine. The model loads in seconds; the wait is
for a card, the same failure a fallback is meant to cover.

## The choice

**Whisper large-v3-turbo, on Modal, with a list of card types.** RunPod was to be the fallback if its
cold start after hours idle was under about 20 s. It waited 55 s and 118 s, so there is no second
host: the list of card types is the fallback, and it gets longer if Modal is seen waiting.

How long a reader waits for a card:

1. The worker tells the API it has started, before it loads anything. That separates "no card yet"
   from "transcribing", which Modal cannot show from outside.
2. **No start after 2 minutes**: the attempt fails visibly, and it does not count against the
   reader's plan.

The reader sees which of these is happening: "Transcribing the episode, about a minute", and
"Waiting for a transcriber…" if the start is slow.

**Later: split long episodes.** Transcribing 15-minute pieces on four GPUs at once would bring an hour
down to roughly 15–20 s for about the same cost, since billing is per second and each extra worker
adds only its model load.

## The server rung

A reader is offered transcription only where it can happen: on a server with `STT_URL` set, to an
account or to onboarding's trial. Nothing is transcribed unless the reader asks.

**Known before Create** (design 305c). `POST /api/podcasts/transcript/check`, asked as a pasted
episode is read, says whether the words can be found and fetches none: a remembered source or a
feed's tag by their presence, a video by the Data API's word (the extension's find, or our server's
search, whose match is remembered so Create doesn't search again). The answer is `found`, `unknown`
when a rung couldn't be asked (the feed, or the Data API refusing), or `none` with what transcribing
would mean: `needed` or `not-enough` with the month's usage, `free` when transcribed in the last day
or on its way, `too-long` or `no-audio`. Without `STT_URL` it answers `unknown` at once, reading no
feed and spending no YouTube search, since there is nothing to offer. `unknown` and a check that
turns out wrong (a broken tag link, unreadable captions) fall back to the ask after Create (305c-2):
`POST /api/podcasts/transcript`'s `transcript_unavailable` carries `transcribable: true`.

| Piece | Where |
|---|---|
| The GPU worker and its HTTP front (`POST /jobs`, `GET /jobs/{call}`, `DELETE /jobs/{call}`) | `services/stt/modal_app.py`, deployed as Modal app `overview-stt` |
| Asking, and asking after | `POST /api/podcasts/transcription` with `{ feedUrl, guid }`; `GET /api/podcasts/transcription/:id` |
| Reading the episode, the allowance and the length cap | `createPodcastTranscriptions.ts` |
| The jobs and the month's hours | `PodcastTranscriptionsRepository.ts`, tables `podcast_transcriptions` and `transcription_usage` (V0034) |
| Sending, asking after and giving up | `TranscriptionQueue.ts`, through `Transcriber` (`httpTranscriber.ts`) |

**The audio sent is the feed's own.** The episode is read again from its feed, and the GPU host gets
the enclosure's address, never one a caller names. The worker downloads it to a temporary folder,
capped at 700 MB, and deletes it in the same call.

**What a reader sees while waiting.** The answer is `waiting` until the worker reports that it has
started, then `transcribing`, then `ready` with the transcript, or `failed` with a reason
(`no-transcriber`, `too-long`, `audio-unreachable`, `audio-unreadable`, `no-speech`, `failed`). The
client polls every few seconds, under the address rate limit only. The worker writes its start into a
Modal `Dict` before it loads anything, which is how "no card yet" is told apart from "transcribing".

**Giving up.** With no start after 2 minutes the job is cancelled at the host and fails as
`no-transcriber`. A started job may run for 15 minutes. A host that stops answering for six polls in a row
fails the job too. A failed job costs the reader nothing, and asking again starts it afresh.

**Restarts.** A job is held under a one-minute lease from the moment a worker claims it, before it is
sent to the host, and each poll renews it. A job whose lease has lapsed is taken up by the next worker
where it was, without sending it to the host a second time. Only the first finish of a job settles the
month's seconds and episodes. Until OV-337 a queued job carried no lease, so every worker the queue
woke claimed it at once and each sent it to the host: the first two transcriptions ran six and five
times.

**Allowances.** Hours of audio a month: Free 5, BYO Plus 15, Plus 30, with no episode over 4 hours
by its feed (owner, 16 Nov 2026). Nothing is transcribed signed out: onboarding checks its episode
before the account, and the check answers as a new Free account would, since the episode is
transcribed once the reader has one (OV-327). `GET /api/overview-usage`
carries `transcription` (seconds used, the limit, and the episodes it went on, counted as each is
transcribed) where the server transcribes. The feed's length is held when the job is
queued and settled to the audio's measured length once it finishes. An episode with no length in its
feed holds an hour. Asking again for an episode already transcribed, or on its way, is free. Past the
allowance the answer is `too_many_requests`, with `quota: "transcription"`, the seconds used and the
limit, and the time until the month turns.

**Never shared.** A job belongs to one account. The words are
held for at most a day for that caller's device to collect. After that they are the reader's own copy
through the usual upload (`transcript-storage.md`). Nothing is remembered in
`podcast_transcript_sources`, so another reader's ask transcribes again.

**Cost.** Each finished job records `transcripts` / `speech-to-text` in the account's cost tally:
the worker's seconds at the list price of the GPU it ran on. An unknown card is costed at the
dearest one in the app's list.

**Switching it on.** One Modal app per environment, each reading `STT_TOKEN` from a Modal secret of
its own name, so dev runs never touch production's: `overview-stt` for dev, `overview-stt-prod` for
production (`OVERVIEW_STT_APP` picks the name at deploy). The API needs `STT_URL` (the app's web
address) and the same `STT_TOKEN`. It refuses to start with the address and no token; the token
alone leaves transcribing off, so the secret can go into Fly before the address reaches `fly.toml`.

| | Dev | Production |
|---|---|---|
| Modal app and secret | `overview-stt` | `overview-stt-prod`, by `task deploy:stt` |
| `STT_URL` | `.env.tpl` | `fly.toml` `[env]` |
| `STT_TOKEN` | `overview-dev` | `overview-prod`, into Fly by `task deploy:secrets` |
| The Modal CLI's token | `overview-dev` | `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` in `overview-prod`, a token of its own |

`task deploy:stt` runs `services/stt/deploy_prod.sh` under `overview-prod`: it sets the Modal secret,
deploys, and checks a call without the token is refused, printing no value. Production's
Bitwarden token can read `overview-prod`; the local one can't, by design.

The order in production, each step safe on its own:

1. `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (a Modal API token made for production) and `STT_TOKEN`
   in `overview-prod`.
2. `task deploy:stt`: the Modal app, its secret, and the check that it refuses a call without the token.
3. `task deploy:secrets`: `STT_TOKEN` into Fly. The running API restarts with transcribing still off.
4. Merge the change that puts `STT_URL` in `fly.toml`; its deploy switches transcribing on.

**Analytics.** `capture.episodeTranscription`: `asked` when Create's question shows (305c-2),
`chosen` with how it came about (`chosen` on the card, `asked`, `retried`, `free`), `finished` with
how long the reader waited for a transcriber and then for the words, and `failed` with why. Each
carries where it was asked from, onboarding included, and the episode's length in minutes. All are
sent from `useRunPodcastGeneration`, which every surface's run goes through. The wait's last stage,
writing, is `capture.newOverview.finished`'s `writingMs` (Create only), from the words in hand to
the overview saved, so its estimate can be fitted to the source's length and the model once there is
enough of it (OV-326).

**Onboarding's Transcribe** carries on from the episode already read rather than reading the link
again (`rememberEpisodeRead`), and the run says where the transcribing is (`OnboardingRun.transcription`,
as Create's run does) for the screens OV-327 designs.

## The screens

Designs 305a–305o (OV-305 1–4 in the Claude Design project, agreed with the owner 16 Nov 2026).

| Moment | Design | Where |
|---|---|---|
| The card says it needs transcribing before Create, "Transcribe and create", the hours it uses | 305c | `usePodcastLink` (the check), `PodcastLinkStatus`, `EpisodeOffer` in the panel, `episodeActionOf` |
| Free to ask for again: transcribed in the last day, or on its way | 305d | the same, with a line under the card |
| Not enough left, or over 4 hours: the stop takes Create's place | 305h, 305j | `TranscriptionNotice`, `transcriptionCopy.stop` |
| Asked after Create when the check couldn't tell | 305c-2 | `podcastTranscript` throws `EpisodeNeedsTranscribingError`; `RunErrorMessage`; `transcribePodcast` on the run controller |
| Transcribing as a step, "Starting…", "About N min left", "Almost done" | 305e | `transcribeEpisode` polls every 3 s; `generationRunSteps` |
| Couldn't start, stopped partway, the audio unavailable; nothing counted | 305k | `transcriptionCopy.failed` |
| Settings › Plan: transcribing's own row, plan cards list hours, the Plan row once some is used | 305m, 305o | `PlanUsage`, `PlusPlanPanel`, `planRowValue` |

The check runs once the episode is read, while the card shows "Checking for a transcript…" and Create
waits; it is typically 1–3 s. With the extension, our server answers for the remembered source and the
tag, then the extension looks on YouTube on the reader's connection; without one, our server searches,
spending one of about 100 searches a day for the whole app (owner, 16 Nov 2026). If searches run
short, that path should move to checking after Create only.

The estimate is about a minute for each hour of audio, rounded up to whole minutes, from the feed's
length; it is a status updated at most once a minute and never a percentage. Not drawn: what a
transcription that heard no speech says ("We couldn't hear any words in it", written for this build),
and onboarding's ask, which uses 305c-2's words on its no-transcript screen in place of "Transcribing
is coming soon".

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
