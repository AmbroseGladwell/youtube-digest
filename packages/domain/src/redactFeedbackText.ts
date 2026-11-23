import { EMAIL_PATTERN } from "./redactErrorMessage.js";

const KEY_LIKE_PATTERN = /(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}/g;

// Words, titles and links are what feedback is for: docs/features/feedback.md, "Redaction".
export const redactFeedbackText = (text: string): string =>
  text.replace(EMAIL_PATTERN, "<email>").replace(KEY_LIKE_PATTERN, "<key>").trim();
