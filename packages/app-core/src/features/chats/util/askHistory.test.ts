import { describe, expect, it } from "vitest";
import type { Chat } from "@overview/domain";
import { askHistoryGroups } from "./askHistory.js";

const chat = (id: string, at: string): Chat => ({
  id: `library:${id}`,
  startedAt: at,
  messages: [{ from: "reader", text: id, at }],
});

describe("askHistoryGroups", () => {
  it("groups conversations newest first by the day each was last asked in", () => {
    const now = new Date(2026, 10, 21, 15, 0);
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
    const groups = askHistoryGroups(
      [chat("old", at(2, 9)), chat("monday", at(17, 9)), chat("morning", at(21, 8)), chat("noon", at(21, 12)), chat("late", at(20, 23))],
      now,
    );
    expect(groups.map((group) => [group.label, group.chats.map((each) => each.messages[0]!.text)])).toEqual([
      ["Today", ["noon", "morning"]],
      ["Yesterday", ["late"]],
      ["Previous 7 days", ["monday"]],
      ["Earlier", ["old"]],
    ]);
  });
});
