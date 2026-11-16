import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@overview/domain";
import { chatSuggestions } from "./chatSuggestions.js";

const questions = ["one", "two", "three", "four", "five"].map((question) => ({ question, forReader: false }));
const AT = "2026-11-16T10:00:00.000Z";
const exchange = (text: string): ChatMessage[] => [
  { from: "reader", text, at: AT },
  { from: "answer", text: "An answer.", at: AT, citations: [], inSource: true },
];

describe("chatSuggestions", () => {
  it("before an answer, shows the set of three on show", () => {
    expect(chatSuggestions(questions, 0, [])).toEqual(["one", "two", "three"]);
    expect(chatSuggestions(questions, 1, [])).toEqual(["four", "five"]);
  });

  it("after an answer, keeps two of the questions not yet asked here", () => {
    expect(chatSuggestions(questions, 1, exchange("one"))).toEqual(["two", "three"]);
    expect(chatSuggestions(questions, 0, [...exchange("one"), ...exchange("two"), ...exchange("three"), ...exchange("four")])).toEqual([
      "five",
    ]);
  });
});
