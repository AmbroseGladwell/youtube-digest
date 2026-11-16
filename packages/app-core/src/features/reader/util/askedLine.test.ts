import { describe, expect, it } from "vitest";
import { answeredHereLine, askedLine } from "./askedLine.js";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const asked = (askedAt: string, assistant: "claude" | "chatgpt" | "gemini" = "claude") => ({ question: "Why?", assistant, askedAt });

describe("askedLine", () => {
  it("names the assistant and says just now for the first minute", () => {
    expect(askedLine(asked("2026-11-15T11:59:30.000Z"), NOW)).toBe("Asked in Claude · just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(askedLine(asked("2026-11-15T11:55:00.000Z", "chatgpt"), NOW)).toBe("Asked in ChatGPT · 5 minutes ago");
    expect(askedLine(asked("2026-11-15T09:00:00.000Z", "gemini"), NOW)).toBe("Asked in Gemini · 3 hours ago");
    expect(askedLine(asked("2026-11-12T10:00:00.000Z"), NOW)).toBe("Asked in Claude · 3 days ago");
  });
});

describe("answeredHereLine", () => {
  it("says it was answered here, and how long ago", () => {
    expect(answeredHereLine("2026-11-15T11:59:30.000Z", NOW)).toBe("Answered here · just now");
    expect(answeredHereLine("2026-11-14T11:00:00.000Z", NOW)).toBe("Answered here · 1 day ago");
  });
});
