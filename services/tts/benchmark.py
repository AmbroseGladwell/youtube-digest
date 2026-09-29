import argparse
import json
import os
import platform
import resource
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import onnxruntime as rt
from kokoro_onnx import Kokoro


def spoken_chunks(record_path: Path) -> list[str]:
    record = json.loads(record_path.read_text())
    return [chunk["t"] for chunk in record["speech"] if not chunk.get("h")]


def peak_rss_mb() -> float:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(peak / (1024 * 1024 if sys.platform == "darwin" else 1024), 1)


def usable_cpus() -> int:
    if hasattr(os, "sched_getaffinity"):
        return len(os.sched_getaffinity(0))
    return os.cpu_count() or 1


def load_kokoro(model: Path, voices: Path, threads: int | None) -> Kokoro:
    if threads is None:
        return Kokoro(str(model), str(voices))
    options = rt.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    session = rt.InferenceSession(str(model), options, providers=["CPUExecutionProvider"])
    return Kokoro.from_session(session, str(voices))


def encode_m4a(audio: np.ndarray, sample_rate: int) -> tuple[int, float]:
    with tempfile.TemporaryDirectory() as directory:
        m4a = Path(directory) / "note.m4a"
        started = time.perf_counter()
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(sample_rate), "-ac", "1", "-i", "-",
             "-c:a", "aac", "-b:a", "32k", str(m4a)],
            input=audio.astype(np.float32).tobytes(),
            check=True,
        )
        return m4a.stat().st_size, time.perf_counter() - started


def synthesise(kokoro: Kokoro, chunks: list[str], voice: str) -> dict:
    wall_started = time.perf_counter()
    cpu_started = time.process_time()
    pieces = []
    starts = []
    elapsed = 0.0
    sample_rate = 24000
    for text in chunks:
        audio, sample_rate = kokoro.create(text, voice=voice, lang="en-us")
        starts.append(round(elapsed, 3))
        pieces.append(audio)
        elapsed += len(audio) / sample_rate
    wall = time.perf_counter() - wall_started
    cpu = time.process_time() - cpu_started
    audio = np.concatenate(pieces)
    m4a_bytes, encode_seconds = encode_m4a(audio, sample_rate)
    return {
        "chunks": len(chunks),
        "audio_seconds": round(elapsed, 1),
        "wall_seconds": round(wall, 1),
        "cpu_seconds": round(cpu, 1),
        "realtime_factor": round(elapsed / wall, 2),
        "encode_seconds": round(encode_seconds, 2),
        "m4a_kb": round(m4a_bytes / 1024),
        "chunk_starts": starts,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("records", type=Path)
    parser.add_argument("--model", type=Path, default=Path("kokoro-v1.0.onnx"))
    parser.add_argument("--voices", type=Path, default=Path("voices-v1.0.bin"))
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--threads", type=int)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    load_started = time.perf_counter()
    kokoro = load_kokoro(args.model, args.voices, args.threads)
    load_seconds = time.perf_counter() - load_started

    records = sorted(args.records.glob("*.json"))[: args.limit]
    notes = {record.stem: synthesise(kokoro, spoken_chunks(record), args.voice) for record in records}

    audio = sum(note["audio_seconds"] for note in notes.values())
    wall = sum(note["wall_seconds"] for note in notes.values())
    cpu = sum(note["cpu_seconds"] for note in notes.values())
    print(
        json.dumps(
            {
                "machine": os.environ.get("FLY_VM_SIZE", platform.machine()),
                "fly_machine_id": os.environ.get("FLY_MACHINE_ID"),
                "usable_cpus": usable_cpus(),
                "threads": args.threads or "onnxruntime default",
                "voice": args.voice,
                "model_load_seconds": round(load_seconds, 1),
                "peak_rss_mb": peak_rss_mb(),
                "total": {
                    "notes": len(notes),
                    "audio_seconds": round(audio, 1),
                    "wall_seconds": round(wall, 1),
                    "cpu_seconds": round(cpu, 1),
                    "realtime_factor": round(audio / wall, 2),
                    "wall_seconds_per_audio_second": round(wall / audio, 3),
                },
                "notes": notes,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
