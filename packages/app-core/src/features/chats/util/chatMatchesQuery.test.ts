import { describe, expect, it } from "vitest";
import { OverviewId, type Chat } from "@overview/domain";
import { chatMatchesQuery } from "./chatMatchesQuery.js";

const at = "2026-11-24T10:00:00.000Z";

const chat = (...questions: string[]): Chat => ({
  id: "o:c",
  overviewId: OverviewId.parse("41cc60f4-40ec-43e8-9ed4-f90f79bae944"),
  startedAt: at,
  messages: questions.flatMap((text) => [
    { from: "reader" as const, text, at },
    { from: "answer" as const, text: "Sourdough starter answer.", at, citations: [], inSource: true },
  ]),
});

describe("chatMatchesQuery", () => {
  it("matches everything while the query is blank", () => {
    expect(chatMatchesQuery(chat("How long to proof?"), "   ")).toBe(true);
  });

  it("matches any of the reader's questions, ignoring case", () => {
    expect(chatMatchesQuery(chat("How long to proof?", "What flour works BEST?"), "best flour")).toBe(true);
  });

  it("needs every word somewhere", () => {
    expect(chatMatchesQuery(chat("How long to proof?"), "proof flour")).toBe(false);
  });

  it("never matches on an answer's words", () => {
    expect(chatMatchesQuery(chat("How long to proof?"), "sourdough")).toBe(false);
  });

  it("matches on the extra text it's given, such as the scope", () => {
    expect(chatMatchesQuery(chat("How long to proof?"), "bread", "Bread project")).toBe(true);
  });
});
