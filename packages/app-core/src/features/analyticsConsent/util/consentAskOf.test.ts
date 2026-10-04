import { describe, expect, it } from "vitest";
import { ANALYTICS_PURPOSES, type PurposesChange } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";
import { consentAllowsSharing, consentAskOf } from "./consentAskOf.js";

const GROWN: PurposesChange[] = [
  { version: 1, added: null },
  { version: 2, added: "how long audio takes to start" },
];

const answered = (answer: AnalyticsConsent["answer"], purposesVersion: number): AnalyticsConsent => ({
  answer,
  answeredAt: "2026-10-03T09:00:00.000Z",
  purposesVersion,
  anonymousId: answer === "share" ? "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" : null,
});

describe("consentAskOf", () => {
  it("asks a reader who has never answered", () => {
    expect(consentAskOf(null, GROWN)).toEqual({ kind: "first" });
  });

  it("asks nothing of a reader who answered the current list, yes or no", () => {
    expect(consentAskOf(answered("share", 2), GROWN)).toBeNull();
    expect(consentAskOf(answered("dontShare", 2), GROWN)).toBeNull();
  });

  it("asks again, naming what was added, once the list has grown, whatever the answer was", () => {
    const again = { kind: "again", added: "how long audio takes to start" };
    expect(consentAskOf(answered("share", 1), GROWN)).toEqual(again);
    expect(consentAskOf(answered("dontShare", 1), GROWN)).toEqual(again);
  });
});

describe("consentAllowsSharing", () => {
  it("shares only on a yes to the current list", () => {
    expect(consentAllowsSharing(null, GROWN)).toBe(false);
    expect(consentAllowsSharing(answered("dontShare", 2), GROWN)).toBe(false);
    expect(consentAllowsSharing(answered("share", 1), GROWN)).toBe(false);
    expect(consentAllowsSharing(answered("share", 2), GROWN)).toBe(true);
  });
});

describe("ANALYTICS_PURPOSES", () => {
  it("counts up from one, and every change after the first says what it added", () => {
    ANALYTICS_PURPOSES.forEach(({ version, added }, index) => {
      expect(version).toBe(index + 1);
      if (index > 0) expect(added).toMatch(/\S/);
    });
  });
});
