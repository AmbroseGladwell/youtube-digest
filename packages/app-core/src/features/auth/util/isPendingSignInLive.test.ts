import { describe, expect, it } from "vitest";
import { isPendingSignInLive } from "./isPendingSignInLive.js";

const pending = {
  apiUrl: "https://sync.test",
  email: "reader@example.com",
  intent: "signIn" as const,
  firstName: null,
  sentAt: 0,
};
const MINUTE_MS = 60 * 1000;

describe("isPendingSignInLive", () => {
  it("is live while a code from the link could still be typed", () => {
    expect(isPendingSignInLive(pending, 24 * MINUTE_MS)).toBe(true);
  });

  it("is over once the link and the code it would show have both run out", () => {
    expect(isPendingSignInLive(pending, 25 * MINUTE_MS)).toBe(false);
  });
});
