import logging
import sys
from collections.abc import Mapping
from urllib.parse import urlparse

from .json_log_formatter import JsonLogFormatter
from .otlp_log_handler import OtlpLogHandler
from .otlp_logs_config import otlp_logs_config


# Every line as JSON on stdout, and shipped as the API's are when a destination is named.
# uvicorn's access log is off: it names the caller's address, which no line may carry
# (docs/architecture/errors-and-logs.md, "What a log line may carry").
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
    origin = None if config is None else f"{urlparse(config.endpoint).scheme}://{urlparse(config.endpoint).netloc}"
    logging.getLogger(__name__).info("log shipping", extra={"endpoint": origin})
    return shipping
