import { describe, expect, it } from "vitest";
import type { ChatUsage } from "@overview/domain";
import { chatMeterOf, chatMeterStateOf, spentWaitOf } from "./chatMeterOf.js";

const usage = (share: number | undefined, extra: Partial<ChatUsage> = {}): ChatUsage => ({
  plan: "free",
  resetsOn: "2026-12-01",
  used: 3,
  limit: 100,
  ...(share === undefined ? {} : { share }),
  ...extra,
});

describe("chatMeterOf", () => {
  it("shows nothing under half used, or from a server before usage (376a)", () => {
    expect(chatMeterOf(usage(0.49))).toBeNull();
    expect(chatMeterOf(usage(undefined))).toBeNull();
    expect(chatMeterOf(null)).toBeNull();
  });

  it("from half, a quiet line rounded down to tens, with no upsell (376b)", () => {
    expect(chatMeterOf(usage(0.67))).toEqual({ percent: 60, warning: false, resetsOn: "2026-12-01", upsell: null });
  });

  it("from 90%, the warning in whole percent, at most 100, upselling only plans that give more (376c)", () => {
    expect(chatMeterOf(usage(0.927))).toEqual({ percent: 92, warning: true, resetsOn: "2026-12-01", upsell: "seePlans" });
    expect(chatMeterOf(usage(1.04, { plan: "byo-plus" }))?.percent).toBe(100);
    expect(chatMeterOf(usage(0.95, { plan: "byo-plus" }))?.upsell).toBe("seePlus");
    expect(chatMeterOf(usage(0.95, { plan: "plus" }))?.upsell).toBeNull();
  });
});

describe("spentWaitOf", () => {
  it("waits for the month once usage reaches it, and a library question once its worst case won't fit (376d, 376h)", () => {
    expect(spentWaitOf(usage(1), "overview")).toEqual({ kind: "month", resetsOn: "2026-12-01" });
    expect(spentWaitOf(usage(0.97, { libraryFits: false }), "overview")).toBeNull();
    expect(spentWaitOf(usage(0.97, { libraryFits: false }), "library")).toEqual({ kind: "libraryMonth", resetsOn: "2026-12-01" });
    expect(spentWaitOf(usage(0.5, { libraryFits: true }), "library")).toBeNull();
  });

  it("counts questions against a server before usage", () => {
    expect(spentWaitOf(usage(undefined, { used: 100 }), "overview")?.kind).toBe("month");
    expect(spentWaitOf(usage(undefined, { used: 99 }), "library")).toBeNull();
  });
});

describe("chatMeterStateOf", () => {
  it("names what the reader is shown, the wait before the meter", () => {
    expect(chatMeterStateOf("libraryMonth", null)).toBe("library");
    expect(chatMeterStateOf("month", null)).toBe("month");
    expect(chatMeterStateOf(null, chatMeterOf(usage(0.93)))).toBe("warning");
    expect(chatMeterStateOf(null, chatMeterOf(usage(0.55)))).toBe("half");
    expect(chatMeterStateOf(null, null)).toBeNull();
  });
});
