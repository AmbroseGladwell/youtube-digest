import logging
import threading
import time
from pathlib import Path

import numpy as np

from . import log_lines

log = logging.getLogger(__name__)

MODEL_FILE = "kokoro-v1.0.onnx"
VOICES_FILE = "voices-v1.0.bin"


class KokoroSynthesiser:
    sample_rate = 24000

    def __init__(self, model_dir: Path):
        from kokoro_onnx import Kokoro

        self._kokoro = Kokoro(str(model_dir / MODEL_FILE), str(model_dir / VOICES_FILE))

    def voices(self) -> set[str]:
        return set(self._kokoro.get_voices())

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        samples, sample_rate = self._kokoro.create(text, voice=voice, lang=language)
        if sample_rate != self.sample_rate:
            raise RuntimeError(f"Kokoro returned {sample_rate} Hz, expected {self.sample_rate}")
        return samples


# The port opens before the model has loaded, so the request that woke a stopped machine is
# held until Kokoro is ready rather than refused while it loads
# (docs/architecture/deploy.md, "The TTS service").
class LoadingSynthesiser:
    def __init__(self, load):
        self._ready = threading.Event()
        self._loaded = None
        self._error: BaseException | None = None
        threading.Thread(target=self._load, args=(load,), daemon=True).start()

    def _load(self, load) -> None:
        started = time.perf_counter()
        try:
            self._loaded = load()
            log_lines.MODEL_LOADED.write(log, loadSeconds=round(time.perf_counter() - started, 2))
        except BaseException as error:
            self._error = error
            log_lines.MODEL_FAILED_TO_LOAD.write(log, exc_info=error)
        finally:
            self._ready.set()

    def _synthesiser(self):
        self._ready.wait()
        if self._loaded is None:
            raise RuntimeError("Kokoro failed to load") from self._error
        return self._loaded

    @property
    def sample_rate(self) -> int:
        return self._synthesiser().sample_rate

    def voices(self) -> set[str]:
        return self._synthesiser().voices()

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        return self._synthesiser().speak(text, voice, language)
