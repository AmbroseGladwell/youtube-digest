import json
import logging
import sys
import threading
import time
import urllib.request
from collections.abc import Callable

from .json_log_formatter import JsonLogFormatter
from .otlp_logs_config import OtlpLogsConfig

SCOPE = {"name": "overview-tts"}
LINE_OWN_FIELDS = {"level", "time", "msg"}
SEVERITIES = [(60, 21, "FATAL"), (50, 17, "ERROR"), (40, 13, "WARN"), (30, 9, "INFO"), (20, 5, "DEBUG"), (0, 1, "TRACE")]

Post = Callable[[str, dict[str, str], bytes], None]


def _post(endpoint: str, headers: dict[str, str], body: bytes) -> None:
    request = urllib.request.Request(endpoint, data=body, headers={**headers, "content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()


def otlp_value(value) -> dict:
    if isinstance(value, bool):
        return {"boolValue": value}
    if isinstance(value, int):
        return {"intValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    return {"stringValue": value if isinstance(value, str) else json.dumps(value, default=str)}


def _flatten(prefix: str, value, into: list[dict]) -> None:
    if value is None:
        return
    if isinstance(value, dict):
        for key, inner in value.items():
            _flatten(f"{prefix}.{key}", inner, into)
    else:
        into.append({"key": prefix, "value": otlp_value(value)})


def otlp_log_record(line: dict, observed_ms: int) -> dict:
    level = line.get("level", 30)
    _, severity_number, severity_text = next(entry for entry in SEVERITIES if level >= entry[0])
    attributes: list[dict] = []
    for key, value in line.items():
        if key not in LINE_OWN_FIELDS:
            _flatten(key, value, attributes)
    return {
        "timeUnixNano": str(line.get("time", observed_ms) * 1_000_000),
        "observedTimeUnixNano": str(observed_ms * 1_000_000),
        "severityNumber": severity_number,
        "severityText": severity_text,
        "body": {"stringValue": line.get("msg", "")},
        "attributes": attributes,
    }


# The API's OtlpLogExporter as a logging handler: records are held and posted as OTLP/HTTP
# JSON every two seconds or 500 records, a batch the destination refuses is dropped and
# counted, and close() ships what is left, which matters to a process that exits 15 seconds
# after its last render (docs/architecture/errors-and-logs.md, "The TTS service").
class OtlpLogHandler(logging.Handler):
    def __init__(
        self,
        config: OtlpLogsConfig,
        post: Post = _post,
        now_ms: Callable[[], int] = lambda: int(time.time() * 1000),
        flush_interval_seconds: float = 2.0,
        max_batch_records: int = 500,
        max_held_records: int = 5_000,
        on_failure: Callable[[str], None] = lambda message: sys.stderr.write(
            json.dumps({"level": 40, "time": int(time.time() * 1000), "msg": "logs not shipped", "error": message}) + "\n"
        ),
        run_timer: bool = True,
    ):
        super().__init__()
        self._config = config
        self._post = post
        self._now_ms = now_ms
        self._max_batch_records = max_batch_records
        self._max_held_records = max_held_records
        self._on_failure = on_failure
        self._formatter = JsonLogFormatter(config.resource.get("service.name", "overview-tts"))
        self._held: list[dict] = []
        self._dropped = 0
        self._lock = threading.Lock()
        self._sending = threading.Lock()
        self._stopped = threading.Event()
        if run_timer:
            threading.Thread(target=self._every, args=(flush_interval_seconds,), daemon=True).start()

    def emit(self, record: logging.LogRecord) -> None:
        line = self._formatter.line(record)
        with self._lock:
            if len(self._held) >= self._max_held_records:
                self._dropped += 1
                return
            self._held.append(otlp_log_record(line, self._now_ms()))
            full = len(self._held) >= self._max_batch_records
        if full:
            self.flush()

    def flush(self) -> None:
        with self._sending:
            while True:
                with self._lock:
                    if not self._held and self._dropped == 0:
                        return
                    records = self._held[: self._max_batch_records]
                    del self._held[: self._max_batch_records]
                    dropped, self._dropped = self._dropped, 0
                batch = records if dropped == 0 else [self._dropped_record(dropped), *records]
                try:
                    self._post(self._config.endpoint, self._config.headers, self._body(batch))
                except Exception as error:
                    with self._lock:
                        self._dropped += dropped + len(records)
                    self._on_failure(f"{type(error).__name__}: {error}")
                    return

    def close(self) -> None:
        self._stopped.set()
        self.flush()
        super().close()

    def _every(self, seconds: float) -> None:
        while not self._stopped.wait(seconds):
            self.flush()

    def _dropped_record(self, dropped: int) -> dict:
        at = str(self._now_ms() * 1_000_000)
        return {
            "timeUnixNano": at,
            "observedTimeUnixNano": at,
            "severityNumber": 13,
            "severityText": "WARN",
            "body": {"stringValue": "log records dropped"},
            "attributes": [{"key": "dropped", "value": otlp_value(dropped)}],
        }

    def _body(self, records: list[dict]) -> bytes:
        resource = [{"key": key, "value": otlp_value(value)} for key, value in self._config.resource.items()]
        return json.dumps(
            {"resourceLogs": [{"resource": {"attributes": resource}, "scopeLogs": [{"scope": SCOPE, "logRecords": records}]}]}
        ).encode("utf-8")
