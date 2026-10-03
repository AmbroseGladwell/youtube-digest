import json
import logging

import pytest
from fastapi.testclient import TestClient

from fake_synthesiser import FakeSchedule, FakeSynthesiser
from overview_tts.create_app import create_app
from overview_tts.idle_exit import IdleExit
from overview_tts.json_log_formatter import JsonLogFormatter
from overview_tts.render_script import RENDER_VERSION

SPOKEN = "A line only this note says"
SENT_REQUEST_ID = "5f0c2a9e-0000-4000-8000-render000001"


class Recording(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines: list[dict] = []
        self._formatter = JsonLogFormatter()

    def emit(self, record):
        self.lines.append(self._formatter.line(record))

    def saying(self, msg):
        return [line for line in self.lines if line["msg"] == msg]


@pytest.fixture
def logged():
    recording = Recording()
    root = logging.getLogger()
    previous = root.level
    root.addHandler(recording)
    root.setLevel(logging.INFO)
    yield recording
    root.removeHandler(recording)
    root.setLevel(previous)


class BrokenSynthesiser(FakeSynthesiser):
    def speak(self, text, voice, language):
        raise RuntimeError(f"phonemiser failed on '{text}'")


def client_for(synthesiser=None):
    app = create_app(synthesiser or FakeSynthesiser(), IdleExit(15, lambda: None, FakeSchedule()))
    return TestClient(app, raise_server_exceptions=False)


def render(client, **overrides):
    body = {"lines": ["Verdict", SPOKEN], "voice": "af_heart", "language": "en-us", "renderVersion": RENDER_VERSION, **overrides}
    return client.post("/render", json=body, headers={"x-request-id": SENT_REQUEST_ID})


def test_a_render_is_logged_as_requested_then_finished_under_the_apis_request_id_and_never_with_its_words(logged):
    response = render(client_for())

    assert response.headers["x-request-id"] == SENT_REQUEST_ID
    [requested] = logged.saying("render requested")
    [finished] = logged.saying("render finished")
    assert {key: requested[key] for key in ("level", "reqId", "voice", "lines", "characters", "renderVersion")} == {
        "level": 30,
        "reqId": SENT_REQUEST_ID,
        "voice": "af_heart",
        "lines": 2,
        "characters": len("Verdict") + len(SPOKEN),
        "renderVersion": RENDER_VERSION,
    }
    assert finished["reqId"] == SENT_REQUEST_ID
    assert finished["bytes"] > 0
    assert finished["audioSeconds"] > 0
    assert "synthesisSeconds" in finished
    assert SPOKEN not in json.dumps(logged.lines)


def test_a_refused_render_is_a_warn_with_its_code(logged):
    render(client_for(), voice="xx_nobody")
    render(client_for(), renderVersion=RENDER_VERSION + 1)

    assert [(line["level"], line["code"]) for line in logged.saying("render refused")] == [
        (40, "unknown_voice"),
        (40, "render_version_mismatch"),
    ]


def test_an_unexpected_failure_is_an_error_whose_message_never_quotes_the_script(logged):
    render(client_for(BrokenSynthesiser()))

    [unhandled] = logged.saying("unhandled error")
    assert unhandled["level"] == 50
    assert unhandled["reqId"] == SENT_REQUEST_ID
    assert unhandled["err"]["type"] == "RuntimeError"
    assert SPOKEN not in json.dumps(logged.lines)


def test_a_request_id_that_is_not_one_is_replaced_rather_than_logged(logged):
    client = client_for()

    response = client.post(
        "/render",
        json={"lines": ["Verdict"], "voice": "af_heart", "language": "en-us", "renderVersion": RENDER_VERSION},
        headers={"x-request-id": "reader@example.com"},
    )

    [requested] = logged.saying("render requested")
    assert requested["reqId"] == response.headers["x-request-id"]
    assert "reader@example.com" not in json.dumps(logged.lines)
