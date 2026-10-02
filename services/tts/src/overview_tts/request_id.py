import re
import uuid
from contextvars import ContextVar

REQUEST_ID_HEADER = "x-request-id"
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,64}$")

current_request_id: ContextVar[str | None] = ContextVar("current_request_id", default=None)


# The id the API sent with its call, so the API's lines for a render and this service's can
# be found by one id; a missing or malformed one is replaced, as the API's own is
# (docs/architecture/errors-and-logs.md, "The TTS service").
def request_id_for(sent: str | None) -> str:
    return sent if sent is not None and REQUEST_ID_PATTERN.match(sent) else str(uuid.uuid4())
