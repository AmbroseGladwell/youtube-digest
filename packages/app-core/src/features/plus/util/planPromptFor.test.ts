import type { ChatUsage, OverviewUsage, Plan } from "@overview/domain";
import { describe, expect, it } from "vitest";
import { planPromptFor, type PlanPromptUsage } from "./planPromptFor.js";

const RESETS_ON = "2026-12-01";
const HOUR = 3600;

const overviews = (plan: Plan, overrides: Partial<OverviewUsage> = {}): OverviewUsage => ({
  plan,
  resetsOn: RESETS_ON,
  ours: { used: 0, limit: { free: 5, "byo-plus": 10, plus: 50 }[plan] },
  own: { used: 0, limit: plan === "free" ? 10 : 200 },
  transcription: { usedSeconds: 0, limitSeconds: { free: 5, "byo-plus": 15, plus: 30 }[plan] * HOUR, episodes: 0 },
  ...overrides,
});

const chat = (plan: Plan, used: number, limit: number): ChatUsage => ({ plan, resetsOn: RESETS_ON, used, limit });

const fresh = (plan: Plan): PlanPromptUsage => ({ overviews: overviews(plan), chat: chat(plan, 0, 100) });

const PLANS: Plan[] = ["free", "byo-plus", "plus"];

describe("planPromptFor", () => {
  it("shows the top bar's Get Overview Plus to Free only", () => {
    expect(PLANS.map((plan) => planPromptFor(plan, fresh(plan), { kind: "pill" }))).toEqual([{ variant: "pill" }, null, null]);
  });

  describe("the account menu", () => {
    it("always offers Plus to Free, and never to Plus", () => {
      expect(planPromptFor("free", fresh("free"), { kind: "menu" })).toEqual({ variant: "menu", spent: null });
      expect(
        planPromptFor("plus", { overviews: overviews("plus", { ours: { used: 50, limit: 50 } }), chat: null }, { kind: "menu" }),
      ).toBeNull();
    });

    it("offers it to BYO Plus only once an allowance on us is spent, naming which", () => {
      expect(planPromptFor("byo-plus", fresh("byo-plus"), { kind: "menu" })).toBeNull();
      expect(
        planPromptFor("byo-plus", { overviews: overviews("byo-plus", { ours: { used: 10, limit: 10 } }), chat: null }, { kind: "menu" }),
      ).toEqual({
        variant: "menu",
        spent: "overviews",
      });
      const hoursUsed = overviews("byo-plus", { transcription: { usedSeconds: 15 * HOUR, limitSeconds: 15 * HOUR, episodes: 9 } });
      expect(planPromptFor("byo-plus", { overviews: hoursUsed, chat: null }, { kind: "menu" })).toEqual({
        variant: "menu",
        spent: "hours",
      });
      expect(planPromptFor("byo-plus", { overviews: overviews("byo-plus"), chat: chat("byo-plus", 500, 500) }, { kind: "menu" })).toEqual({
        variant: "menu",
        spent: "questions",
      });
    });

    it("never prompts BYO Plus for its own-key count, since Plus gives no more there", () => {
      const ownSpent = overviews("byo-plus", { own: { used: 200, limit: 200 } });
      expect(planPromptFor("byo-plus", { overviews: ownSpent, chat: null }, { kind: "menu" })).toBeNull();
    });
  });

  describe("the counter in Create", () => {
    const quota = (key: "ours" | "own", left: number, limit: number) =>
      ({ kind: "quota", key, left, limit, resetsOn: RESETS_ON, passedOver: null }) as const;

    it("is quiet while overviews on us count down, and nudges at the last one", () => {
      expect(planPromptFor("free", fresh("free"), { kind: "counter", next: quota("ours", 3, 5) })).toEqual({
        variant: "counter",
        left: 3,
        limit: 5,
        resetsOn: RESETS_ON,
      });
      expect(planPromptFor("free", fresh("free"), { kind: "counter", next: quota("ours", 1, 5) })?.variant).toBe("nudge");
    });

    it("shows nothing for an own-key overview, for Plus, or while the count isn't known", () => {
      expect(planPromptFor("byo-plus", fresh("byo-plus"), { kind: "counter", next: quota("own", 150, 200) })).toBeNull();
      expect(planPromptFor("plus", fresh("plus"), { kind: "counter", next: quota("ours", 1, 50) })).toBeNull();
      expect(planPromptFor("free", fresh("free"), { kind: "counter", next: { kind: "checking" } })).toBeNull();
    });
  });

  it("shows the reset line only after a month whose overviews on us were all made, never to Plus", () => {
    const hitIt = (plan: Plan) => ({ overviews: overviews(plan, { lastMonthOursSpent: true }), chat: null });
    expect(planPromptFor("free", hitIt("free"), { kind: "reset" })).toEqual({ variant: "reset", limit: 5 });
    expect(planPromptFor("byo-plus", hitIt("byo-plus"), { kind: "reset" })).toEqual({ variant: "reset", limit: 10 });
    expect(planPromptFor("plus", hitIt("plus"), { kind: "reset" })).toBeNull();
    expect(planPromptFor("free", fresh("free"), { kind: "reset" })).toBeNull();
  });

  describe("the transcribing line", () => {
    it("shows only when the episode leaves under 2 hours, with the hours Plus adds", () => {
      expect(planPromptFor("free", fresh("free"), { kind: "transcribing", episodeSeconds: 2 * HOUR })).toBeNull();
      expect(planPromptFor("free", fresh("free"), { kind: "transcribing", episodeSeconds: 3.5 * HOUR })).toEqual({
        variant: "transcribing",
        moreHours: 25,
      });
      const byo = {
        overviews: overviews("byo-plus", { transcription: { usedSeconds: 12 * HOUR, limitSeconds: 15 * HOUR, episodes: 8 } }),
        chat: null,
      };
      expect(planPromptFor("byo-plus", byo, { kind: "transcribing", episodeSeconds: 1.5 * HOUR })).toEqual({
        variant: "transcribing",
        moreHours: 15,
      });
    });

    it("never shows to Plus, or when the episode's length isn't known", () => {
      expect(planPromptFor("plus", fresh("plus"), { kind: "transcribing", episodeSeconds: 29 * HOUR })).toBeNull();
      expect(planPromptFor("free", fresh("free"), { kind: "transcribing", episodeSeconds: null })).toBeNull();
    });
  });

  it("offers suggested questions to Free only, since both paid plans have them", () => {
    expect(PLANS.map((plan) => planPromptFor(plan, fresh(plan), { kind: "questions" }))).toEqual([{ variant: "questions" }, null, null]);
  });

  it("shows a limit met in place to every plan, with the Plus row for all but Plus", () => {
    for (const kind of ["hours", "chat", "saves"] as const) {
      expect(PLANS.map((plan) => planPromptFor(plan, fresh(plan), { kind }))).toEqual([
        { variant: kind, offersPlus: true },
        { variant: kind, offersPlus: true },
        { variant: kind, offersPlus: false },
      ]);
    }
  });
});
