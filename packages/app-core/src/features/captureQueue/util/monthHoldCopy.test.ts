import { describe, expect, it } from "vitest";
import type { LimitMessage } from "../../newOverview/util/limitMessage.js";
import { monthHoldNote, monthHoldWays } from "./monthHoldCopy.js";

const hold = { reason: "monthSpent" as const, resumesAt: new Date(2026, 10, 1, 12).getTime() };
const limit = (actions: LimitMessage["actions"], made = "5"): LimitMessage => ({ quota: "ours", made, title: "", body: "", actions });

describe("monthHoldNote", () => {
  it("names every way the queue carries on", () => {
    expect(monthHoldNote(hold, limit(["addKey", "seePlans"]))).toBe(
      "This month's 5 are made, so the queue is waiting. It carries on by itself on 1 November, as soon as you add a key or if your plan changes.",
    );
  });

  it("names only the month turning where no key or plan would help", () => {
    expect(monthHoldNote(hold, limit(["seeUsage"], "200 on your own key"))).toBe(
      "This month's 200 on your own key are made, so the queue is waiting. It carries on by itself on 1 November.",
    );
  });
});

describe("monthHoldWays", () => {
  it("offers the plans for BYO Plus, and nothing without a limit message", () => {
    expect(monthHoldWays(limit(["seeByoPlus"]))).toEqual(["seePlans"]);
    expect(monthHoldWays(null)).toEqual([]);
  });
});
