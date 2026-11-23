import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SPEAKABLE = REPO / "packages" / "domain" / "src" / "speakable.ts"

PROBE = [
    "Pronunciation check.",
    "Yes, it's worth watching one part, from 12 minutes 30 to 18 minutes 45.",
    "No, you can probably skip the video, the overview covers it.",
    "A good coat at £600 worn a hundred times is £6 a wear; a £60 jacket worn twice is £30 a wear.",
    "Put 15% of a $5k bonus into a 401k, e.g. an index fund, vs leaving it in cash.",
    "Metabolic rate scales with mass^0.75, so 1/4 of the energy is spent, and 8x7 is 56.",
    "He compares GLP-1 drugs, mTOR, VO2 max and HRV, then runs PostgreSQL on Kubernetes with an LLM in front.",
    "Nvidia, Anthropic, Shopify and Huberman all come up, as does the 2008 crash and the year 1987.",
]


def speakable_lines(lines: list[str]) -> list[str]:
    program = (
        f"import {{ speakable }} from {json.dumps(SPEAKABLE.as_uri())};"
        "let input = '';"
        "process.stdin.on('data', (c) => (input += c));"
        "process.stdin.on('end', () => process.stdout.write(JSON.stringify(JSON.parse(input).map(speakable))));"
    )
    done = subprocess.run(
        ["node", "--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", program],
        input=json.dumps(lines),
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(done.stdout)


def sample_scripts(records: Path) -> dict[str, list[str]]:
    raw = {path.stem: [chunk["t"] for chunk in json.loads(path.read_text())["speech"]] for path in sorted(records.glob("*.json"))}
    raw["probe"] = PROBE
    flat = speakable_lines([line for lines in raw.values() for line in lines])
    scripts = {}
    for name, lines in raw.items():
        scripts[name], flat = flat[: len(lines)], flat[len(lines) :]
    return scripts
