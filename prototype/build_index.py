#!/usr/bin/env python3
"""Parse Video Digest notes into JSON and inject into the index page template.

Usage: python3 build_index.py [BASE_DIR]
Expects BASE_DIR/notes/<topic>/<slug>.md and BASE_DIR/index_template.html,
writes BASE_DIR/video-digest-index.html

The per-note parsing lives in digest_note.py, which the daily task also
carries, so a note written by the task and a note built here produce the
same record.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from digest_note import VERDICTS, parse_note, doc_id

BASE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
ROOT = os.path.join(BASE, "notes")

notes = []
for topic in sorted(os.listdir(ROOT)):
    tdir = os.path.join(ROOT, topic)
    if not os.path.isdir(tdir):
        continue
    for fn in sorted(os.listdir(tdir)):
        if fn.endswith(".md"):
            notes.append(parse_note(topic, os.path.join(tdir, fn)))

order = {v: i for i, v in enumerate(VERDICTS)}
notes.sort(key=lambda n: (order.get(n["verdict"], 9), n["title"].lower()))

# one JSON file per note, ready to seed or update the artifact database.
# Writing them to disk keeps note bodies out of the model's context: the
# batch write references them by file_path instead of inlining the data.
DBDIR = os.path.join(BASE, "dbdocs")
os.makedirs(DBDIR, exist_ok=True)
for old in os.listdir(DBDIR):
    if old.endswith(".json"):
        os.remove(os.path.join(DBDIR, old))
manifest = []
for n in notes:
    did = doc_id(n)
    json.dump(n, open(os.path.join(DBDIR, did + ".json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    manifest.append({"op": "set", "collection": "notes", "doc_id": did,
                     "file_path": os.path.join(DBDIR, did + ".json")})
json.dump(manifest, open(os.path.join(BASE, "db_manifest.json"), "w"), indent=1)

tpl = open(os.path.join(BASE, "index_template.html"), encoding="utf-8").read()
out = tpl.replace("/*__DATA__*/", json.dumps(notes, ensure_ascii=False))

# jsPDF is injected rather than pulled from a CDN at run time. The library is
# only needed when someone exports, but a download button that silently fails
# because a pinned CDN version moved is worse than a heavier page, and the
# page is now republished rarely.
JSPDF = os.path.join(BASE, "vendor", "jspdf.umd.min.js")
if os.path.exists(JSPDF):
    lib = open(JSPDF, encoding="utf-8").read()
    out = out.replace("/*__JSPDF__*/", lib)
    print("jspdf injected:", round(len(lib)/1024), "KB, version",
          open(os.path.join(BASE, "vendor", "VERSION")).read().strip())
else:
    print("WARNING: vendor/jspdf.umd.min.js missing, export button will not work")
open(os.path.join(BASE, "video-digest-index.html"), "w", encoding="utf-8").write(out)

print(f"notes: {len(notes)}")
print("verdicts:", {v: sum(1 for n in notes if n["verdict"] == v) for v in VERDICTS})
print("topics:", {t: sum(1 for n in notes if n["topic"] == t) for t in sorted({n['topic'] for n in notes})})
print("selling:", sum(1 for n in notes if n["sells"]), "/", len(notes))
print("watch yes:", sum(1 for n in notes if n["watchFlag"] == "Yes"))
print("speech chunks:", sum(len(n["speech"]) for n in notes), "total,",
      max((len(c["t"]) for n in notes for c in n["speech"]), default=0), "longest")
print("length: total", sum(n["chars"] for n in notes), "chars,", sum(n["words"] for n in notes), "words")
print("db docs written:", len(manifest), "-> dbdocs/ and db_manifest.json")
print("largest db doc:", max((os.path.getsize(os.path.join(DBDIR, f)) for f in os.listdir(DBDIR)), default=0), "bytes")
print("sections seen:", sorted({c["s"] for n in notes for c in n["speech"]}))
print("missing verdict:", [n["file"] for n in notes if n["verdict"] == "UNKNOWN"])
print("missing synopsis:", [n["file"] for n in notes if not n.get("synopsis")])
print("empty claim:", [n["file"] for n in notes if not n["claim"]])
print("empty try:", [n["file"] for n in notes if not n["try"]])
