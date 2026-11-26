"""OV-421: Kokoro on Modal, CPU and GPU, with memory snapshots (docs/features/tts-pre-rendered-speech.md, "Where Kokoro runs").

Deploy, then measure:
    .venv/bin/modal deploy modal_kokoro_spike.py
    .venv/bin/python modal_kokoro_spike.py [--only cpu,t4,t4-gpu-snap,l4,l4-gpu-snap] [--cold 3]
"""

import json
import os
import sys
import threading
import time
from pathlib import Path

import modal

APP_NAME = "overview-tts-spike"
SCALEDOWN_SECONDS = 2
COLD_GAP_SECONDS = 20
MODEL_DIR = "/models"
DOLLARS_PER_HOUR = {"cpu": 2 * 0.0472 + 4 * 0.008, "T4": 0.59, "L4": 0.80}

base = modal.Image.debian_slim(python_version="3.12").apt_install("curl", "ca-certificates", "ffmpeg")
cpu_image = (
    base.pip_install("kokoro-onnx==0.6.1", "onnxruntime==1.30.0", "numpy")
    .add_local_file("download_model.sh", "/download_model.sh", copy=True)
    .run_commands(f"bash /download_model.sh {MODEL_DIR}")
)
gpu_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04", add_python="3.12")
    .apt_install("curl", "ca-certificates", "ffmpeg")
    .pip_install("kokoro-onnx==0.6.1", "numpy")
    .run_commands("pip uninstall -y onnxruntime", "pip install onnxruntime-gpu==1.22.0")
    .add_local_file("download_model.sh", "/download_model.sh", copy=True)
    .run_commands(f"bash /download_model.sh {MODEL_DIR}")
)

app = modal.App(APP_NAME)


def kokoro(providers: list[str]):
    import onnxruntime as rt
    from kokoro_onnx import Kokoro

    session = rt.InferenceSession(f"{MODEL_DIR}/kokoro-v1.0.onnx", providers=providers)
    return Kokoro.from_session(session, f"{MODEL_DIR}/voices-v1.0.bin"), session.get_providers()


def speak_lines(engine, lines: list[str], voice: str, language: str) -> dict:
    timings = []
    audio = 0.0
    for line in lines:
        started = time.perf_counter()
        samples, rate = engine.create(line, voice=voice, lang=language)
        seconds = len(samples) / rate
        timings.append({"characters": len(line), "synthesis": round(time.perf_counter() - started, 3), "audio": round(seconds, 2)})
        audio += seconds
    synthesis = sum(each["synthesis"] for each in timings)
    return {
        "lines": timings,
        "audio_seconds": round(audio, 2),
        "synthesis_seconds": round(synthesis, 3),
        "realtime_factor": round(audio / synthesis, 1) if synthesis else None,
    }


class Speaker:
    engine = None
    providers: list[str] = []
    calls = 0

    def report(self, lines: list[str], voice: str, language: str) -> dict:
        self.calls += 1
        result = speak_lines(self.engine, lines, voice, language)
        result.update(
            providers=self.providers,
            first_call_in_container=self.calls == 1,
            container_ready_seconds=self.ready_seconds,
            container_id=os.environ.get("MODAL_TASK_ID"),
        )
        return result


@app.cls(image=cpu_image, cpu=2.0, memory=4096, enable_memory_snapshot=True, scaledown_window=SCALEDOWN_SECONDS, timeout=600)
class KokoroCpu(Speaker):
    @modal.enter(snap=True)
    def load(self) -> None:
        started = time.perf_counter()
        self.engine, self.providers = kokoro(["CPUExecutionProvider"])
        self.engine.create("Warm up.", voice="af_heart", lang="en-us")
        self.ready_seconds = round(time.perf_counter() - started, 2)

    @modal.method()
    def speak(self, lines: list[str], voice: str, language: str) -> dict:
        return self.report(lines, voice, language)


class GpuSpeaker(Speaker):
    def load_on_gpu(self) -> None:
        started = time.perf_counter()
        self.engine, self.providers = kokoro(["CUDAExecutionProvider", "CPUExecutionProvider"])
        self.engine.create("Warm up.", voice="af_heart", lang="en-us")
        self.ready_seconds = round(time.perf_counter() - started, 2)


GPU_OPTIONS = {"image": gpu_image, "scaledown_window": SCALEDOWN_SECONDS, "timeout": 600}
GPU_SNAPSHOT = {"enable_memory_snapshot": True, "experimental_options": {"enable_gpu_snapshot": True}}


@app.cls(gpu="T4", **GPU_OPTIONS)
class KokoroT4(GpuSpeaker):
    @modal.enter()
    def load(self) -> None:
        self.load_on_gpu()

    @modal.method()
    def speak(self, lines: list[str], voice: str, language: str) -> dict:
        return self.report(lines, voice, language)


@app.cls(gpu="T4", **GPU_OPTIONS, **GPU_SNAPSHOT)
class KokoroT4GpuSnap(GpuSpeaker):
    @modal.enter(snap=True)
    def load(self) -> None:
        self.load_on_gpu()

    @modal.method()
    def speak(self, lines: list[str], voice: str, language: str) -> dict:
        return self.report(lines, voice, language)


@app.cls(gpu="L4", **GPU_OPTIONS)
class KokoroL4(GpuSpeaker):
    @modal.enter()
    def load(self) -> None:
        self.load_on_gpu()

    @modal.method()
    def speak(self, lines: list[str], voice: str, language: str) -> dict:
        return self.report(lines, voice, language)


@app.cls(gpu="L4", **GPU_OPTIONS, **GPU_SNAPSHOT)
class KokoroL4GpuSnap(GpuSpeaker):
    @modal.enter(snap=True)
    def load(self) -> None:
        self.load_on_gpu()

    @modal.method()
    def speak(self, lines: list[str], voice: str, language: str) -> dict:
        return self.report(lines, voice, language)

CONTENDERS = {
    "cpu": ("KokoroCpu", "cpu"),
    "t4": ("KokoroT4", "T4"),
    "t4-gpu-snap": ("KokoroT4GpuSnap", "T4"),
    "l4": ("KokoroL4", "L4"),
    "l4-gpu-snap": ("KokoroL4GpuSnap", "L4"),
}

FIRST_SENTENCE = ["Yes, creatine helps most when you train hard, and the effect builds over a few weeks."]
CHUNK = [
    "Take three to five grams a day, at any time that suits you.",
    "Loading phases speed things up but aren't needed.",
    "Drink a little more water than usual while you take it.",
]


def timed(call) -> tuple[float, dict]:
    started = time.perf_counter()
    result = call()
    return round(time.perf_counter() - started, 2), result


def measure(name: str, cold_runs: int, note: list[str]) -> dict:
    class_name, hardware = CONTENDERS[name]
    speaker = modal.Cls.from_name(APP_NAME, class_name)()

    def say(lines: list[str]) -> tuple[float, dict]:
        return timed(lambda: speaker.speak.remote(lines, "af_heart", "en-us"))

    cold = []
    for run in range(cold_runs):
        time.sleep(COLD_GAP_SECONDS)
        wall, result = say(FIRST_SENTENCE)
        cold.append({"wall": wall, "first_call_in_container": result["first_call_in_container"], "synthesis": result["synthesis_seconds"], "providers": result["providers"]})
        print(f"{name} cold {run + 1}: {wall}s (synthesis {result['synthesis_seconds']}s, first in container {result['first_call_in_container']})", flush=True)

    warm_wall, warm = say(FIRST_SENTENCE)
    chunk_wall, chunk = say(CHUNK)
    note_wall, note_result = say(note)
    print(f"{name} warm sentence {warm_wall}s, chunk {chunk_wall}s, note {note_result['audio_seconds']}s of audio at {note_result['realtime_factor']}x", flush=True)

    time.sleep(COLD_GAP_SECONDS)
    together: list[dict] = []

    def reader() -> None:
        wall, result = say(CHUNK)
        together.append({"wall": wall, "container": result["container_id"], "first_call_in_container": result["first_call_in_container"]})

    threads = [threading.Thread(target=reader) for _ in range(5)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    print(f"{name} five at once: {sorted(each['wall'] for each in together)} on {len({each['container'] for each in together})} containers", flush=True)

    per_second = DOLLARS_PER_HOUR[hardware] / 3600
    return {
        "hardware": hardware,
        "cold_first_sentence": cold,
        "warm_first_sentence": {"wall": warm_wall, "synthesis": warm["synthesis_seconds"], "audio": warm["audio_seconds"]},
        "warm_chunk": {"wall": chunk_wall, "synthesis": chunk["synthesis_seconds"], "audio": chunk["audio_seconds"], "realtime_factor": chunk["realtime_factor"]},
        "note": {k: note_result[k] for k in ("audio_seconds", "synthesis_seconds", "realtime_factor")},
        "container_ready_seconds": warm["container_ready_seconds"],
        "five_at_once": together,
        "list_price_per_second": per_second,
    }


def main() -> None:
    import argparse

    sys.path.insert(0, str(Path(__file__).parent))
    from sample_scripts import sample_scripts

    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=",".join(CONTENDERS))
    parser.add_argument("--cold", type=int, default=3)
    arguments = parser.parse_args()

    here = Path(__file__).parent
    scripts = sample_scripts(here.parents[1] / "samples" / "records")
    note = max((lines for name, lines in scripts.items() if name != "probe"), key=lambda lines: sum(map(len, lines)))
    out = here.parents[1] / ".local" / "tts-benchmark" / "ov421"
    out.mkdir(parents=True, exist_ok=True)
    for name in arguments.only.split(","):
        result = measure(name, arguments.cold, note)
        target = out / f"{name}-{time.strftime('%Y%m%d-%H%M%S')}.json"
        target.write_text(json.dumps(result, indent=2))
        print(f"saved {target}", flush=True)


if __name__ == "__main__":
    main()
