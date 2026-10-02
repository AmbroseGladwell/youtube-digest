import json
import logging

from overview_tts.otlp_log_handler import OtlpLogHandler
from overview_tts.otlp_logs_config import OtlpLogsConfig
from overview_tts.request_id import current_request_id

CONFIG = OtlpLogsConfig(
    endpoint="https://logs.example/i/v1/logs",
    headers={"authorization": "Bearer project-token"},
    resource={"service.name": "overview-tts", "deployment.environment.name": "test"},
)


class Destination:
    def __init__(self):
        self.posts: list[dict] = []
        self.failing = False

    def __call__(self, endpoint, headers, body):
        if self.failing:
            raise OSError("the log destination answered 503")
        self.posts.append({"endpoint": endpoint, "headers": headers, "body": json.loads(body)})

    def records(self, post=-1):
        return self.posts[post]["body"]["resourceLogs"][0]["scopeLogs"][0]["logRecords"]


def handler_to(destination, **options):
    return OtlpLogHandler(CONFIG, post=destination, now_ms=lambda: 1_000, run_timer=False, on_failure=lambda _: None, **options)


def logger_with(handler):
    logger = logging.getLogger(f"test.otlp.{id(handler)}")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)
    return logger


def attributes(record):
    return {attribute["key"]: next(iter(attribute["value"].values())) for attribute in record["attributes"]}


def test_lines_are_held_then_posted_as_otlp_records_with_their_fields_as_attributes():
    destination = Destination()
    handler = handler_to(destination)
    token = current_request_id.set("request-0001")
    try:
        logger_with(handler).warning("render refused", extra={"code": "unknown_voice", "status": 422})
    finally:
        current_request_id.reset(token)

    assert destination.posts == []
    handler.flush()

    [record] = destination.records()
    assert destination.posts[0]["endpoint"] == CONFIG.endpoint
    assert destination.posts[0]["headers"] == CONFIG.headers
    assert (record["severityText"], record["body"]) == ("WARN", {"stringValue": "render refused"})
    assert attributes(record) == {"service": "overview-tts", "reqId": "request-0001", "code": "unknown_voice", "status": "422"}


def test_a_batch_the_destination_refuses_is_counted_and_said_in_the_next_one_that_gets_through():
    destination = Destination()
    handler = handler_to(destination)
    logger = logger_with(handler)
    destination.failing = True
    logger.info("render requested")
    logger.info("render finished")
    handler.flush()

    destination.failing = False
    logger.info("idle, stopping")
    handler.close()

    records = destination.records()
    assert records[0]["body"] == {"stringValue": "log records dropped"}
    assert attributes(records[0]) == {"dropped": "2"}
    assert [record["body"]["stringValue"] for record in records[1:]] == ["idle, stopping"]


def test_past_the_most_it_holds_new_lines_are_dropped_and_counted():
    destination = Destination()
    handler = handler_to(destination, max_held_records=2, max_batch_records=10)
    logger = logger_with(handler)

    for _ in range(3):
        logger.info("render requested")
    handler.flush()

    assert [record["body"]["stringValue"] for record in destination.records()] == [
        "log records dropped",
        "render requested",
        "render requested",
    ]
