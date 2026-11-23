from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np

from .adts_encoder import AdtsEncoder
from .packed_audio import SAMPLES_PER_FRAME, packed_audio_segment
from .render_script import LINE_GAP_SECONDS, RenderedScript, Synthesiser

SEGMENT_SECONDS = 1.0
ENCODER_PRIMING_SAMPLES = 1024
FRAME_WAIT_SECONDS = 2.0


@dataclass(frozen=True)
class Segment:
    index: int
    duration_seconds: float
    audio: bytes


@dataclass(frozen=True)
class LineSpoken:
    index: int
    start_seconds: float
    segments: list[Segment]


@dataclass(frozen=True)
class ScriptFinished:
    rendered: RenderedScript
    segments: list[Segment]


class _Segmenter:
    def __init__(self, sample_rate: int):
        self._sample_rate = sample_rate
        self._frames_per_segment = max(1, round(SEGMENT_SECONDS * sample_rate / SAMPLES_PER_FRAME))
        self.cut = 0
        self._next_index = 0

    def up_to(self, frames: list[bytes], end: int) -> list[Segment]:
        segments = []
        while self.cut < end:
            stop = min(self.cut + self._frames_per_segment, end)
            segments.append(
                Segment(
                    index=self._next_index,
                    duration_seconds=(stop - self.cut) * SAMPLES_PER_FRAME / self._sample_rate,
                    audio=packed_audio_segment(frames[self.cut : stop], self.cut, self._sample_rate),
                )
            )
            self._next_index += 1
            self.cut = stop
        return segments


# Lines in the order render_script speaks them, each sent as segments the moment it is spoken.
# A segment ends halfway through the gap after its line, which the encoder has already let go of.
def stream_script(
    synthesiser: Synthesiser, lines: list[str], voice: str, language: str, frame_wait_seconds: float = FRAME_WAIT_SECONDS
) -> Iterator[LineSpoken | ScriptFinished]:
    sample_rate = synthesiser.sample_rate
    gap = np.zeros(round(LINE_GAP_SECONDS * sample_rate), dtype=np.float32)
    encoder = AdtsEncoder(sample_rate)
    segmenter = _Segmenter(sample_rate)
    finished = False
    try:
        pieces: list[np.ndarray] = []
        starts: list[float] = []
        position = 0
        for index, text in enumerate(lines):
            if not text:
                starts.append(round(position / sample_rate, 3))
                yield LineSpoken(index, starts[-1], [])
                continue
            if pieces:
                pieces.append(gap)
                position += len(gap)
            starts.append(round(position / sample_rate, 3))
            spoken = synthesiser.speak(text, voice, language).astype(np.float32)
            pieces.append(spoken)
            position += len(spoken)
            encoder.write(spoken)
            encoder.write(gap)
            boundary = (position + len(gap) // 2 + ENCODER_PRIMING_SAMPLES) // SAMPLES_PER_FRAME
            frames = encoder.frames(boundary, frame_wait_seconds)
            yield LineSpoken(index, starts[-1], segmenter.up_to(frames, min(boundary, len(frames))))
        if not pieces:
            raise ValueError("A spoken script says something")
        frames = encoder.close()
        finished = True
        rendered = RenderedScript(
            samples=np.concatenate(pieces),
            sample_rate=sample_rate,
            line_starts_seconds=starts,
            duration_seconds=round(position / sample_rate, 3),
        )
        yield ScriptFinished(rendered, segmenter.up_to(frames, len(frames)))
    finally:
        if not finished:
            encoder.abandon()
