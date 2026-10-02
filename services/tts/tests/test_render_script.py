import numpy as np
import pytest

from fake_synthesiser import FakeSynthesiser
from overview_tts.render_script import LINE_GAP_SECONDS, render_script


def test_the_first_line_starts_at_zero():
    rendered = render_script(FakeSynthesiser(), ["Verdict"], "af_heart", "en-us")

    assert rendered.line_starts_seconds == [0.0]


def test_each_line_starts_after_the_one_before_and_a_gap():
    rendered = render_script(FakeSynthesiser(), ["Verdict", "Recycled.", "Standard advice."], "af_heart", "en-us")

    assert rendered.line_starts_seconds == pytest.approx([0.0, 0.07 + LINE_GAP_SECONDS, 0.16 + 2 * LINE_GAP_SECONDS])


def test_the_duration_is_every_line_and_every_gap_between_them():
    rendered = render_script(FakeSynthesiser(), ["Verdict", "Recycled."], "af_heart", "en-us")

    assert rendered.duration_seconds == pytest.approx(0.16 + LINE_GAP_SECONDS)
    assert len(rendered.samples) == round(rendered.duration_seconds * rendered.sample_rate)


def test_the_gaps_are_silent():
    rendered = render_script(FakeSynthesiser(), ["ab", "cd"], "af_heart", "en-us")
    gap = rendered.samples[20 : 20 + round(LINE_GAP_SECONDS * 1000)]

    assert np.all(gap == 0)


def test_every_line_is_spoken_in_the_requested_voice_and_language():
    synthesiser = FakeSynthesiser()

    render_script(synthesiser, ["Verdict", "Recycled."], "bf_emma", "en-gb")

    assert synthesiser.spoken == [("Verdict", "bf_emma", "en-gb"), ("Recycled.", "bf_emma", "en-gb")]


def test_a_blank_line_is_passed_over_and_starts_where_the_line_before_ended():
    synthesiser = FakeSynthesiser()

    rendered = render_script(synthesiser, ["Verdict", "", "Standard advice."], "af_heart", "en-us")

    assert [text for text, _, _ in synthesiser.spoken] == ["Verdict", "Standard advice."]
    assert rendered.line_starts_seconds == pytest.approx([0.0, 0.07, 0.07 + LINE_GAP_SECONDS])
