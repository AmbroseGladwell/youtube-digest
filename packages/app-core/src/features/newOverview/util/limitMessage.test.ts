import { describe, expect, it } from "vitest";
import { limitMessageOf } from "./limitMessage.js";
import type { SpentQuota } from "./nextQuota.js";

const spent = (...quotas: SpentQuota[]) => ({ kind: "spent", spent: quotas, resetsOn: "2026-11-01" }) as const;

describe("limitMessageOf", () => {
  it("is nothing while a quota is left", () => {
    expect(
      limitMessageOf({ kind: "quota", key: "own", left: 1, limit: 10, resetsOn: "2026-11-01", passedOver: null }, "free"),
    ).toBeNull();
    expect(limitMessageOf({ kind: "trial", left: 1, total: 3 }, "free")).toBeNull();
    expect(limitMessageOf({ kind: "checking" }, "free")).toBeNull();
    expect(limitMessageOf(null, "free")).toBeNull();
  });

  it("offers only an account once the trial is spent, since no key gets round it", () => {
    expect(limitMessageOf({ kind: "trial", left: 0, total: 3 }, "free")).toEqual({
      quota: "trial",
      made: "3 trial overviews",
      title: "You've used your 3 trial overviews",
      body: "A free account makes 5 a month on us, syncs them to every device and reads them aloud.",
      actions: ["createAccount"],
    });
  });

  it("on Free with no key, offers a key or Plus once ours is spent", () => {
    expect(limitMessageOf(spent({ key: "ours", limit: 5 }), "free")).toEqual({
      quota: "ours",
      made: "5",
      title: "You've made this month's 5. More on 1 November.",
      body: "Get more overviews with Plus. Or add your own key: your free account makes 10 a month with it.",
      actions: ["addKey", "seePlans"],
    });
  });

  it("on Plus with no key, offers only a key once ours is spent", () => {
    expect(limitMessageOf(spent({ key: "ours", limit: 50 }), "plus")).toEqual({
      quota: "ours",
      made: "50 on us",
      title: "You've made this month's 50 on us. More on 1 November.",
      body: "Add your own key and carry on: Plus makes 200 a month with it.",
      actions: ["addKey"],
    });
  });

  it("on Free with both spent, names both in the order spent and offers BYO Plus", () => {
    expect(limitMessageOf(spent({ key: "own", limit: 10 }, { key: "ours", limit: 5 }), "free")).toEqual({
      quota: "both",
      made: "10 on your own key and 5 on us",
      title: "You've made this month's 10 on your own key and 5 on us. More on 1 November.",
      body: "BYO Plus makes 200 a month on your own key.",
      actions: ["seeByoPlus"],
    });
  });

  it("on BYO Plus with both spent, offers Plus's allowance on our key", () => {
    expect(limitMessageOf(spent({ key: "own", limit: 200 }, { key: "ours", limit: 10 }), "byo-plus")).toMatchObject({
      quota: "both",
      body: "Get more overviews with Plus: it makes 50 a month on us.",
      actions: ["seePlans"],
    });
  });

  it("on Plus with both spent, says plainly there is no upgrade", () => {
    expect(limitMessageOf(spent({ key: "ours", limit: 50 }, { key: "own", limit: 200 }), "plus")).toEqual({
      quota: "both",
      made: "50 on us and 200 on your own",
      title: "You've made this month's 50 on us and 200 on your own. More on 1 November.",
      body: "That's the most any plan makes on your own key, so there's no upgrade for this.",
      actions: ["seeUsage"],
    });
  });

  it("with Only ever use my key on, the own key alone is what ran out", () => {
    expect(limitMessageOf(spent({ key: "own", limit: 10 }), "free")).toMatchObject({
      quota: "own",
      title: "You've made this month's 10 on your own key. More on 1 November.",
      actions: ["seeByoPlus"],
    });
    expect(limitMessageOf(spent({ key: "own", limit: 200 }), "byo-plus")).toMatchObject({ quota: "own", actions: ["seeUsage"] });
  });
});
