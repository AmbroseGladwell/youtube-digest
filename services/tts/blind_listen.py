import argparse
import html
import json
import random
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

BENCHMARK = Path(__file__).resolve().parents[2] / ".local" / "tts-benchmark"


def listen_pairs(specs: list[str], audio: Path, seed: str) -> list[dict]:
    pairs = []
    for spec in specs:
        left, right = spec.split(":")
        notes = sorted({p.stem for p in (audio / left).glob("*.m4a")} & {p.stem for p in (audio / right).glob("*.m4a")})
        pairs += [{"id": f"{spec}|{note}", "note": note, "sides": [left, right]} for note in notes]
    shuffler = random.Random(seed)
    for pair in pairs:
        shuffler.shuffle(pair["sides"])
    shuffler.shuffle(pairs)
    return pairs


def report(pairs: list[dict], picks: dict) -> str:
    wins: dict[str, Counter] = {}
    for pair in pairs:
        pick = picks.get(pair["id"])
        if pick is None:
            continue
        spec = pair["id"].split("|")[0]
        winner = "same" if pick["side"] == "same" else pair["sides"]["AB".index(pick["side"])]
        wins.setdefault(spec, Counter())[winner] += 1
    lines = [f"{len(picks)} of {len(pairs)} pairs judged", ""]
    for spec, counts in wins.items():
        lines.append(f"{spec}: " + ", ".join(f"{who} {n}" for who, n in counts.most_common()))
    for pair in pairs:
        pick = picks.get(pair["id"])
        if pick and pick.get("why"):
            lines.append(f"  {pair['note']} ({pair['id'].split('|')[0]}): {pick['why']}")
    return "\n".join(lines)


def page(pair: dict | None, done: int, total: int) -> str:
    if pair is None:
        return f"<!doctype html><meta charset=utf-8><title>Blind listen</title><body style='font:1.1rem system-ui;margin:2rem'><p>All {total} pairs judged. Run with <code>--report</code>.</p>"
    clip = lambda side: f"<h2>{side}</h2><audio controls preload=metadata src='/audio/{side}'></audio>"
    return f"""<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>
<title>Blind listen</title>
<body style='font:1.1rem system-ui;margin:2rem;max-width:40rem'>
<p>Pair {done + 1} of {total} · {html.escape(pair["note"].split("__")[-1].replace("-", " "))}</p>
{clip("A")}{clip("B")}
<form method=post action=/pick style='margin-top:2rem'>
<label>Why (optional)<br><input name=why style='width:100%;font:inherit'></label>
<p><button name=side value=A>A sounds better</button> <button name=side value=B>B sounds better</button> <button name=side value=same>No real difference</button></p>
</form>"""


def serve(pairs: list[dict], picks_path: Path, audio: Path, port: int) -> None:
    picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}

    def current() -> dict | None:
        return next((pair for pair in pairs if pair["id"] not in picks), None)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            pair = current()
            if self.path.startswith("/audio/") and pair is not None:
                side = pair["sides"]["AB".index(self.path[-1])]
                body = (audio / side / f"{pair['note']}.m4a").read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "audio/mp4")
            else:
                body = page(pair, len(picks), len(pairs)).encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:
            form = parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode())
            pair = current()
            if pair is not None:
                picks[pair["id"]] = {"side": form["side"][0], "why": form.get("why", [""])[0]}
                picks_path.write_text(json.dumps(picks, indent=2))
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()

    print(f"Listening on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Judge renders in pairs without knowing which engine made which.")
    parser.add_argument("--name", required=True)
    parser.add_argument("--pair", action="append", required=True, help="engine/voice:engine/voice, e.g. kokoro/af_heart:ming/US_Emma")
    parser.add_argument("--port", type=int, default=4794)
    parser.add_argument("--report", action="store_true")
    arguments = parser.parse_args()

    audio = BENCHMARK / "audio"
    directory = BENCHMARK / "listens" / arguments.name
    directory.mkdir(parents=True, exist_ok=True)
    pairs = listen_pairs(arguments.pair, audio, arguments.name)
    picks_path = directory / "picks.json"
    if arguments.report:
        text = report(pairs, json.loads(picks_path.read_text()) if picks_path.exists() else {})
        (directory / "report.txt").write_text(text + "\n")
        print(text)
    else:
        serve(pairs, picks_path, audio, arguments.port)


if __name__ == "__main__":
    main()
