"""OV-431: how many renders one Modal T4 container takes at once before chunks fall behind playback.

    .venv/bin/modal deploy modal_load_test.py
    .venv/bin/python modal_load_test.py --at-once 1,2,4,8 --readers 5,10,20      (TTS_TOKEN in the environment)
"""

import json
import os
import statistics
import sys
import threading
import time
import urllib.request
from pathlib import Path

import modal

from modal_app import MODEL_DIR, image

APP_NAME = "overview-tts-load-test"
AT_ONCE = [1, 2, 4, 8]

app = modal.App(APP_NAME, image=image.add_local_file("modal_app.py", "/root/modal_app.py"))
secret = modal.Secret.from_name("overview-tts")


def served(at_once: int):
    from overview_tts.create_app import create_app
    from overview_tts.idle_exit import IdleExit
    from overview_tts.kokoro_synthesiser import KokoroSynthesiser

    synthesiser = KokoroSynthesiser(Path(MODEL_DIR), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    synthesiser.speak("Ready.", "af_heart", "en-us")
    synthesiser.gpu = os.environ.get("MODAL_TASK_ID")
    return create_app(synthesiser, IdleExit(float("inf"), lambda: None), renders_at_once=at_once)


OPTIONS = {"gpu": "T4", "secrets": [secret], "scaledown_window": 5, "timeout": 600}


@app.function(**OPTIONS)
@modal.concurrent(max_inputs=1)
@modal.asgi_app(label="ov431-at-once-1")
def at_once_1():
    return served(1)


@app.function(**OPTIONS)
@modal.concurrent(max_inputs=2)
@modal.asgi_app(label="ov431-at-once-2")
def at_once_2():
    return served(2)


@app.function(**OPTIONS)
@modal.concurrent(max_inputs=4)
@modal.asgi_app(label="ov431-at-once-4")
def at_once_4():
    return served(4)


@app.function(**OPTIONS)
@modal.concurrent(max_inputs=8)
@modal.asgi_app(label="ov431-at-once-8")
def at_once_8():
    return served(8)


SENTENCE = "Creatine helps most when you train hard, and the effect builds over a few weeks of steady use."
CHUNK_SENTENCES = [1, 2, 4, 6, 6, 6]


def url_of(at_once: int) -> str:
    return f"https://theoverviewapp--ov431-at-once-{at_once}.us-east.modal.run/render/stream"


def render(url: str, token: str, sentences: int) -> dict:
    body = json.dumps({"lines": [SENTENCE] * sentences, "voice": "af_heart", "language": "en-us", "renderVersion": 1}).encode()
    request = urllib.request.Request(url, data=body, method="POST", headers={"authorization": f"Bearer {token}", "content-type": "application/json"})
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=600) as response:
        for raw in response:
            event = json.loads(raw)
            if event["type"] == "done":
                return {"wall": time.perf_counter() - started, "audio": event["durationSeconds"], "container": event.get("gpu")}
    raise RuntimeError("no done event")


def reader(url: str, token: str, results: list[dict]) -> None:
    started = time.perf_counter()
    chunks = [render(url, token, sentences) for sentences in CHUNK_SENTENCES]
    first_audio = chunks[0]["wall"]
    clock = first_audio
    playing_until = first_audio + chunks[0]["audio"]
    gap = 0.0
    for chunk in chunks[1:]:
        clock += chunk["wall"]
        if clock > playing_until:
            gap += clock - playing_until
            playing_until = clock
        playing_until += chunk["audio"]
    results.append(
        {
            "first_audio": first_audio,
            "gap": gap,
            "chunk_seconds": [round(chunk["wall"], 2) for chunk in chunks],
            "containers": {chunk["container"] for chunk in chunks},
            "total": time.perf_counter() - started,
        }
    )


def run(at_once: int, readers: int, token: str) -> dict:
    url = url_of(at_once)
    render(url, token, 1)
    results: list[dict] = []
    threads = [threading.Thread(target=reader, args=(url, token, results)) for _ in range(readers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    gaps = sorted(result["gap"] for result in results)
    firsts = sorted(result["first_audio"] for result in results)
    chunk_waits = [seconds for result in results for seconds in result["chunk_seconds"][1:]]
    return {
        "at_once": at_once,
        "readers": readers,
        "first_audio_median": round(statistics.median(firsts), 2),
        "first_audio_worst": round(firsts[-1], 2),
        "readers_with_a_gap": sum(1 for gap in gaps if gap > 0.25),
        "gap_worst": round(gaps[-1], 2),
        "later_chunk_median": round(statistics.median(chunk_waits), 2),
        "containers": len(set().union(*(result["containers"] for result in results))),
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--at-once", default=",".join(map(str, AT_ONCE)))
    parser.add_argument("--readers", default="5,10,20")
    arguments = parser.parse_args()
    token = os.environ["TTS_TOKEN"]
    out = Path(__file__).parents[2] / ".local" / "tts-benchmark" / "ov431"
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for at_once in map(int, arguments.at_once.split(",")):
        for readers in map(int, arguments.readers.split(",")):
            row = run(at_once, readers, token)
            rows.append(row)
            print(json.dumps(row), flush=True)
            time.sleep(10)
    (out / f"load-{time.strftime('%Y%m%d-%H%M%S')}.json").write_text(json.dumps(rows, indent=2))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main()
