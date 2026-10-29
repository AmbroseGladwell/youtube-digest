import { describe, expect, it } from "vitest";
import { ANALYTICS_PURPOSES, type PurposesChange } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";
import { consentAllowsSharing, consentAnswered, consentOutdated } from "./consentAllowsSharing.js";

const GROWN: PurposesChange[] = [{ version: 1 }, { version: 2 }];

const answered = (answer: AnalyticsConsent["answer"], purposesVersion: number): AnalyticsConsent => ({
  answer,
  answeredAt: "2026-10-03T09:00:00.000Z",
  purposesVersion,
  anonymousId: answer === "share" ? "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" : null,
});

describe("consentOutdated", () => {
  it("is never true of a reader who has not answered", () => {
    expect(consentOutdated(null, GROWN)).toBe(false);
  });

  it("is false for an answer to the current list, yes or no", () => {
    expect(consentOutdated(answered("share", 2), GROWN)).toBe(false);
    expect(consentOutdated(answered("dontShare", 2), GROWN)).toBe(false);
  });

  it("is true once the list has grown, whatever the answer was", () => {
    expect(consentOutdated(answered("share", 1), GROWN)).toBe(true);
    expect(consentOutdated(answered("dontShare", 1), GROWN)).toBe(true);
  });
});

describe("consentAnswered", () => {
  it("is an answer, yes or no, to the current list only", () => {
    expect(consentAnswered(null, GROWN)).toBe(false);
    expect(consentAnswered(answered("share", 1), GROWN)).toBe(false);
    expect(consentAnswered(answered("dontShare", 1), GROWN)).toBe(false);
    expect(consentAnswered(answered("share", 2), GROWN)).toBe(true);
    expect(consentAnswered(answered("dontShare", 2), GROWN)).toBe(true);
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
  it("counts up from one", () => {
    ANALYTICS_PURPOSES.forEach(({ version }, index) => expect(version).toBe(index + 1));
  });
});
