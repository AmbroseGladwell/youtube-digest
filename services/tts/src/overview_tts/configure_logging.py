import logging
import sys
from collections.abc import Mapping
from urllib.parse import urlparse

from . import log_lines
from .json_log_formatter import JsonLogFormatter
from .otlp_log_handler import OtlpLogHandler
from .otlp_logs_config import otlp_logs_config

DEMOTED_TO_DEBUG_BELOW = {"phonemizer": logging.ERROR, "kokoro_onnx": logging.ERROR, "uvicorn.error": logging.WARNING}


def demote_to_debug_below(level: int):
    def demote(record: logging.LogRecord) -> bool:
        if record.levelno >= level:
            return True
        record.levelno, record.levelname = logging.DEBUG, "DEBUG"
        return logging.getLogger().isEnabledFor(logging.DEBUG)

    return demote


# Every line as JSON on stdout, and shipped as the API's are when a destination is named.
# uvicorn's access log is off: it names the caller's address, which no line may carry
# (docs/architecture/errors-and-logs.md, "What a log line may carry"). Library chatter is
# demoted to debug (same doc, "Library chatter is demoted").
def configure_logging(env: Mapping[str, str]) -> OtlpLogHandler | None:
    stdout = logging.StreamHandler(sys.stdout)
    stdout.setFormatter(JsonLogFormatter())
    root = logging.getLogger()
    root.handlers = [stdout]
    root.setLevel(logging.INFO)

    config = otlp_logs_config(
        env,
        env.get("POSTHOG_API_KEY"),
        env.get("POSTHOG_HOST", "https://eu.i.posthog.com"),
        env.get("ANALYTICS_ENVIRONMENT", "development"),
    )
    shipping = None if config is None else OtlpLogHandler(config)
    if shipping is not None:
        root.addHandler(shipping)

    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
    logging.getLogger("uvicorn.access").disabled = True
    for name, level in DEMOTED_TO_DEBUG_BELOW.items():
        logging.getLogger(name).filters = [demote_to_debug_below(level)]
    origin = None if config is None else f"{urlparse(config.endpoint).scheme}://{urlparse(config.endpoint).netloc}"
    log_lines.SERVICE_LOG_SHIPPING.write(logging.getLogger(__name__), endpoint=origin)
    return shipping
