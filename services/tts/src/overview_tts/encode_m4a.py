import subprocess
import tempfile
from pathlib import Path

import numpy as np

AAC_BITRATE = "32k"


def encode_m4a(samples: np.ndarray, sample_rate: int) -> bytes:
    with tempfile.TemporaryDirectory() as directory:
        m4a = Path(directory) / "narration.m4a"
        subprocess.run(
            [
                "ffmpeg", "-loglevel", "error", "-y",
                "-f", "f32le", "-ar", str(sample_rate), "-ac", "1", "-i", "-",
                "-c:a", "aac", "-b:a", AAC_BITRATE, "-movflags", "+faststart",
                str(m4a),
            ],
            input=samples.astype(np.float32).tobytes(),
            check=True,
        )
        return m4a.read_bytes()
