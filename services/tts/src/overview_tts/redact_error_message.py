import re

MAX_ERROR_MESSAGE_LENGTH = 200

URL_PATTERN = re.compile(r"\b(?:[a-z][a-z0-9+.-]*://|www\.)\S+", re.IGNORECASE | re.ASCII)
EMAIL_PATTERN = re.compile(r"\b[^\s@<>\"'`]+@[^\s@<>\"'`]+\.[a-z]{2,}\b", re.IGNORECASE | re.ASCII)
QUOTED_PATTERN = re.compile(r"\"([^\"]*)\"|'([^']*)'|`([^`]*)`|“([^”]*)”|‘([^’]*)’")
IDENTIFIER = re.compile(r"^[A-Za-z_$][\w$]{0,39}$", re.ASCII)
ID_LIKE_PATTERN = re.compile(
    r"\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{8,}\b|\b\d{6,}\b", re.ASCII
)


def _quoted(match: re.Match) -> str:
    inner = next((group for group in match.groups() if group is not None), "")
    return match.group(0) if IDENTIFIER.match(inner) else "<text>"


# packages/domain's redactErrorMessage, ported: a spoken line is a reader's own words, and an
# exception can quote one (docs/architecture/errors-and-logs.md, "What an error may carry").
def redact_error_message(message: str) -> str:
    redacted = URL_PATTERN.sub("<url>", message)
    redacted = EMAIL_PATTERN.sub("<email>", redacted)
    redacted = QUOTED_PATTERN.sub(_quoted, redacted)
    redacted = ID_LIKE_PATTERN.sub("<id>", redacted)
    redacted = re.sub(r"\s+", " ", redacted).strip()
    if len(redacted) > MAX_ERROR_MESSAGE_LENGTH:
        return redacted[: MAX_ERROR_MESSAGE_LENGTH - 1] + "…"
    return redacted
