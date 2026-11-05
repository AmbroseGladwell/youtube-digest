import { isSyncRequestError, isSyncTransportError } from "@overview/sync";

export type CodeProblemKind = "wrong" | "expired" | "limited" | "other";

export interface CodeProblem {
  kind: CodeProblemKind;
  message: string;
}

const UNREACHABLE = "Couldn’t reach the server. Check your connection and try again.";
const SERVER = "The server had a problem. Try again in a moment.";

const pad = (n: number): string => String(n).padStart(2, "0");

// Design 14c/14i: the hour's limit is said as a clock time to try again, in the reader's
// own zone, since the server only knows the seconds (docs/features/account-changes.md).
export function limitedCodesMessage(retryAfterSeconds: number, limit: number, now: Date): string {
  const at = new Date(now.getTime() + Math.max(0, retryAfterSeconds) * 1000);
  return `You’ve asked for ${limit} codes in the last hour. Try again after ${pad(at.getHours())}:${pad(at.getMinutes())}.`;
}

const retryAfter = (details: Record<string, unknown> | undefined): number =>
  typeof details?.retryAfterSeconds === "number" ? details.retryAfterSeconds : 0;

// The server answers one `link_invalid` for a wrong, spent or expired code; which it was
// is told from the ask's own expiry, which this device knows.
export function codeProblem(error: unknown, expiresAt: string | null, now: Date): CodeProblem {
  if (isSyncTransportError(error)) return { kind: "other", message: UNREACHABLE };
  if (isSyncRequestError(error)) {
    switch (error.code) {
      case "link_invalid":
        return expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime()
          ? { kind: "expired", message: "That code has expired. Send a new one, then enter it within 15 minutes." }
          : { kind: "wrong", message: "That code doesn’t match. Check it against the latest email, or send a new code." };
      case "too_many_requests":
        return { kind: "limited", message: limitedCodesMessage(retryAfter(error.details), 5, now) };
      default:
        return { kind: "other", message: SERVER };
    }
  }
  return { kind: "other", message: "Something went wrong. Try again." };
}

export type AskProblemKind = "limited" | "invalid" | "other";

export interface AskProblem {
  kind: AskProblemKind;
  message: string;
}

export function askProblem(error: unknown, now: Date): AskProblem {
  if (isSyncTransportError(error)) return { kind: "other", message: UNREACHABLE };
  if (isSyncRequestError(error)) {
    switch (error.code) {
      case "too_many_requests":
        return { kind: "limited", message: limitedCodesMessage(retryAfter(error.details), 5, now) };
      case "invalid_request":
        return { kind: "invalid", message: "That doesn’t look like a full email address." };
      default:
        return { kind: "other", message: SERVER };
    }
  }
  return { kind: "other", message: "Something went wrong. Try again." };
}
