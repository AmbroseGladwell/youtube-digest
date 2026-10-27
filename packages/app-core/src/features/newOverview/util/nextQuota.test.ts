import { describe, expect, it } from "vitest";
import type { OverviewUsage, Plan } from "@overview/domain";
import { keyOrderFor } from "./keyOrderFor.js";
import { nextQuotaOf } from "./nextQuota.js";

const LIMITS: Record<Plan, { ours: number; own: number }> = {
  free: { ours: 5, own: 10 },
  "byo-plus": { ours: 10, own: 200 },
  plus: { ours: 50, own: 200 },
};

const usageOf = (plan: Plan, used: { ours?: number; own?: number } = {}): OverviewUsage => ({
  plan,
  resetsOn: "2026-11-01",
  ours: { used: used.ours ?? 0, limit: LIMITS[plan].ours },
  own: { used: used.own ?? 0, limit: LIMITS[plan].own },
});

const nextFor = (
  plan: Plan,
  { hasOwnKey = true, onlyMyKey = false, used = {} }: { hasOwnKey?: boolean; onlyMyKey?: boolean; used?: { ours?: number; own?: number } } = {},
) =>
  nextQuotaOf({
    order: keyOrderFor({ ourKeyUsable: true, plan, hasOwnKey, onlyMyKey }),
    trial: null,
    usage: { status: "known", data: usageOf(plan, used) },
  });

describe("nextQuotaOf", () => {
  it("uses the reader's own key first on Free and BYO Plus", () => {
    expect(nextFor("free", { used: { own: 3 } })).toEqual({
      kind: "quota",
      key: "own",
      left: 7,
      limit: 10,
      resetsOn: "2026-11-01",
      passedOver: null,
    });
    expect(nextFor("byo-plus")).toMatchObject({ key: "own", left: 200 });
  });

  it("uses ours first on Plus", () => {
    expect(nextFor("plus", { used: { ours: 12 } })).toMatchObject({ key: "ours", left: 38, limit: 50 });
  });

  it("uses ours on any plan when the reader has no key", () => {
    expect(nextFor("free", { hasOwnKey: false, used: { ours: 2 } })).toMatchObject({ key: "ours", left: 3 });
    expect(nextFor("byo-plus", { hasOwnKey: false })).toMatchObject({ key: "ours", left: 10 });
  });

  it("moves to the fallback once the first quota is spent, and says which was passed over", () => {
    expect(nextFor("free", { used: { own: 10, ours: 1 } })).toMatchObject({
      key: "ours",
      left: 4,
      passedOver: { key: "own", limit: 10 },
    });
    expect(nextFor("plus", { used: { ours: 50, own: 37 } })).toMatchObject({
      key: "own",
      left: 163,
      passedOver: { key: "ours", limit: 50 },
    });
  });

  it("never falls back to ours with Only ever use my key on", () => {
    expect(nextFor("free", { onlyMyKey: true, used: { own: 10 } })).toEqual({
      kind: "spent",
      spent: [{ key: "own", limit: 10 }],
      resetsOn: "2026-11-01",
    });
  });

  it("is spent once every key in the order is, naming each in the order tried", () => {
    expect(nextFor("byo-plus", { used: { own: 200, ours: 10 } })).toMatchObject({
      kind: "spent",
      spent: [
        { key: "own", limit: 200 },
        { key: "ours", limit: 10 },
      ],
    });
  });

  it("is checking, never 0, until the server's counts arrive", () => {
    const order = keyOrderFor({ ourKeyUsable: true, plan: null, hasOwnKey: true, onlyMyKey: false });
    expect(nextQuotaOf({ order, trial: null, usage: { status: "checking" } })).toEqual({ kind: "checking" });
    expect(nextQuotaOf({ order, trial: null, usage: { status: "unreachable" } })).toEqual({ kind: "unreachable" });
  });

  it("is the trial signed out, on either key", () => {
    const trial = { made: 1, total: 3 };
    expect(nextQuotaOf({ order: ["own"], trial, usage: { status: "checking" } })).toEqual({ kind: "trial", left: 2, total: 3 });
    expect(nextQuotaOf({ order: [], trial: { made: 4, total: 3 }, usage: { status: "checking" } })).toEqual({
      kind: "trial",
      left: 0,
      total: 3,
    });
  });

  it("is nothing where no key can make an overview", () => {
    expect(nextQuotaOf({ order: [], trial: null, usage: { status: "checking" } })).toBeNull();
  });
});
