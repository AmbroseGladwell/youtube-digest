#!/usr/bin/env python3
"""Turn one Video Digest note (.md) into the record the library page reads.

Self-contained on purpose: build_index.py imports it, and the daily task
downloads it so it can write a record per note without rebuilding the page.

CLI:  python3 digest_note.py <outdir> <topic> <file.md> [<topic> <file.md> ...]
      writes <outdir>/<topic>__<slug>.json for each pair.
"""
import json, os, re, sys

VERDICTS = ["NOVEL", "SOLID BUT FAMILIAR", "RECYCLED", "THIN", "DUBIOUS"]
MAX_CHUNK = 200


def split_sections(text):
    body, footer = text, ""
    if "\n---\n" in text:
        body, footer = text.rsplit("\n---\n", 1)
    parts, current, buf = {}, None, []
    for line in body.splitlines():
        m = re.match(r"^##\s+(.*)$", line)
        if m:
            if current:
                parts[current] = "\n".join(buf).strip()
            current, buf = m.group(1).strip(), []
        else:
            buf.append(line)
    if current:
        parts[current] = "\n".join(buf).strip()
    return parts, footer.strip()


def field(footer, key):
    m = re.search(rf"^{re.escape(key)}:\s*(.*)$", footer, re.M)
    return m.group(1).strip() if m else ""


def flat(t):
    """One line of clean prose, safe to speak."""
    t = re.sub(r"^\s*[-*]\s+", "", t, flags=re.M)       # bullet markers
    t = re.sub(r"^\s*\d+[.)]\s+", "", t, flags=re.M)     # list numbers
    t = re.sub(r"[`*_#>]", "", t)                        # markdown noise
    t = re.sub(r"\s*\n\s*", " ", t)                      # unwrap
    return re.sub(r"\s{2,}", " ", t).strip()


def end_stop(t):
    return t if not t or t.endswith((".", "?", "!", ":")) else t + "."


def chunk_text(text):
    """Sentence-aligned pieces of at most MAX_CHUNK chars.
    Safari truncates long utterances, so everything is queued in small pieces."""
    chunks, cur = [], ""
    for sent in re.split(r"(?<=[.!?])\s+", text):
        if not sent:
            continue
        while len(sent) > MAX_CHUNK:
            cut = sent.rfind(", ", 0, MAX_CHUNK)
            cut = cut + 1 if cut > 80 else sent.rfind(" ", 0, MAX_CHUNK)
            cut = cut if cut > 0 else MAX_CHUNK
            if cur:
                chunks.append(cur.strip())
                cur = ""
            chunks.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if len(cur) + len(sent) + 1 > MAX_CHUNK:
            chunks.append(cur.strip())
            cur = sent
        else:
            cur = (cur + " " + sent).strip()
    if cur:
        chunks.append(cur.strip())
    out = []
    for c in chunks:
        c = re.sub(r"^[,;:\s]+", "", c).strip()
        if c:
            out.append(c)
    return out


def spoken(n):
    """The listening script, as chunks tagged with the section they belong to.

    Each chunk is {s: section label, i: item index within that section,
    t: text}. The page renders these grouped, so the read-along keeps the
    note's structure instead of collapsing into one wall of prose.
    """
    header = end_stop(flat(n["title"]))
    if n["channel"]:
        header += " From " + end_stop(flat(n["channel"]))

    # (section label, [items]) - an item becomes its own paragraph
    groups = [
        ("", [header] + ([flat(n["synopsis"])] if n.get("synopsis") else [])),
        ("Verdict", [end_stop(n["verdict"].capitalize()) + " " + flat(n["reasoning"])]),
        ("Core claim", [flat(n["claim"])]),
    ]

    if n["points"]:
        groups.append(("Key points", [end_stop(flat(p)) for p in n["points"]]))

    t = flat(n["try"])
    if t:
        if t.lower().startswith("nothing actionable"):
            groups.append(("Try this", ["Nothing actionable here."]))
        else:
            # keep the numbered actions as separate paragraphs
            items = [x.strip() for x in re.split(r"(?:^|\s)(?=\d+[.)]\s)", n["try"]) if x.strip()]
            items = [flat(x) for x in items] if len(items) > 1 else [t]
            groups.append(("Try this", [end_stop(x) for x in items if x]))

    w = flat(n["watch"])
    if w:
        groups.append(("Watch it anyway?", [end_stop(w)]))

    if n["sells"]:
        groups.append(("Selling", [end_stop(flat(n["selling"]))]))

    out = []
    for label, items in groups:
        if label:
            # the section name is spoken too, and highlights as its own heading
            # no trailing full stop: each chunk is its own utterance, so the
            # pause is already there, and the heading reads cleanly on screen
            out.append({"s": label, "i": -1, "h": True, "t": label})
        for i, item in enumerate(items):
            for c in chunk_text(item):
                out.append({"s": label, "i": i, "t": c})
    return out


def parse_note(topic, path):
    """One note file -> the record the page renders and speaks."""
    fn = os.path.basename(path)
    raw = open(path, encoding="utf-8").read()
    p, footer = split_sections(raw)

    vid = p.get("Video", "")
    title = field(vid, "Title") or fn[:-3].replace("-", " ")
    channel = field(vid, "Channel")

    vtext = p.get("Verdict", "")
    verdict = next((v for v in VERDICTS if vtext.upper().startswith(v)), "")
    if not verdict:
        verdict = next((v for v in VERDICTS if v in vtext.upper()), "UNKNOWN")
    reasoning = vtext[len(verdict):].lstrip(" .\n") if vtext.upper().startswith(verdict) else vtext

    watch = p.get("Watch it anyway?", "")
    selling = p.get("Selling", "")

    n = {
        "file": f"{topic}/{fn}",
        "title": title,
        "channel": channel,
        "topic": topic,
        "synopsis": p.get("In one line", ""),
        "claim": p.get("Core claim", ""),
        "points": [re.sub(r"^-\s*", "", l).strip()
                   for l in p.get("Key points", "").split("\n- ") if l.strip()],
        "verdict": verdict,
        "reasoning": reasoning,
        "selling": selling,
        "sells": not selling.strip().lower().startswith("nothing detected"),
        "try": p.get("Try this", ""),
        "watch": watch,
        "watchFlag": "Yes" if watch.strip().lower().startswith("yes") else "No",
        "tags": [t.strip() for t in p.get("Tags", "").replace("\n", " ").split(",") if t.strip()],
        "source": field(footer, "Source"),
        "saved": field(footer, "Saved"),
        "myNote": field(footer, "My note when saving"),
    }
    n["speech"] = spoken(n)
    # length of the spoken script: chars drive the listening estimate,
    # words drive the reading estimate. Same text either way.
    text = " ".join(c["t"] for c in n["speech"])
    n["chars"] = len(text)
    n["words"] = len(text.split())
    return n


def doc_id(n):
    return n["file"][:-3].replace("/", "__")


if __name__ == "__main__":
    outdir, pairs = sys.argv[1], sys.argv[2:]
    if not pairs or len(pairs) % 2:
        sys.exit("usage: digest_note.py <outdir> <topic> <file.md> [...]")
    os.makedirs(outdir, exist_ok=True)
    for topic, path in zip(pairs[::2], pairs[1::2]):
        n = parse_note(topic, path)
        out = os.path.join(outdir, doc_id(n) + ".json")
        json.dump(n, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        problems = [k for k in ("synopsis", "claim", "try") if not n[k]]
        if n["verdict"] == "UNKNOWN":
            problems.append("verdict")
        print(json.dumps({"doc_id": doc_id(n), "file_path": out,
                          "title": n["title"], "verdict": n["verdict"],
                          "chunks": len(n["speech"]), "words": n["words"],
                          "missing": problems}))
