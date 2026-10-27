import { describe, expect, it } from "vitest";
import { planRowCount, usageLineOf } from "./usageLine.js";

const RESETS_ON = "2026-11-01";

describe("usageLineOf", () => {
  it("names the key, the month and the reset date, and shortens them in the panel", () => {
    const next = { kind: "quota", key: "own", left: 7, limit: 10, resetsOn: RESETS_ON, passedOver: null } as const;
    expect(usageLineOf(next)).toEqual({
      parts: ["7 of 10 left on your own key this month", "Resets 1 November"],
      link: "Plan",
    });
    expect(usageLineOf(next, { narrow: true })).toEqual({ parts: ["7 of 10 left on your own key", "Resets 1 Nov"], link: null });
  });

  it("says which quota is spent and which this one uses instead, mentioning Plus only on a fall back to our key", () => {
    const next = {
      kind: "quota",
      key: "ours",
      left: 4,
      limit: 5,
      resetsOn: RESETS_ON,
      passedOver: { key: "own", limit: 10 },
    } as const;
    expect(usageLineOf(next, { plan: "free" })).toEqual({
      parts: ["This month's 10 on your own key are made, so this one uses ours: 4 of 5 left.", "Plus makes more on our key."],
      link: "See plans",
    });
    expect(usageLineOf(next, { narrow: true, plan: "byo-plus" })).toEqual({
      parts: ["Your key's 10 are made this month. This one uses ours: 4 of 5 left. Plus makes more on ours"],
      link: "Plan",
    });

    const plus = { ...next, key: "own", left: 163, limit: 200, passedOver: { key: "ours", limit: 50 } } as const;
    expect(usageLineOf(plus, { plan: "plus" })).toEqual({
      parts: ["This month's 50 on our key are made, so this one uses your own key: 163 of 200 left."],
      link: "Plan",
    });
  });

  it("reads Checking… while counts load, never 0", () => {
    expect(usageLineOf({ kind: "checking" }).parts).toEqual(["Overviews left this month: Checking…"]);
    expect(usageLineOf({ kind: "checking" }, { narrow: true }).parts).toEqual(["Left this month: Checking…"]);
  });

  it("counts the trial on either key", () => {
    expect(usageLineOf({ kind: "trial", left: 2, total: 3 }).parts).toEqual(["2 of 3 trial overviews left", "On either key"]);
  });
});

describe("planRowCount", () => {
  it("gives what's left of the next quota, or Checking…", () => {
    expect(planRowCount({ kind: "quota", key: "ours", left: 7, limit: 10, resetsOn: RESETS_ON, passedOver: null })).toBe(
      "7 of 10 left",
    );
    expect(planRowCount({ kind: "checking" })).toBe("Checking…");
    expect(planRowCount(null)).toBeNull();
  });
});
