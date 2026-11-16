import { describe, expect, it } from "vitest";
import { OverviewId, type Chat, type ChatMessage } from "@overview/domain";
import { withAnswer } from "./withAnswer.js";

const OVERVIEW = OverviewId.parse("0b8f5f5a-3c2e-4f51-8a43-6a1d7c2e9f10");
const exchange = (question: string, at: string): ChatMessage[] => [
  { from: "reader", text: question, at },
  { from: "answer", text: `About ${question}`, at, citations: [], inSource: true },
];
const chat = (id: string, messages: ChatMessage[]): Chat => ({ id, overviewId: OVERVIEW, startedAt: messages[0]!.at, messages });

describe("withAnswer", () => {
  it("starts a new conversation with its first exchange", () => {
    const first = exchange("dose", "2026-11-16T10:00:00.000Z");
    expect(withAnswer([], OVERVIEW, `${OVERVIEW}:c1`, first)).toEqual([chat(`${OVERVIEW}:c1`, first)]);
  });

  it("adds an exchange to its conversation once, even if sync brought it down first", () => {
    const first = exchange("dose", "2026-11-16T10:00:00.000Z");
    const second = exchange("timing", "2026-11-16T10:01:00.000Z");
    const other = chat(`${OVERVIEW}:c2`, exchange("water", "2026-11-16T09:00:00.000Z"));

    const added = withAnswer([chat(`${OVERVIEW}:c1`, first), other], OVERVIEW, `${OVERVIEW}:c1`, second);

    expect(added[0]?.messages).toEqual([...first, ...second]);
    expect(added[1]).toBe(other);
    expect(withAnswer(added, OVERVIEW, `${OVERVIEW}:c1`, second)[0]?.messages).toEqual([...first, ...second]);
  });
});
