from pathlib import Path

import numpy as np
from kokoro_onnx import Kokoro

MODEL_FILE = "kokoro-v1.0.onnx"
VOICES_FILE = "voices-v1.0.bin"


class KokoroSynthesiser:
    sample_rate = 24000

    def __init__(self, model_dir: Path):
        self._kokoro = Kokoro(str(model_dir / MODEL_FILE), str(model_dir / VOICES_FILE))

    def voices(self) -> set[str]:
        return set(self._kokoro.get_voices())

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        samples, sample_rate = self._kokoro.create(text, voice=voice, lang=language)
        if sample_rate != self.sample_rate:
            raise RuntimeError(f"Kokoro returned {sample_rate} Hz, expected {self.sample_rate}")
        return samples
