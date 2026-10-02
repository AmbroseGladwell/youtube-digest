import pytest
from fastapi.testclient import TestClient

from fake_synthesiser import FakeSchedule, FakeSynthesiser
from overview_tts.create_app import create_app
from overview_tts.idle_exit import IdleExit
from overview_tts.render_script import RENDER_VERSION


class BrokenSynthesiser(FakeSynthesiser):
    def speak(self, text, voice, language):
        raise RuntimeError(f"phonemiser failed on '{text}'")


@pytest.fixture
def reported():
    return []


def client_for(synthesiser, report_exception):
    app = create_app(synthesiser, IdleExit(15, lambda: None, FakeSchedule()), report_exception)
    return TestClient(app, raise_server_exceptions=False)


def render_body(**overrides):
    return {"lines": ["Verdict", "Recycled."], "voice": "af_heart", "language": "en-us", "renderVersion": RENDER_VERSION, **overrides}


def test_an_exception_nothing_planned_for_is_answered_as_internal_error_and_reported(reported):
    client = client_for(BrokenSynthesiser(), reported.append)

    response = client.post("/render", json=render_body())

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert [type(error).__name__ for error in reported] == ["RuntimeError"]


def test_a_refusal_the_service_meant_is_not_reported(reported):
    client = client_for(FakeSynthesiser(), reported.append)

    unknown_voice = client.post("/render", json=render_body(voice="xx_nobody"))
    wrong_version = client.post("/render", json=render_body(renderVersion=RENDER_VERSION + 1))
    invalid = client.post("/render", json=render_body(lines=[]))

    assert [unknown_voice.status_code, wrong_version.status_code, invalid.status_code] == [422, 409, 422]
    assert reported == []


def test_the_answer_is_the_same_when_the_error_tracker_is_down():
    def failing(_):
        raise ConnectionError("PostHog is unreachable")

    client = client_for(BrokenSynthesiser(), failing)

    response = client.post("/render", json=render_body())

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"


def test_without_a_reporter_an_unexpected_exception_is_still_a_500():
    client = client_for(BrokenSynthesiser(), None)

    assert client.post("/render", json=render_body()).status_code == 500
