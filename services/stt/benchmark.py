import argparse
import html
import json
import os
import platform
import re
import resource
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import jiwer
import numpy as np

from speech_engines import SAMPLE_RATE, Segment, decode, load_engine

PODCAST_NS = {"podcast": "https://podcastindex.org/namespace/1.0"}
TRANSCRIPT_PREFERENCE = ["text/vtt", "application/srt", "application/x-subrip", "text/srt"]
USER_AGENT = "Mozilla/5.0 (compatible; overview-stt-benchmark)"


def fetch(url: str, limit: int | None = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read(limit) if limit else response.read()


def find_episode(feed_url: str, title_starts_with: str) -> tuple[str, str, str]:
    root = ET.fromstring(fetch(feed_url))
    for item in root.iterfind("./channel/item"):
        if not (item.findtext("title") or "").startswith(title_starts_with):
            continue
        links = {tag.get("type"): tag.get("url") for tag in item.findall("podcast:transcript", PODCAST_NS)}
        kind = next((kind for kind in TRANSCRIPT_PREFERENCE if kind in links), None)
        if kind is None:
            raise SystemExit(f"{title_starts_with!r} has no VTT or SRT transcript")
        return item.find("enclosure").get("url"), links[kind], kind
    raise SystemExit(f"{title_starts_with!r} is not in {feed_url}")


def cached_episode(episode: dict, cache: Path) -> tuple[Path, Path]:
    audio = cache / f"{episode['name']}.audio"
    transcript = cache / f"{episode['name']}.transcript"
    if not (audio.exists() and transcript.exists()):
        audio_url, transcript_url, _ = find_episode(episode["feedUrl"], episode["titleStartsWith"])
        transcript.write_bytes(fetch(transcript_url))
        partial = audio.with_suffix(".part")
        partial.write_bytes(fetch(audio_url))
        partial.rename(audio)
    return audio, transcript


def host_words(transcript: str) -> str:
    kept = []
    for line in transcript.splitlines():
        line = line.strip()
        if not line or line == "WEBVTT" or "-->" in line or line.isdigit() or line.startswith(("NOTE", "STYLE")):
            continue
        kept.append(re.sub(r"<[^>]+>", "", html.unescape(line)))
    return " ".join(kept)


def normalised(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def score(reference: str, hypothesis: str) -> dict:
    words = jiwer.process_words(normalised(reference), normalised(hypothesis))
    reference_words = words.hits + words.substitutions + words.deletions
    return {
        "host_words": reference_words,
        "our_words": words.hits + words.substitutions + words.insertions,
        "missed_or_wrong": round((words.substitutions + words.deletions) / reference_words, 4),
        "substituted": round(words.substitutions / reference_words, 4),
        "deleted": round(words.deletions / reference_words, 4),
        "inserted": round(words.insertions / reference_words, 4),
    }


def timing_checks(segments: list[Segment], audio_seconds: float) -> dict:
    starts = [segment.start for segment in segments]
    return {
        "segments": len(segments),
        "in_order": all(a <= b for a, b in zip(starts, starts[1:])),
        "first_start": round(starts[0], 1) if starts else None,
        "last_end": round(segments[-1].end, 1) if segments else None,
        "audio_seconds": round(audio_seconds, 1),
        "longest_segment_seconds": round(max((s.end - s.start for s in segments), default=0), 1),
    }


def peak_rss_mb() -> float:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(peak / (1024 * 1024 if sys.platform == "darwin" else 1024), 1)


def usable_cpus() -> int:
    return len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else os.cpu_count() or 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("engine", help="family:model:precision, e.g. faster-whisper:large-v3-turbo:int8 or onnx-asr:nemo-parakeet-tdt-0.6b-v2:int8")
    parser.add_argument("--episodes", type=Path, default=Path(__file__).with_name("benchmark_episodes.json"))
    parser.add_argument("--only", nargs="*", help="episode names to run")
    parser.add_argument("--cache", type=Path, default=Path(__file__).resolve().parents[2] / ".local" / "stt-benchmark")
    parser.add_argument("--threads", type=int, default=usable_cpus())
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    parser.add_argument("--seconds", type=float, help="transcribe only the first this many seconds of each episode")
    args = parser.parse_args()

    args.cache.mkdir(parents=True, exist_ok=True)
    episodes = [e for e in json.loads(args.episodes.read_text()) if not args.only or e["name"] in args.only]

    load_started = time.perf_counter()
    engine = load_engine(args.engine, args.threads, args.device)
    load_seconds = time.perf_counter() - load_started

    results = {}
    for episode in episodes:
        audio_path, transcript_path = cached_episode(episode, args.cache)
        audio, decode_seconds = decode(audio_path)
        if args.seconds:
            audio = audio[: int(args.seconds * SAMPLE_RATE)]
        audio_seconds = len(audio) / SAMPLE_RATE

        wall_started, cpu_started = time.perf_counter(), time.process_time()
        segments = engine.transcribe(audio)
        wall, cpu = time.perf_counter() - wall_started, time.process_time() - cpu_started

        ours = " ".join(segment.text for segment in segments)
        (args.cache / "output").mkdir(exist_ok=True)
        (args.cache / "output" / f"{episode['name']}.{args.engine.replace(':', '_').replace('/', '_')}.json").write_text(
            json.dumps([segment.__dict__ for segment in segments])
        )
        results[episode["name"]] = {
            "audio_seconds": round(audio_seconds, 1),
            "decode_seconds": round(decode_seconds, 1),
            "wall_seconds": round(wall, 1),
            "cpu_seconds": round(cpu, 1),
            "realtime_factor": round(audio_seconds / wall, 2),
            "timing": timing_checks(segments, audio_seconds),
            "against_host": None if args.seconds else score(host_words(transcript_path.read_text()), ours),
        }
        print(f"{episode['name']}: {json.dumps(results[episode['name']])}", file=sys.stderr, flush=True)

    audio_total = sum(r["audio_seconds"] for r in results.values())
    wall_total = sum(r["wall_seconds"] for r in results.values())
    scored = [r["against_host"] for r in results.values() if r["against_host"]]
    host_total = sum(s["host_words"] for s in scored)
    print(
        json.dumps(
            {
                "engine": args.engine,
                "device": args.device,
                "machine": os.environ.get("FLY_VM_SIZE") or os.environ.get("RUNPOD_GPU_TYPE") or platform.machine(),
                "usable_cpus": usable_cpus(),
                "threads": args.threads,
                "model_load_seconds": round(load_seconds, 1),
                "peak_rss_mb": peak_rss_mb(),
                "total": {
                    "episodes": len(results),
                    "audio_seconds": round(audio_total, 1),
                    "wall_seconds": round(wall_total, 1),
                    "realtime_factor": round(audio_total / wall_total, 2) if wall_total else None,
                    "missed_or_wrong": round(sum(s["missed_or_wrong"] * s["host_words"] for s in scored) / host_total, 4) if host_total else None,
                },
                "episodes": results,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
