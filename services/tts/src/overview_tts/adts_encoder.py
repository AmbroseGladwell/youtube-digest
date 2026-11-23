import subprocess
import threading

import numpy as np

from .encode_m4a import AAC_BITRATE
from .packed_audio import split_adts


class AdtsEncoder:
    def __init__(self, sample_rate: int):
        self._process = subprocess.Popen(
            [
                "ffmpeg", "-loglevel", "error", "-y",
                "-f", "f32le", "-ar", str(sample_rate), "-ac", "1", "-i", "-",
                "-c:a", "aac", "-b:a", AAC_BITRATE, "-flush_packets", "1", "-f", "adts", "-",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self._frames: list[bytes] = []
        self._arrived = threading.Condition()
        self._reader = threading.Thread(target=self._read, daemon=True)
        self._reader.start()

    def _read(self) -> None:
        pending = b""
        while chunk := self._process.stdout.read1(65536):
            frames, pending = split_adts(pending + chunk)
            with self._arrived:
                self._frames.extend(frames)
                self._arrived.notify_all()
        with self._arrived:
            self._arrived.notify_all()

    def write(self, samples: np.ndarray) -> None:
        self._process.stdin.write(samples.astype(np.float32).tobytes())
        self._process.stdin.flush()

    def frames(self, at_least: int, timeout: float) -> list[bytes]:
        with self._arrived:
            self._arrived.wait_for(lambda: len(self._frames) >= at_least or not self._reader.is_alive(), timeout)
            return list(self._frames)

    def close(self) -> list[bytes]:
        self._process.stdin.close()
        self._reader.join()
        if self._process.wait() != 0:
            raise RuntimeError(f"ffmpeg failed: {self._process.stderr.read().decode(errors='replace')[:500]}")
        return list(self._frames)

    def abandon(self) -> None:
        self._process.kill()
        self._process.wait()
