import base64

import pytest
from fastapi.testclient import TestClient

from fake_synthesiser import FakeSchedule, FakeSynthesiser
from overview_tts.create_app import MAX_SCRIPT_CHARACTERS, create_app
from overview_tts.idle_exit import IdleExit
from overview_tts.render_script import RENDER_VERSION


@pytest.fixture
def service():
    schedule = FakeSchedule()
    stops = []
    app = create_app(FakeSynthesiser(), IdleExit(15, lambda: stops.append(True), schedule))
    return TestClient(app), schedule, stops


def render_body(**overrides):
    return {
        "lines": ["Verdict", "Recycled.", "Standard advice."],
        "voice": "af_heart",
        "language": "en-us",
        "renderVersion": RENDER_VERSION,
        **overrides,
    }


def test_a_render_returns_an_m4a_and_where_each_line_starts(service):
    client, _, _ = service

    response = client.post("/render", json=render_body())

    assert response.status_code == 200
    body = response.json()
    assert body["renderVersion"] == RENDER_VERSION
    assert len(body["lineStartsSeconds"]) == 3
    assert body["lineStartsSeconds"][0] == 0
    assert body["durationSeconds"] > body["lineStartsSeconds"][-1]
    assert base64.b64decode(body["audioBase64"])[4:8] == b"ftyp"


def test_a_render_for_another_render_version_is_refused(service):
    client, _, _ = service

    response = client.post("/render", json=render_body(renderVersion=RENDER_VERSION + 1))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "render_version_mismatch"


def test_a_voice_the_model_does_not_have_is_refused(service):
    client, _, _ = service

    response = client.post("/render", json=render_body(voice="xx_nobody"))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_voice"


@pytest.mark.parametrize(
    "overrides",
    [
        {"lines": []},
        {"lines": ["Verdict", "   "]},
        {"lines": ["a" * (MAX_SCRIPT_CHARACTERS + 1)]},
        {"language": "fr-fr"},
    ],
    ids=["no lines", "a blank line", "over the cap", "a language it does not speak"],
)
def test_a_malformed_render_is_refused(service, overrides):
    client, _, _ = service

    response = client.post("/render", json=render_body(**overrides))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_health_names_the_render_version_and_the_voices(service):
    client, _, _ = service

    assert client.get("/health").json() == {"renderVersion": RENDER_VERSION, "voices": ["af_heart", "bf_emma"]}


def test_a_health_check_does_not_keep_an_idle_machine_running(service):
    client, schedule, stops = service
    boot_timer = schedule.armed[0]

    client.get("/health")
    boot_timer.fire()

    assert stops == [True]


def test_a_render_restarts_the_idle_grace(service):
    client, schedule, stops = service
    boot_timer = schedule.armed[0]

    client.post("/render", json=render_body())

    assert boot_timer.cancelled
    assert len(schedule.armed) == 1
    assert stops == []
