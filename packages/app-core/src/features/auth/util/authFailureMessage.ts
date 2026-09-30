import { isSyncRequestError, isSyncTransportError } from "@overview/sync";

export const LINK_SPENT = "This link has expired or was already used.";
export const CODE_SPENT = "That code is wrong, has expired, or was already used.";

// The one line a sign-in form says when the server said no. What a spent link or code
// means differs by which was sent, so the caller names it (docs/features/sign-in.md).
export function authFailureMessage(error: unknown, whenSpent: string): string {
  if (isSyncTransportError(error)) {
    return "Couldn't reach the server. Check the address and try again.";
  }
  if (isSyncRequestError(error)) {
    switch (error.code) {
      case "link_invalid":
        return whenSpent;
      case "invalid_request":
        return "That doesn't look like a full email address.";
      case "too_many_requests":
        return `Too many tries. Try again ${waitFrom(error.details)}.`;
      default:
        return "The server had a problem. Try again in a moment.";
    }
  }
  return "Something went wrong. Try again.";
}

function waitFrom(details: Record<string, unknown> | undefined): string {
  const seconds = details?.retryAfterSeconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return "later";
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "in a minute" : `in ${minutes} minutes`;
}
