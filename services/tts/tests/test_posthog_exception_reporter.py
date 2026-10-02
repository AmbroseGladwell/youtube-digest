import json
from datetime import UTC, datetime
from pathlib import Path

from overview_tts.posthog_exception_reporter import create_posthog_exception_reporter

AT = datetime(2026, 10, 2, 9, 0, tzinfo=UTC)
ROOT = Path(__file__).resolve().parent.parent


def raised(error):
    try:
        raise error
    except Exception as caught:
        return caught


def reporting():
    sent = []
    report = create_posthog_exception_reporter(
        "phc_test",
        "https://eu.i.posthog.com/",
        "production",
        post=lambda url, body: sent.append((url, json.loads(body))),
        now=lambda: AT,
        root=ROOT,
    )
    return report, sent


def test_an_exception_goes_to_posthogs_error_tracking_from_tts_under_no_person():
    report, sent = reporting()

    report(raised(RuntimeError("phonemiser failed")))

    url, body = sent[0]
    assert url == "https://eu.i.posthog.com/batch/"
    assert body["api_key"] == "phc_test"
    [event] = body["batch"]
    assert event["event"] == "$exception"
    assert event["timestamp"] == "2026-10-02T09:00:00Z"
    properties = event["properties"]
    assert properties["error_source"] == "tts"
    assert properties["surface"] == "tts"
    assert properties["environment"] == "production"
    assert properties["$process_person_profile"] is False
    assert properties["$geoip_disable"] is True
    [exception] = properties["$exception_list"]
    assert exception["type"] == "RuntimeError"
    assert exception["value"] == "phonemiser failed"
    assert exception["mechanism"] == {"handled": False, "synthetic": False, "type": "request"}


def test_its_frames_are_paths_inside_the_service_with_the_one_that_raised_last():
    report, sent = reporting()

    report(raised(ValueError("bad")))

    frames = sent[0][1]["batch"][0]["properties"]["$exception_list"][0]["stacktrace"]["frames"]
    assert frames[-1] == {
        "platform": "python",
        "filename": "tests/test_posthog_exception_reporter.py",
        "function": "raised",
        "lineno": frames[-1]["lineno"],
        "in_app": True,
    }


def test_a_spoken_line_quoted_in_the_message_never_leaves_the_service():
    report, sent = reporting()

    report(raised(RuntimeError("phonemiser failed on 'My private note about rice'")))

    assert sent[0][1]["batch"][0]["properties"]["$exception_list"][0]["value"] == "phonemiser failed on <text>"


def test_each_exception_goes_under_an_id_of_its_own():
    report, sent = reporting()

    report(raised(RuntimeError("one")))
    report(raised(RuntimeError("two")))

    assert sent[0][1]["batch"][0]["distinct_id"] != sent[1][1]["batch"][0]["distinct_id"]
