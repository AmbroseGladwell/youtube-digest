import json
import os
import subprocess
from pathlib import Path

import numpy as np
import pytest

from overview_tts.encode_m4a import encode_m4a
from overview_tts.kokoro_synthesiser import MODEL_FILE, VOICES_FILE, KokoroSynthesiser
from overview_tts.render_script import LINE_GAP_SECONDS, render_script

MODEL_DIR = Path(os.environ.get("MODEL_DIR", Path(__file__).parent.parent / "models"))
SAMPLE_RECORD = Path(__file__).parents[3] / "samples/records/fitness__add-sets-not-weight-for-bigger-arms.json"
DECODE_RATE = 24000

pytestmark = [
    pytest.mark.model,
    pytest.mark.skipif(
        not (MODEL_DIR / MODEL_FILE).exists() or not (MODEL_DIR / VOICES_FILE).exists(),
        reason="no Kokoro model in services/tts/models (task tts:model)",
    ),
]


@pytest.fixture(scope="module")
def synthesiser():
    return KokoroSynthesiser(MODEL_DIR)


@pytest.fixture(scope="module")
def narration(synthesiser):
    speech = json.loads(SAMPLE_RECORD.read_text())["speech"]
    lines = [chunk["t"] for chunk in speech][:8]
    rendered = render_script(synthesiser, lines, "af_heart", "en-us")
    return lines, rendered, decode(encode_m4a(rendered.samples, rendered.sample_rate))


def decode(m4a: bytes) -> np.ndarray:
    pcm = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", "-", "-f", "f32le", "-ac", "1", "-ar", str(DECODE_RATE), "-"],
        input=m4a, capture_output=True, check=True,
    ).stdout
    return np.frombuffer(pcm, dtype=np.float32)


def loudness(audio: np.ndarray, start: float, end: float) -> float:
    window = audio[round(start * DECODE_RATE) : round(end * DECODE_RATE)]
    return float(np.sqrt(np.mean(window**2)))


def test_the_model_offers_every_english_voice_the_domain_lists(synthesiser):
    domain = Path(__file__).parents[3] / "packages/domain/src/NarrationVoice.ts"
    offered = {line.split(":")[0].strip() for line in domain.read_text().splitlines() if line.strip().startswith(("af_", "am_", "bf_", "bm_"))}

    assert len(offered) == 15
    assert offered <= synthesiser.voices()


def test_every_line_gets_a_start_and_they_only_move_forward(narration):
    lines, rendered, _ = narration

    assert len(rendered.line_starts_seconds) == len(lines)
    assert rendered.line_starts_seconds == sorted(rendered.line_starts_seconds)


def test_the_m4a_lasts_as_long_as_the_timings_say(narration):
    _, rendered, audio = narration

    assert len(audio) / DECODE_RATE == pytest.approx(rendered.duration_seconds, abs=0.1)


def test_each_line_starts_where_the_audio_goes_from_silence_to_speech(narration):
    _, rendered, audio = narration

    for start in rendered.line_starts_seconds[1:]:
        assert loudness(audio, start - LINE_GAP_SECONDS + 0.1, start - 0.1) < 0.005
        assert loudness(audio, start, start + 0.6) > 0.01
