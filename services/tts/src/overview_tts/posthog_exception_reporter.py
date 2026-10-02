import json
import traceback
import urllib.request
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from .redact_error_message import redact_error_message

MAX_ERROR_FRAMES = 30
TIMEOUT_SECONDS = 5

ExceptionReporter = Callable[[BaseException], None]
Post = Callable[[str, bytes], None]

def _post(url: str, body: bytes) -> None:
    request = urllib.request.Request(url, data=body, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        response.read()


def _frames(error: BaseException, root: Path) -> list[dict]:
    frames = []
    for frame in traceback.extract_tb(error.__traceback__)[-MAX_ERROR_FRAMES:]:
        path = Path(frame.filename)
        ours = path.is_relative_to(root)
        frames.append(
            {
                "platform": "python",
                "filename": str(path.relative_to(root)) if ours else str(path),
                "function": frame.name,
                "lineno": frame.lineno,
                "in_app": ours and "site-packages" not in path.parts,
            }
        )
    return frames


def exception_event(error: BaseException, environment: str, at: datetime, root: Path) -> dict:
    return {
        "event": "$exception",
        "distinct_id": str(uuid.uuid4()),
        "timestamp": at.isoformat().replace("+00:00", "Z"),
        "properties": {
            "$exception_list": [
                {
                    "type": type(error).__name__,
                    "value": redact_error_message(str(error)),
                    "mechanism": {"handled": False, "synthetic": False, "type": "request"},
                    "stacktrace": {"type": "raw", "frames": _frames(error, root)},
                }
            ],
            "error_source": "tts",
            "surface": "tts",
            "environment": environment,
            "$process_person_profile": False,
            "$geoip_disable": True,
        },
    }


# PostHog's error tracking, fed as the API feeds it: one $exception over the batch call, no
# SDK, and a failure to send is the caller's to log (docs/architecture/errors-and-logs.md,
# "The TTS service").
def create_posthog_exception_reporter(
    api_key: str,
    host: str,
    environment: str,
    post: Post = _post,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    root: Path | None = None,
) -> ExceptionReporter:
    url = f"{host.rstrip('/')}/batch/"
    base = root if root is not None else Path.cwd()

    def report(error: BaseException) -> None:
        body = {"api_key": api_key, "batch": [exception_event(error, environment, now(), base)]}
        post(url, json.dumps(body).encode("utf-8"))

    return report
