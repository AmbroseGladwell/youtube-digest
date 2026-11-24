export const MAX_ERROR_MESSAGE_LENGTH = 200;

const URL_PATTERN = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+/gi;
export const EMAIL_PATTERN = /\b[^\s@<>"'`]+@[^\s@<>"'`]+\.[a-z]{2,}\b/gi;
const QUOTED_PATTERN = /"([^"]*)"|'([^']*)'|`([^`]*)`|“([^”]*)”|‘([^’]*)’/g;
const IDENTIFIER = /^[A-Za-z_$][\w$]{0,39}$/;
const ID_LIKE_PATTERN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{8,}\b|\b\d{6,}\b/g;

// docs/architecture/errors-and-logs.md, "What an error may carry".
export const redactErrorMessage = (message: string): string => {
  const redacted = message
    .replace(URL_PATTERN, "<url>")
    .replace(EMAIL_PATTERN, "<email>")
    .replace(QUOTED_PATTERN, (quoted, ...groups: Array<string | undefined>) => {
      const inner = groups.slice(0, 5).find((group) => group !== undefined) ?? "";
      return IDENTIFIER.test(inner) ? quoted : "<text>";
    })
    .replace(ID_LIKE_PATTERN, "<id>")
    .replace(/\s+/g, " ")
    .trim();
  return redacted.length > MAX_ERROR_MESSAGE_LENGTH ? `${redacted.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…` : redacted;
};
