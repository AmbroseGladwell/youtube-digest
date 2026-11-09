import { describe, expect, it } from "vitest";
import { SyncRequestError, SyncTransportError } from "@overview/sync";
import { askProblem, codeProblem, limitedCodesMessage } from "./accountChangeProblem.js";

const NOW = new Date("2026-11-05T14:32:00");
const refused = (code: "link_invalid" | "too_many_requests" | "invalid_request" | "internal_error", details?: Record<string, unknown>) =>
  new SyncRequestError(code, 400, "refused", details, "req");

describe("codeProblem", () => {
  it("reads a refused code as wrong while the ask is live, and as expired once its time has passed", () => {
    expect(codeProblem(refused("link_invalid"), "2026-11-05T14:47:00", NOW).kind).toBe("wrong");
    expect(codeProblem(refused("link_invalid"), "2026-11-05T14:31:00", NOW)).toEqual({
      kind: "expired",
      message: "That code has expired. Send a new one, then enter it within 15 minutes.",
    });
    expect(codeProblem(refused("link_invalid"), null, NOW).kind).toBe("wrong");
  });

  it("says the hour's limit as a clock time to try again", () => {
    expect(codeProblem(refused("too_many_requests", { retryAfterSeconds: 4080 }), null, NOW)).toEqual({
      kind: "limited",
      message: "You’ve asked for 5 codes in the last hour. Try again after 15:40.",
    });
    expect(limitedCodesMessage(0, 5, NOW)).toContain("after 14:32.");
  });

  it("tells an unreachable server from one that had a problem", () => {
    expect(codeProblem(new SyncTransportError("down"), null, NOW).message).toMatch(/^Couldn’t reach the server/);
    expect(codeProblem(refused("internal_error"), null, NOW).kind).toBe("other");
  });
});

describe("askProblem", () => {
  it("maps the server's refusals to the field's own words", () => {
    expect(askProblem(refused("invalid_request"), NOW)).toEqual({
      kind: "invalid",
      message: "That doesn’t look like a full email address.",
    });
    expect(askProblem(refused("too_many_requests", { retryAfterSeconds: 60 }), NOW).kind).toBe("limited");
    expect(askProblem(new Error("x"), NOW).kind).toBe("other");
  });
});
