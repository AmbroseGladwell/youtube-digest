import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from speech_engines import SAMPLE_RATE, decode, load_engine

USER_AGENT = "Mozilla/5.0 (compatible; overview-stt-benchmark)"
BATCH_SIZE = 32
engines: dict[str, object] = {}
started_at = time.time()


def gpu_name() -> str | None:
    try:
        return subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def download(url: str, to: Path) -> tuple[int, float]:
    started = time.perf_counter()
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=300) as response, to.open("wb") as file:
        while chunk := response.read(1 << 20):
            file.write(chunk)
    return to.stat().st_size, time.perf_counter() - started


def transcribe_url(engine_spec: str, audio_url: str) -> dict:
    handled_at = time.time()
    cold = engine_spec not in engines
    load_seconds = 0.0
    if cold:
        load_started = time.perf_counter()
        engines[engine_spec] = load_engine(engine_spec, threads=4, device="cuda", batch_size=BATCH_SIZE)
        load_seconds = time.perf_counter() - load_started
    with tempfile.TemporaryDirectory() as directory:
        audio_bytes, download_seconds = download(audio_url, Path(directory) / "episode.audio")
        audio, decode_seconds = decode(Path(directory) / "episode.audio")
    transcribe_started = time.perf_counter()
    segments = engines[engine_spec].transcribe(audio)
    transcribe_seconds = time.perf_counter() - transcribe_started
    return {
        "gpu": gpu_name(),
        "cold": cold,
        "process_age_seconds": round(handled_at - started_at, 1),
        "model_load_seconds": round(load_seconds, 1),
        "audio_bytes": audio_bytes,
        "download_seconds": round(download_seconds, 1),
        "decode_seconds": round(decode_seconds, 1),
        "audio_seconds": round(len(audio) / SAMPLE_RATE, 1),
        "transcribe_seconds": round(transcribe_seconds, 1),
        "realtime_factor": round(len(audio) / SAMPLE_RATE / transcribe_seconds, 1),
        "worker_seconds": round(time.time() - handled_at, 1),
        "segments": [segment.__dict__ for segment in segments],
    }
