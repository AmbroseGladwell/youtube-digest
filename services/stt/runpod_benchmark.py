import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from benchmark import cached_episode, find_episode, host_words, score

MANAGE = "https://api.runpod.io/v2"
SERVERLESS = "https://api.runpod.ai/v2"
GPU_POOLS = ["AMPERE_16", "AMPERE_24"]
EXCLUDED_GPUS = ["NVIDIA RTX PRO 6000 Blackwell Server Edition MIG 1g.24gb"]


def call(method: str, url: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        url,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={"Authorization": f"Bearer {os.environ['RUNPOD_API_KEY']}", "Content-Type": "application/json", "User-Agent": "overview-stt-benchmark/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{method} {url} -> {error.code}: {error.read().decode()[:2000]}")


def setup(image: str) -> None:
    endpoint = call(
        "POST",
        f"{MANAGE}/serverless",
        {
            "name": "overview-stt-benchmark",
            "image": image,
            "type": "QUEUE",
            "gpu": {"pools": GPU_POOLS, "excludedTypes": EXCLUDED_GPUS, "count": 1, "minCudaVersion": "12.6"},
            "workers": {"min": 0, "max": 1, "idleTimeout": 5},
            "scaling": {"type": "QUEUE_DELAY", "queueDelay": 4},
            "flashboot": "FLASHBOOT",
            "disk": 20,
            "timeout": 1_800_000,
        },
    )
    print(json.dumps({k: endpoint.get(k) for k in ("id", "name", "gpu", "workers", "flashboot")}))


def run(endpoint: str, engine: str, episodes_file: str, only: str) -> None:
    here = Path(__file__).parent
    cache = here.parents[1] / ".local" / "stt-benchmark"
    (cache / "output").mkdir(parents=True, exist_ok=True)
    episodes = [e for e in json.loads((here / episodes_file).read_text()) if not only or e["name"] in only.split(",")]
    results = {}
    for episode in episodes:
        _, transcript_path = cached_episode(episode, cache)
        audio_url, _, _ = find_episode(episode["feedUrl"], episode["titleStartsWith"])
        asked = time.perf_counter()
        job = call("POST", f"{SERVERLESS}/{endpoint}/run", {"input": {"engine": engine, "audio_url": audio_url}})
        while True:
            status = call("GET", f"{SERVERLESS}/{endpoint}/status/{job['id']}")
            if status["status"] in ("COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"):
                break
            time.sleep(3)
        if status["status"] != "COMPLETED":
            raise SystemExit(f"{episode['name']}: {json.dumps(status)[:2000]}")
        result = status["output"]
        result["request_to_result_seconds"] = round(time.perf_counter() - asked, 1)
        result["queue_seconds"] = round(status.get("delayTime", 0) / 1000, 1)
        result["billed_execution_seconds"] = round(status.get("executionTime", 0) / 1000, 1)
        segments = result.pop("segments")
        (cache / "output" / f"runpod-{engine.replace(':', '_')}-{episode['name']}.json").write_text(json.dumps(segments))
        result["against_host"] = score(host_words(transcript_path.read_text()), " ".join(s["text"] for s in segments))
        results[episode["name"]] = result
        print(f"{episode['name']}: {json.dumps(result)}", flush=True)
    gpus = sorted({r["gpu"] for r in results.values()})
    out = cache / "results" / f"{Path(episodes_file).stem}-runpod-{'+'.join(gpus).replace(' ', '-')}-{engine.replace(':', '_')}.json"
    out.write_text(json.dumps({"engine": engine, "endpoint": endpoint, "episodes": results}, indent=2))
    print(f"saved {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("setup").add_argument("image")
    commands.add_parser("delete").add_argument("endpoint")
    runner = commands.add_parser("run")
    runner.add_argument("endpoint")
    runner.add_argument("--engine", default="faster-whisper:large-v3-turbo:float16")
    runner.add_argument("--episodes-file", default="benchmark_episodes.json")
    runner.add_argument("--only", default="")
    args = parser.parse_args()
    if args.command == "setup":
        setup(args.image)
    elif args.command == "delete":
        call("DELETE", f"{MANAGE}/serverless/{args.endpoint}")
    else:
        run(args.endpoint, args.engine, args.episodes_file, args.only)


if __name__ == "__main__":
    main()
