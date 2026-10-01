import { describe, expect, it } from "vitest";
import { SyncRequestError, SyncTransportError } from "@overview/sync";
import { toClientError } from "./toClientError.js";

const AT = new Date("2026-10-01T09:00:00.000Z");
const trail = [{ name: "mcp.consentScreen.shown", at: "2026-10-01T08:59:58.000Z" }];
const options = { source: "uncaught", handled: false, trail, at: AT } as const;

describe("toClientError", () => {
  it("strips the URLs and the reader's words out of an error's message and stack before it leaves the device", () => {
    const error = new Error(`Couldn't parse "My notes on the divorce" from https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
    error.stack = `Error: ${error.message}\n    at parse (https://overview.example/assets/index-Bx3k9.js?v=dQw4w9WgXcQ:1:20)`;

    const report = toClientError(error, options);

    expect(report.message).toBe("Couldn't parse <text> from <url>");
    expect(report.frames).toEqual([{ function: "parse", file: "assets/index-Bx3k9.js", line: 1, column: 20 }]);
    expect(JSON.stringify(report)).not.toMatch(/divorce|youtube|dQw4w9WgXcQ|overview\.example/);
  });

  it("names a refused call by the id it was sent with, its code and its status", () => {
    const refused = new SyncRequestError("revision_mismatch", 412, "Stale", undefined, "request-1234");

    expect(toClientError(refused, { ...options, source: "failedRequest", handled: true })).toMatchObject({
      type: "SyncRequestError",
      requestId: "request-1234",
      apiErrorCode: "revision_mismatch",
      status: 412,
      trail,
    });
  });

  it("names a call that never got an answer by the id it was sent with", () => {
    const unreachable = new SyncTransportError("The sync server could not be reached", { requestId: "request-5678" });

    const report = toClientError(unreachable, options);

    expect(report.requestId).toBe("request-5678");
    expect(report).not.toHaveProperty("apiErrorCode");
  });

  it("reports something thrown that isn't an Error without guessing a class for it", () => {
    expect(toClientError("reader@example.com went wrong", options)).toMatchObject({ type: "NonError", message: "<email> went wrong", frames: [] });
    expect(toClientError({ note: "private" }, options)).toMatchObject({ type: "NonError", message: "" });
  });

  it("calls an error whose name isn't a class name just an Error", () => {
    const error = new Error("boom");
    error.name = "My private title";

    expect(toClientError(error, options).type).toBe("Error");
  });
});
