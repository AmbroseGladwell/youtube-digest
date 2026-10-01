import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SyncRequestError, SyncTransportError } from "./SyncRequestError.js";
import { toClientError } from "./toClientError.js";

const AT = new Date("2026-10-01T09:00:00.000Z");
const trail = [{ name: "mcp.consentScreen.shown", at: "2026-10-01T08:59:58.000Z" }];
const options = { source: "uncaught", handled: false, trail, at: AT } as const;

describe("toClientError", () => {
  it("strips the URLs and the reader's words out of an error's message and stack before it leaves the device", () => {
    const error = new Error(`Couldn't parse "My notes on the divorce" from https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
    error.stack = `Error: ${error.message}\n    at parse (https://overview.example/assets/index-Bx3k9.js?v=dQw4w9WgXcQ:1:20)`;

    const report = toClientError(error, options);

    assert.equal(report.message, "Couldn't parse <text> from <url>");
    assert.deepEqual(report.frames, [{ function: "parse", file: "assets/index-Bx3k9.js", line: 1, column: 20 }]);
    assert.doesNotMatch(JSON.stringify(report), /divorce|youtube|dQw4w9WgXcQ|overview\.example/);
  });

  it("names a refused call by the id it was sent with, its code and its status", () => {
    const refused = new SyncRequestError("revision_mismatch", 412, "Stale", undefined, "request-1234");

    const report = toClientError(refused, { ...options, source: "failedRequest", handled: true });

    assert.equal(report.type, "SyncRequestError");
    assert.equal(report.requestId, "request-1234");
    assert.equal(report.apiErrorCode, "revision_mismatch");
    assert.equal(report.status, 412);
    assert.deepEqual(report.trail, trail);
  });

  it("names a call that never got an answer by the id it was sent with", () => {
    const unreachable = new SyncTransportError("The sync server could not be reached", { requestId: "request-5678" });

    const report = toClientError(unreachable, options);

    assert.equal(report.requestId, "request-5678");
    assert.ok(!("apiErrorCode" in report));
  });

  it("reports something thrown that isn't an Error without guessing a class for it", () => {
    const thrownString = toClientError("reader@example.com went wrong", options);
    assert.equal(thrownString.type, "NonError");
    assert.equal(thrownString.message, "<email> went wrong");
    assert.deepEqual(thrownString.frames, []);
    assert.equal(toClientError({ note: "private" }, options).message, "");
  });

  it("calls an error whose name isn't a class name just an Error", () => {
    const error = new Error("boom");
    error.name = "My private title";

    assert.equal(toClientError(error, options).type, "Error");
  });
});
