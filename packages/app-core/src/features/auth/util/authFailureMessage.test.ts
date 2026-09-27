import { describe, expect, it } from "vitest";
import { SyncRequestError, SyncTransportError } from "@overview/sync";
import { authFailureMessage, CODE_SPENT, LINK_SPENT } from "./authFailureMessage.js";

describe("authFailureMessage", () => {
  it("says a spent link or code in the words of what was sent", () => {
    const spent = new SyncRequestError("link_invalid", 410, "gone");
    expect(authFailureMessage(spent, LINK_SPENT)).toBe(LINK_SPENT);
    expect(authFailureMessage(spent, CODE_SPENT)).toBe(CODE_SPENT);
  });

  it("names the address when the server could not read it", () => {
    expect(authFailureMessage(new SyncRequestError("invalid_request", 400, "bad"), LINK_SPENT)).toMatch(/email address/);
  });

  it("blames the connection when nothing answered", () => {
    expect(authFailureMessage(new SyncTransportError("no"), LINK_SPENT)).toMatch(/reach the server/);
  });

  it("does not pretend to know about anything else", () => {
    expect(authFailureMessage(new SyncRequestError("internal_error", 500, "x"), LINK_SPENT)).toMatch(/server had a problem/);
    expect(authFailureMessage(new Error("?"), LINK_SPENT)).toMatch(/Something went wrong/);
  });
});
