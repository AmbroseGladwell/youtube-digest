import json
import time
from pathlib import Path

import modal

from speech_engines import fetch_models

ENGINES = ["onnx-asr:nemo-parakeet-tdt-0.6b-v2:fp32", "faster-whisper:large-v3-turbo:float16"]


image = (
    modal.Image.from_registry("nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04", add_python="3.12")
    .apt_install("ffmpeg")
    .pip_install("faster-whisper==1.2.1", "onnx-asr[gpu,hub]==0.12.0", "numpy>=2.0")
    .run_commands("pip uninstall -y onnxruntime onnxruntime-gpu", "pip install --no-cache-dir 'onnxruntime-gpu[cuda,cudnn]==1.32.0'")
    .run_function(fetch_models)
    .add_local_python_source("speech_engines", "gpu_worker")
)

app = modal.App("overview-stt-benchmark", image=image)


@app.cls(gpu=["L4", "A10", "T4"], timeout=1800, scaledown_window=60)
class Transcriber:
    @modal.method()
    def transcribe(self, engine_spec: str, audio_url: str) -> dict:
        import gpu_worker

        return gpu_worker.transcribe_url(engine_spec, audio_url)


@app.local_entrypoint()
def main(engine: str = ENGINES[0], gpu: str = "L4,A10,T4", only: str = "", episodes_file: str = "benchmark_episodes.json") -> None:
    from benchmark import cached_episode, find_episode, host_words, score

    here = Path(__file__).parent
    cache = here.parents[1] / ".local" / "stt-benchmark"
    (cache / "output").mkdir(parents=True, exist_ok=True)
    episodes = [e for e in json.loads((here / episodes_file).read_text()) if not only or e["name"] in only.split(",")]
    transcriber = Transcriber() if "," in gpu else Transcriber.with_options(gpu=gpu)()
    results = {}
    for episode in episodes:
        _, transcript_path = cached_episode(episode, cache)
        audio_url, _, _ = find_episode(episode["feedUrl"], episode["titleStartsWith"])
        asked = time.perf_counter()
        result = transcriber.transcribe.remote(engine, audio_url)
        result["request_to_result_seconds"] = round(time.perf_counter() - asked, 1)
        segments = result.pop("segments")
        (cache / "output" / f"modal-{engine.replace(':', '_')}-{episode['name']}.json").write_text(json.dumps(segments))
        result["against_host"] = score(host_words(transcript_path.read_text()), " ".join(s["text"] for s in segments))
        results[episode["name"]] = result
        print(f"{episode['name']}: {json.dumps(result)}", flush=True)
    gpus = sorted({r["gpu"] for r in results.values()})
    out = cache / "results" / f"{Path(episodes_file).stem}-modal-{'+'.join(gpus).replace(' ', '-')}-{engine.replace(':', '_')}.json"
    out.write_text(json.dumps({"engine": engine, "gpu": gpu, "episodes": results}, indent=2))
    print(f"saved {out}")
