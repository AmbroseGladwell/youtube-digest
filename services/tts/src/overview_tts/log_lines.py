import logging
from dataclasses import dataclass
from typing import Any


# Every line the service writes, coded `service.area.event` the way the API's are
# (docs/architecture/errors-and-logs.md, "Logging codes"). The code is what a PostHog filter
# matches; the message is prose and may be reworded without breaking it.
@dataclass(frozen=True)
class LogLine:
    log_code: str
    level: int
    message: str
    description: str

    def write(self, logger: logging.Logger, exc_info: BaseException | None = None, **fields: Any) -> None:
        logger.log(self.level, self.message, exc_info=exc_info, extra={"logCode": self.log_code, **fields})


RENDER_REQUESTED = LogLine(
    "tts.render.requested", logging.INFO, "render requested", "A script arrived to be spoken, by voice, language and length."
)
RENDER_FINISHED = LogLine(
    "tts.render.finished", logging.INFO, "render finished", "The script was spoken and encoded, with how long it took and its size."
)
RENDER_REFUSED = LogLine(
    "tts.render.refused", logging.WARNING, "render refused", "A request was turned away; `code` says whether it was the voice, the version or the shape."
)
HTTP_UNHANDLED_ERROR = LogLine(
    "tts.http.unhandledError", logging.ERROR, "unhandled error", "A failure nothing planned for, answered as a 500 and reported."
)
MODEL_LOADED = LogLine(
    "tts.model.loaded", logging.INFO, "model loaded", "Kokoro finished loading and the machine can now render."
)
MODEL_FAILED_TO_LOAD = LogLine(
    "tts.model.failedToLoad", logging.ERROR, "model failed to load", "Kokoro could not be loaded, so every render on this machine will fail."
)
SERVICE_LOG_SHIPPING = LogLine(
    "tts.service.logShipping", logging.INFO, "log shipping", "Where these logs are shipped, or that they go to stdout only."
)
SERVICE_IDLE_STOPPING = LogLine(
    "tts.service.idleStopping", logging.INFO, "idle, stopping", "Nothing arrived within the idle grace after the model was ready, so the machine is shutting down."
)
ERRORS_NOT_FORWARDED = LogLine(
    "tts.errors.notForwarded", logging.WARNING, "error not forwarded", "An error could not be passed on to error tracking."
)
LOGS_NOT_SHIPPED = LogLine(
    "tts.logs.notShipped", logging.WARNING, "logs not shipped", "A batch of log records was refused by the destination and dropped."
)
LOGS_RECORDS_DROPPED = LogLine(
    "tts.logs.recordsDropped", logging.WARNING, "log records dropped", "The handler's own buffer overflowed or a batch was refused."
)

ALL_LOG_LINES: tuple[LogLine, ...] = tuple(
    value for name, value in sorted(dict(globals()).items()) if isinstance(value, LogLine)
)

# A line from a library we do not own cannot declare a code, so the formatter gives it one
# by the library's name, and `tts.thirdParty.*` is one clause to filter out.
THIRD_PARTY_PREFIX = "tts.thirdParty"
OUR_LOGGER_ROOT = "overview_tts"


def third_party_code(logger_name: str) -> str:
    library = (logger_name or "root").split(".")[0]
    head, *rest = library.replace("-", "_").split("_")
    return f"{THIRD_PARTY_PREFIX}.{head}{''.join(part.title() for part in rest)}"
