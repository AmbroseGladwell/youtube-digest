import { currentPurposes } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "./AnalyticsConsent.js";

export const ANONYMOUS_ID = "4a1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

export const makeAnalyticsConsent = (overrides: Partial<AnalyticsConsent> = {}): AnalyticsConsent => {
  const answer = overrides.answer ?? "dontShare";
  return {
    answer,
    answeredAt: "2026-10-03T09:00:00.000Z",
    purposesVersion: currentPurposes().version,
    anonymousId: answer === "share" ? ANONYMOUS_ID : null,
    ...overrides,
  };
};
