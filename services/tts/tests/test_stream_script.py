import struct
import subprocess

import pytest

from fake_synthesiser import FakeSynthesiser
from overview_tts.packed_audio import MPEG_TS_CLOCK, SAMPLES_PER_FRAME, TIMESTAMP_OWNER
from overview_tts.render_script import LINE_GAP_SECONDS, render_script
from overview_tts.stream_script import ENCODER_PRIMING_SAMPLES, LineSpoken, ScriptFinished, stream_script


class KokoroRateSynthesiser(FakeSynthesiser):
    sample_rate = 24000
    samples_per_character = 1200


LINES = ["The premise", "", "A longer line that runs for several seconds.", "Short."]


def events(lines=LINES):
    return list(stream_script(KokoroRateSynthesiser(), lines, "af_heart", "en-us"))


def decoded_seconds(audio: bytes, tmp_path) -> float:
    path = tmp_path / "joined.aac"
    path.write_bytes(audio)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-"], capture_output=True, check=True).stdout
    return len(pcm) / 2 / KokoroRateSynthesiser.sample_rate


def timestamp_seconds(segment: bytes) -> float:
    owner_at = segment.index(TIMESTAMP_OWNER)
    ticks = struct.unpack(">Q", segment[owner_at + len(TIMESTAMP_OWNER) : owner_at + len(TIMESTAMP_OWNER) + 8])[0]
    return ticks / MPEG_TS_CLOCK


def test_lines_start_where_the_whole_render_puts_them():
    finished = events()[-1]

    assert isinstance(finished, ScriptFinished)
    assert finished.rendered.line_starts_seconds == render_script(KokoroRateSynthesiser(), LINES, "af_heart", "en-us").line_starts_seconds


def test_every_line_is_sent_in_order_before_the_script_finishes():
    sent = events()

    assert [event.index for event in sent[:-1]] == [0, 1, 2, 3]
    assert all(isinstance(event, LineSpoken) for event in sent[:-1])
    assert [event.start_seconds for event in sent[:-1]] == sent[-1].rendered.line_starts_seconds


def test_a_spoken_line_brings_its_audio_and_a_line_shown_but_not_spoken_brings_none():
    sent = events()

    assert sent[0].segments and sent[2].segments and sent[3].segments
    assert sent[1].segments == []


def test_segments_are_numbered_in_order_and_about_a_second_long():
    segments = [segment for event in events() for segment in event.segments]

    assert [segment.index for segment in segments] == list(range(len(segments)))
    assert all(segment.duration_seconds <= 1.03 for segment in segments)


def test_the_segments_together_play_the_whole_narration_and_the_gap_after_it(tmp_path):
    sent = events()
    segments = [segment for event in sent for segment in event.segments]
    timeline = sum(segment.duration_seconds for segment in segments)

    assert decoded_seconds(b"".join(segment.audio for segment in segments), tmp_path) == pytest.approx(timeline)
    assert timeline == pytest.approx(sent[-1].rendered.duration_seconds + LINE_GAP_SECONDS, abs=2 * SAMPLES_PER_FRAME / KokoroRateSynthesiser.sample_rate + ENCODER_PRIMING_SAMPLES / KokoroRateSynthesiser.sample_rate)


def test_each_segment_says_where_it_starts_on_the_timeline():
    segments = [segment for event in events() for segment in event.segments]
    elapsed = 0.0
    for segment in segments:
        assert timestamp_seconds(segment.audio) == pytest.approx(elapsed, abs=1 / MPEG_TS_CLOCK)
        elapsed += segment.duration_seconds


def test_a_line_s_first_segment_begins_in_the_gap_before_it():
    sent = events()
    finished = sent[-1].rendered
    priming = ENCODER_PRIMING_SAMPLES / KokoroRateSynthesiser.sample_rate
    first_of_last_line = timestamp_seconds(sent[3].segments[0].audio)

    end_of_line_before = finished.line_starts_seconds[3] - LINE_GAP_SECONDS

    assert end_of_line_before + priming < first_of_last_line < finished.line_starts_seconds[3] + priming


def test_a_script_with_nothing_to_say_is_refused():
    with pytest.raises(ValueError):
        events(["", ""])
