import { describe, expect, it } from "vitest";
import { isPlanPromptHidden } from "./isPlanPromptHidden.js";

describe("isPlanPromptHidden", () => {
  it("shows a prompt never put away", () => {
    expect(isPlanPromptHidden("questions", {}, new Date(2026, 10, 25, 12))).toBe(false);
  });

  it("hides Not now for the rest of the reader's day, and shows it again tomorrow", () => {
    const dismissals = { questions: new Date(2026, 10, 25, 9).toISOString() };

    expect(isPlanPromptHidden("questions", dismissals, new Date(2026, 10, 25, 23, 59))).toBe(true);
    expect(isPlanPromptHidden("questions", dismissals, new Date(2026, 10, 26, 0, 1))).toBe(false);
  });

  it("hides one prompt without hiding the others", () => {
    const dismissals = { chat: new Date(2026, 10, 25, 9).toISOString() };

    expect(isPlanPromptHidden("questions", dismissals, new Date(2026, 10, 25, 10))).toBe(false);
  });

  it("shows the reset line once in a usage month, and again in the next", () => {
    const dismissals = { reset: "2026-12-02T10:00:00.000Z" };

    expect(isPlanPromptHidden("reset", dismissals, new Date("2026-12-20T10:00:00.000Z"))).toBe(true);
    expect(isPlanPromptHidden("reset", dismissals, new Date("2027-01-01T00:00:00.000Z"))).toBe(false);
  });
});
