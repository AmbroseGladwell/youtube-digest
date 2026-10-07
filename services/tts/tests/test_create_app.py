import base64
import threading

import pytest
from fastapi.testclient import TestClient

from fake_synthesiser import FakeSchedule, FakeSynthesiser
from overview_tts.create_app import MAX_SCRIPT_CHARACTERS, create_app
from overview_tts.idle_exit import IdleExit
from overview_tts.kokoro_synthesiser import LoadingSynthesiser
from overview_tts.render_script import RENDER_VERSION


@pytest.fixture
def service():
    schedule = FakeSchedule()
    stops = []
    idle_exit = IdleExit(15, lambda: stops.append(True), schedule)
    idle_exit.start()
    app = create_app(FakeSynthesiser(), idle_exit)
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
        {"lines": ["   ", ""]},
        {"lines": ["a" * (MAX_SCRIPT_CHARACTERS + 1)]},
        {"language": "fr-fr"},
    ],
    ids=["no lines", "only blank lines", "over the cap", "a language it does not speak"],
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


def test_a_request_that_arrives_while_the_model_loads_waits_for_it():
    release = threading.Event()

    def slow_load():
        release.wait()
        return FakeSynthesiser()

    app = create_app(LoadingSynthesiser(slow_load), IdleExit(15, lambda: None, FakeSchedule()))
    responses = []
    request = threading.Thread(target=lambda: responses.append(TestClient(app).post("/render", json=render_body())))
    request.start()
    request.join(timeout=0.2)

    assert responses == []
    release.set()
    request.join(timeout=5)
    assert responses[0].status_code == 200
    assert responses[0].json()["lineStartsSeconds"][1] == pytest.approx(0.47)


def test_a_model_that_fails_to_load_fails_the_request_rather_than_hanging_it():
    def broken_load():
        raise FileNotFoundError("kokoro-v1.0.onnx")

    app = create_app(LoadingSynthesiser(broken_load), IdleExit(15, lambda: None, FakeSchedule()))

    response = TestClient(app, raise_server_exceptions=False).post("/render", json=render_body())

    assert response.status_code == 500


def test_a_machine_slower_to_load_than_the_grace_still_serves_the_request_that_woke_it():
    release = threading.Event()
    schedule = FakeSchedule()
    stops = []

    def slow_load():
        release.wait()
        return FakeSynthesiser()

    idle_exit = IdleExit(15, lambda: stops.append(True), schedule)
    app = create_app(LoadingSynthesiser(slow_load, on_ready=idle_exit.start), idle_exit)
    responses = []
    request = threading.Thread(target=lambda: responses.append(TestClient(app).post("/render", json=render_body())))
    request.start()
    request.join(timeout=0.2)

    assert schedule.armed == []
    release.set()
    request.join(timeout=5)
    assert responses[0].status_code == 200
    assert [timer.delay for timer in schedule.armed] == [15]
    assert stops == []


def test_a_model_that_fails_to_load_still_lets_the_machine_stop():
    def broken_load():
        raise FileNotFoundError("kokoro-v1.0.onnx")

    ready = threading.Event()
    LoadingSynthesiser(broken_load, on_ready=ready.set)

    assert ready.wait(timeout=5)
