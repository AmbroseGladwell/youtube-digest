import subprocess

import numpy as np
import pytest

from overview_tts.encode_m4a import encode_m4a


def m4a_duration_seconds(m4a: bytes, tmp_path) -> float:
    path = tmp_path / "narration.m4a"
    path.write_bytes(m4a)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(probe.stdout)


def test_the_m4a_is_an_mp4_container(tmp_path):
    m4a = encode_m4a(np.zeros(24000, dtype=np.float32), 24000)

    assert m4a[4:8] == b"ftyp"


def test_the_m4a_lasts_as_long_as_the_samples(tmp_path):
    tone = np.sin(np.linspace(0, 2 * np.pi * 440 * 3, 24000 * 3)).astype(np.float32) * 0.3

    assert m4a_duration_seconds(encode_m4a(tone, 24000), tmp_path) == pytest.approx(3.0, abs=0.05)
