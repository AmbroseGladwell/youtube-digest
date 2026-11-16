import { describe, expect, it } from "vitest";
import { OverviewId, type Chat } from "@overview/domain";
import { conversationDate, conversationLine } from "./conversationLine.js";

const local = (year: number, month: number, day: number, hours = 12, minutes = 0) => new Date(year, month - 1, day, hours, minutes);

const chat = (at: Date, questions: number): Chat => ({
  id: "o:c",
  overviewId: OverviewId.parse("41cc60f4-40ec-43e8-9ed4-f90f79bae944"),
  startedAt: at.toISOString(),
  messages: Array.from({ length: questions }, () => [
    { from: "reader" as const, text: "Q?", at: at.toISOString() },
    { from: "answer" as const, text: "A.", at: at.toISOString(), citations: [], inSource: true },
  ]).flat(),
});

describe("conversationLine", () => {
  const now = local(2026, 11, 16, 18, 0);

  it("names today's by the time it was last asked in", () => {
    expect(conversationLine(chat(local(2026, 11, 16, 14, 20), 2), now)).toBe("Today, 14:20 · 2 questions");
  });

  it("names an earlier one by its day, and counts one question as one", () => {
    expect(conversationLine(chat(local(2026, 11, 10), 1), now)).toBe("10 Nov · 1 question");
  });

  it("adds the year to a day in another year", () => {
    expect(conversationDate(local(2025, 12, 30).toISOString(), now)).toBe("30 Dec 2025");
  });
});
