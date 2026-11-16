import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SAMPLE_RATE = 16000
MODELS_DIR = Path(os.environ.get("STT_MODELS_DIR", "/models"))
ONNX_REPOS = {"nemo-parakeet-tdt-0.6b-v2": "istupakov/parakeet-tdt-0.6b-v2-onnx"}


@dataclass
class Segment:
    start: float
    end: float
    text: str


def decode(audio: Path) -> tuple[np.ndarray, float]:
    started = time.perf_counter()
    raw = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(audio), "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32), time.perf_counter() - started


class FasterWhisperEngine:
    def __init__(self, model: str, compute_type: str, threads: int, device: str, batch_size: int):
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        self.model = WhisperModel(model, device=device, compute_type=compute_type, cpu_threads=threads)
        self.batched = BatchedInferencePipeline(self.model) if batch_size > 1 else None
        self.batch_size = batch_size

    def transcribe(self, audio: np.ndarray) -> list[Segment]:
        if self.batched is not None:
            segments, _ = self.batched.transcribe(audio, language="en", beam_size=1, batch_size=self.batch_size)
        else:
            segments, _ = self.model.transcribe(audio, language="en", vad_filter=True, beam_size=1, condition_on_previous_text=False)
        return [Segment(segment.start, segment.end, segment.text.strip()) for segment in segments]


class OnnxAsrEngine:
    def __init__(self, model: str, quantization: str | None, threads: int, device: str, batch_size: int):
        import onnx_asr
        import onnxruntime as rt

        options = rt.SessionOptions()
        options.intra_op_num_threads = threads
        if device == "cuda" and hasattr(rt, "preload_dlls"):
            rt.preload_dlls()
        if device == "cuda" and "CUDAExecutionProvider" not in rt.get_available_providers():
            raise RuntimeError(f"CUDA was asked for but onnxruntime offers only {rt.get_available_providers()}")
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if device == "cuda" else ["CPUExecutionProvider"]
        vad = onnx_asr.load_vad("silero", providers=["CPUExecutionProvider"])
        local = MODELS_DIR / model
        path = local if local.is_dir() else None
        asr = onnx_asr.load_model(model, path, quantization=quantization, sess_options=options, providers=providers)
        self.model = asr.with_vad(vad, max_speech_duration_s=30, batch_size=batch_size)

    def transcribe(self, audio: np.ndarray) -> list[Segment]:
        return [Segment(float(s.start), float(s.end), s.text.strip()) for s in self.model.recognize(audio, sample_rate=SAMPLE_RATE)]


def load_engine(spec: str, threads: int, device: str, batch_size: int = 8):
    family, model, precision = spec.split(":")
    if family == "faster-whisper":
        return FasterWhisperEngine(model, precision, threads, device, batch_size if device == "cuda" else 1)
    if family == "onnx-asr":
        return OnnxAsrEngine(model, None if precision == "fp32" else precision, threads, device, batch_size)
    raise SystemExit(f"unknown engine family {family!r}")


def fetch_models() -> None:
    import onnx_asr
    from faster_whisper import download_model
    from huggingface_hub import snapshot_download

    download_model("large-v3-turbo")
    onnx_asr.load_vad("silero", providers=["CPUExecutionProvider"])
    for model, repo in ONNX_REPOS.items():
        snapshot_download(repo, local_dir=MODELS_DIR / model)
        onnx_asr.load_model(model, MODELS_DIR / model, providers=["CPUExecutionProvider"])
