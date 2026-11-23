import json
import resource
import sys
import time
from pathlib import Path

import modal
import numpy as np

MING_COMMIT = "c88c023ea6ccc08fd1e7a1d289cb6246c21deff1"
MING_WEIGHTS = "inclusionAI/Ming-3.0-tts-0.5b"
QWEN_MODELS = {
    "qwen-1.7b": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    "qwen-0.6b": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
}
ENGLISH_VOICES = {
    "kokoro": ["af_heart", "am_michael", "bf_emma", "bm_george"],
    "ming": ["US_Emma", "UK_George", "UK_Charlotte"],
    "qwen-1.7b": ["Ryan", "Aiden"],
    "qwen-0.6b": ["Ryan", "Aiden"],
}
KOKORO_LANGUAGE = {"a": "en-us", "b": "en-gb"}
GPU_DOLLARS_PER_HOUR = {"T4": 0.59, "L4": 0.80, "A10": 1.10}
SCALEDOWN_SECONDS = 60



def download(repo: str, into: str) -> str:
    return f"python -c 'from huggingface_hub import snapshot_download; snapshot_download(\"{repo}\", local_dir=\"{into}\")'"


ming_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git", "ffmpeg", "libsndfile1")
    .run_commands(
        "git clone https://github.com/inclusionAI/Ming-3.0-tts.git /ming",
        f"git -C /ming checkout {MING_COMMIT}",
        "pip install -r /ming/requirements.txt pynini==2.1.6",
        download(MING_WEIGHTS, "/models/ming"),
    )
    .add_local_python_source("overview_tts")
)

qwen_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsndfile1", "sox")
    .pip_install("torch==2.8.0", "torchaudio==2.8.0", "qwen-tts==0.1.1")
    .run_commands(*(download(model, f"/models/{name}") for name, model in QWEN_MODELS.items()))
    .add_local_python_source("overview_tts")
)

app = modal.App("overview-tts-benchmark")


class MingSynthesiser:
    def __init__(self):
        sys.path.insert(0, "/ming")
        from ming_tts import MingTTS

        self._model = MingTTS("/models/ming")
        self.sample_rate = self._model.sample_rate

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        waveform = self._model.synthesize(task="IP", text=text, language_id="English", controls={"ip": voice}, use_zero_spk_emb=True)
        return waveform.float().cpu().numpy()[0]


class QwenSynthesiser:
    def __init__(self, name: str):
        import torch
        from qwen_tts import Qwen3TTSModel

        self._torch = torch
        self._model = Qwen3TTSModel.from_pretrained(f"/models/{name}", device_map="cuda:0", dtype=torch.bfloat16, attn_implementation="sdpa")
        _, self.sample_rate = self._model.generate_custom_voice(text="Hello.", language="English", speaker="Ryan")

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        self._torch.manual_seed(0)
        waveforms, sample_rate = self._model.generate_custom_voice(text=text, language="English", speaker=voice)
        if sample_rate != self.sample_rate:
            raise RuntimeError(f"Qwen returned {sample_rate} Hz, expected {self.sample_rate}")
        return np.asarray(waveforms[0], dtype=np.float32)


def render_note(synthesiser, lines: list[str], voice: str, language: str) -> dict:
    from overview_tts.encode_m4a import encode_m4a
    from overview_tts.render_script import render_script

    wall_started = time.perf_counter()
    cpu_started = time.process_time()
    rendered = render_script(synthesiser, lines, voice, language)
    render_seconds = time.perf_counter() - wall_started
    cpu_seconds = time.process_time() - cpu_started
    m4a = encode_m4a(rendered.samples, rendered.sample_rate)
    return {
        "m4a": m4a,
        "lines": len(lines),
        "sample_rate": rendered.sample_rate,
        "audio_seconds": rendered.duration_seconds,
        "render_seconds": round(render_seconds, 2),
        "cpu_seconds": round(cpu_seconds, 2),
        "realtime_factor": round(rendered.duration_seconds / render_seconds, 2),
        "line_starts_seconds": rendered.line_starts_seconds,
    }


class GpuSpeaker:
    synthesiser = None

    def loaded(self, load) -> None:
        import torch

        started = time.perf_counter()
        self.synthesiser = load()
        self.load_seconds = round(time.perf_counter() - started, 1)
        self.gpu = torch.cuda.get_device_name()
        self.calls = 0

    def speak_note(self, lines: list[str], voice: str) -> dict:
        import torch

        self.calls += 1
        torch.cuda.reset_peak_memory_stats()
        result = render_note(self.synthesiser, lines, voice, "en")
        result["gpu"] = self.gpu
        result["peak_gpu_mb"] = round(torch.cuda.max_memory_allocated() / 2**20)
        result["model_load_seconds"] = self.load_seconds
        result["first_call_in_container"] = self.calls == 1
        return result


@app.cls(image=ming_image, gpu="L4", timeout=3600, scaledown_window=SCALEDOWN_SECONDS)
class Ming(GpuSpeaker):
    @modal.enter()
    def load(self) -> None:
        self.loaded(MingSynthesiser)

    @modal.method()
    def speak(self, lines: list[str], voice: str) -> dict:
        return self.speak_note(lines, voice)


@app.cls(image=qwen_image, gpu="L4", timeout=3600, scaledown_window=SCALEDOWN_SECONDS)
class Qwen(GpuSpeaker):
    name: str = modal.parameter()

    @modal.enter()
    def load(self) -> None:
        self.loaded(lambda: QwenSynthesiser(self.name))

    @modal.method()
    def speak(self, lines: list[str], voice: str) -> dict:
        return self.speak_note(lines, voice)


def kokoro_speaker():
    sys.path.insert(0, str(Path(__file__).parent / "src"))
    from overview_tts.kokoro_synthesiser import KokoroSynthesiser

    started = time.perf_counter()
    synthesiser = KokoroSynthesiser(Path(__file__).parent / "models")
    load_seconds = round(time.perf_counter() - started, 1)

    def speak(lines: list[str], voice: str) -> dict:
        result = render_note(synthesiser, lines, voice, KOKORO_LANGUAGE[voice[0]])
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        result["peak_rss_mb"] = round(peak / (2**20 if sys.platform == "darwin" else 2**10))
        result["model_load_seconds"] = load_seconds
        return result

    return speak


def gpu_speaker(engine: str, gpu: str):
    speaker = Ming.with_options(gpu=gpu)() if engine == "ming" else Qwen.with_options(gpu=gpu)(name=engine)
    return lambda lines, voice: speaker.speak.remote(lines, voice)


def note_cost(result: dict, gpu: str) -> dict:
    per_second = GPU_DOLLARS_PER_HOUR[gpu] / 3600
    return {
        "render_only": round(result["render_seconds"] * per_second, 5),
        "alone_on_a_cold_container": round(
            (result["model_load_seconds"] + result["render_seconds"] + SCALEDOWN_SECONDS) * per_second, 5
        ),
    }


@app.local_entrypoint()
def main(engine: str, voice: str, only: str = "", gpu: str = "L4") -> None:
    run(engine, voice, only, gpu)


def run(engine: str, voice: str, only: str, gpu: str) -> None:
    from sample_scripts import sample_scripts

    here = Path(__file__).parent
    if voice not in ENGLISH_VOICES[engine]:
        raise SystemExit(f"{voice} is not one of {engine}'s English voices: {ENGLISH_VOICES[engine]}")
    out = here.parents[1] / ".local" / "tts-benchmark"
    audio = out / "audio" / engine / voice
    audio.mkdir(parents=True, exist_ok=True)
    (out / "results").mkdir(parents=True, exist_ok=True)
    scripts = {name: lines for name, lines in sample_scripts(here.parents[1] / "samples" / "records").items() if not only or name in only.split(",")}

    asked = time.perf_counter()
    speak = kokoro_speaker() if engine == "kokoro" else gpu_speaker(engine, gpu)
    notes = {}
    for name, lines in scripts.items():
        started = time.perf_counter()
        result = speak(lines, voice)
        result["request_to_result_seconds"] = round(time.perf_counter() - (asked if not notes else started), 1)
        (audio / f"{name}.m4a").write_bytes(result.pop("m4a"))
        if engine != "kokoro":
            result["cost_dollars"] = note_cost(result, gpu)
        notes[name] = result
        print(f"{name}: {json.dumps({k: v for k, v in result.items() if k != 'line_starts_seconds'})}", flush=True)

    measured = [result for name, result in notes.items() if name != "probe"]
    total = {
        "notes": len(measured),
        "audio_seconds": round(sum(r["audio_seconds"] for r in measured), 1),
        "render_seconds": round(sum(r["render_seconds"] for r in measured), 1),
    }
    if total["render_seconds"]:
        total["realtime_factor"] = round(total["audio_seconds"] / total["render_seconds"], 2)
    if engine != "kokoro" and measured:
        total["render_only_dollars_per_note"] = round(sum(r["cost_dollars"]["render_only"] for r in measured) / len(measured), 5)
    target = out / "results" / f"{engine}-{voice}-{'local' if engine == 'kokoro' else gpu}.json"
    target.write_text(json.dumps({"engine": engine, "voice": voice, "gpu": None if engine == "kokoro" else gpu, "total": total, "notes": notes}, indent=2))
    print(f"total: {json.dumps(total)}\nsaved {target}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Kokoro runs here, on this machine; the GPU engines run with `modal run`.")
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--only", default="")
    arguments = parser.parse_args()
    run("kokoro", arguments.voice, arguments.only, "")
