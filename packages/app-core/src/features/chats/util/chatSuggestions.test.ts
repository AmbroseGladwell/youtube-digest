import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@overview/domain";
import { chatSuggestions } from "./chatSuggestions.js";

const questions = ["one", "two", "three", "four", "five"].map((question) => ({ question, forReader: false }));
const AT = "2026-11-16T10:00:00.000Z";
const asked = (text: string): ChatMessage => ({ from: "reader", text, at: AT });
const answered: ChatMessage = { from: "answer", text: "An answer.", at: AT, citations: [], inSource: true };

describe("chatSuggestions", () => {
  it("before the first question, shows the set of three on show", () => {
    expect(chatSuggestions(questions, 0, [])).toEqual(["one", "two", "three"]);
    expect(chatSuggestions(questions, 1, [])).toEqual(["four", "five"]);
  });

  it("once a question is asked, shows none", () => {
    expect(chatSuggestions(questions, 0, [asked("something else")])).toEqual([]);
    expect(chatSuggestions(questions, 1, [asked("one"), answered])).toEqual([]);
  });
});
