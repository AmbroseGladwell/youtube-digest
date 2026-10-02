from dataclasses import dataclass
from typing import Protocol

import numpy as np

RENDER_VERSION = 1
LINE_GAP_SECONDS = 0.4


class Synthesiser(Protocol):
    sample_rate: int

    def voices(self) -> set[str]: ...

    def speak(self, text: str, voice: str, language: str) -> np.ndarray: ...


@dataclass(frozen=True)
class RenderedScript:
    samples: np.ndarray
    sample_rate: int
    line_starts_seconds: list[float]
    duration_seconds: float


def render_script(synthesiser: Synthesiser, lines: list[str], voice: str, language: str) -> RenderedScript:
    sample_rate = synthesiser.sample_rate
    gap = np.zeros(round(LINE_GAP_SECONDS * sample_rate), dtype=np.float32)
    pieces: list[np.ndarray] = []
    starts: list[float] = []
    position = 0
    for text in lines:
        if not text:
            starts.append(round(position / sample_rate, 3))
            continue
        if pieces:
            pieces.append(gap)
            position += len(gap)
        starts.append(round(position / sample_rate, 3))
        spoken = synthesiser.speak(text, voice, language).astype(np.float32)
        pieces.append(spoken)
        position += len(spoken)
    return RenderedScript(
        samples=np.concatenate(pieces),
        sample_rate=sample_rate,
        line_starts_seconds=starts,
        duration_seconds=round(position / sample_rate, 3),
    )
