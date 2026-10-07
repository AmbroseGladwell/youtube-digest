import logging
import re

import pytest
from fastapi.testclient import TestClient

from fake_synthesiser import FakeSchedule, FakeSynthesiser
from overview_tts import log_lines
from overview_tts.create_app import create_app
from overview_tts.idle_exit import IdleExit
from overview_tts.json_log_formatter import JsonLogFormatter
from overview_tts.render_script import RENDER_VERSION

CODE = re.compile(r"^tts\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$")


def camel(name: str) -> str:
    head, *rest = name.lower().split("_")
    return head + "".join(part.title() for part in rest)


@pytest.mark.parametrize("line", log_lines.ALL_LOG_LINES, ids=lambda line: line.log_code)
def test_a_line_is_coded_service_area_event_and_says_what_it_means(line):
    assert CODE.match(line.log_code), line.log_code
    assert len(line.description) > 20, line.log_code
    assert re.match(r"^[a-z][a-z0-9 ,'-]*$", line.message), line.message


def test_a_code_is_the_constants_own_name_so_the_two_cannot_drift():
    for name, value in vars(log_lines).items():
        if isinstance(value, log_lines.LogLine):
            area, _, event = name.partition("_")
            assert value.log_code == f"tts.{area.lower()}.{camel(event)}", name


def test_no_two_lines_share_a_code():
    codes = [line.log_code for line in log_lines.ALL_LOG_LINES]
    assert sorted(set(codes)) == sorted(codes)


def test_writing_a_line_carries_its_code_and_message_at_its_own_level(caplog):
    with caplog.at_level(logging.INFO):
        log_lines.MODEL_LOADED.write(logging.getLogger("overview_tts.test"), loadSeconds=1.5)

    [record] = caplog.records
    assert (record.levelno, record.getMessage()) == (logging.INFO, "model loaded")
    assert (record.logCode, record.loadSeconds) == ("tts.model.loaded", 1.5)


def test_a_library_we_do_not_own_is_coded_by_its_name_so_nothing_reaches_posthog_uncoded():
    formatter = JsonLogFormatter()
    kokoro = logging.LogRecord("kokoro_onnx.tokenizer", logging.WARNING, "", 0, "words count mismatch", None, None)
    uvicorn = logging.LogRecord("uvicorn.error", logging.INFO, "", 0, "Application startup complete.", None, None)

    assert formatter.line(kokoro)["logCode"] == "tts.thirdParty.kokoroOnnx"
    assert formatter.line(uvicorn)["logCode"] == "tts.thirdParty.uvicorn"


def test_every_line_a_render_writes_carries_a_code_from_the_catalogue():
    known = {line.log_code for line in log_lines.ALL_LOG_LINES}
    formatter = JsonLogFormatter()
    written: list[dict] = []

    class Recording(logging.Handler):
        def emit(self, record):
            written.append(formatter.line(record))

    recording = Recording()
    root = logging.getLogger()
    root.addHandler(recording)
    root.setLevel(logging.INFO)
    try:
        client = TestClient(create_app(FakeSynthesiser(), IdleExit(15, lambda: None, FakeSchedule())), raise_server_exceptions=False)
        client.post("/render", json={"lines": ["Verdict"], "voice": "af_heart", "language": "en-us", "renderVersion": RENDER_VERSION})
        client.post("/render", json={"lines": ["Verdict"], "voice": "nobody", "language": "en-us", "renderVersion": RENDER_VERSION})
    finally:
        root.removeHandler(recording)

    assert written
    for line in written:
        code = line["logCode"]
        assert code.startswith(f"{log_lines.THIRD_PARTY_PREFIX}.") or code in known, line["msg"]
    assert {line["logCode"] for line in written} >= {"tts.render.requested", "tts.render.finished", "tts.render.refused"}
