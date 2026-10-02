import json
import logging

from .redact_error_message import redact_error_message
from .request_id import current_request_id

PINO_LEVELS = {logging.DEBUG: 20, logging.INFO: 30, logging.WARNING: 40, logging.ERROR: 50, logging.CRITICAL: 60}

_RECORD_OWN_FIELDS = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "taskName", "color_message"}


# One line per record in pino's shape, so a line from here reads like one from the API and
# ships the same way: level as pino's number, time in milliseconds, the message as msg, and
# whatever was passed as `extra` beside them (docs/architecture/errors-and-logs.md).
class JsonLogFormatter(logging.Formatter):
    def __init__(self, service: str = "overview-tts"):
        super().__init__()
        self._service = service

    def line(self, record: logging.LogRecord) -> dict:
        line = {
            "level": PINO_LEVELS.get(record.levelno, 30),
            "time": int(record.created * 1000),
            "service": self._service,
            "msg": record.getMessage(),
        }
        request_id = current_request_id.get()
        if request_id is not None:
            line["reqId"] = request_id
        for key, value in vars(record).items():
            if key not in _RECORD_OWN_FIELDS and not key.startswith("_"):
                line[key] = value
        if record.exc_info is not None and record.exc_info[1] is not None:
            error = record.exc_info[1]
            line["err"] = {"type": type(error).__name__, "message": redact_error_message(str(error))}
        return line

    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(self.line(record), default=str)
