import { beforeEach, describe, expect, it, vi } from "vitest";

const freshModule = () => import("./useAnalyticsConsent.js");

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("declineAnalyticsConsent", () => {
  it("is a decline from a reader who never answered, and records a no with no id", async () => {
    const { analyticsConsentSnapshot, declineAnalyticsConsent } = await freshModule();

    expect(declineAnalyticsConsent()).toEqual({ declined: true });
    expect(analyticsConsentSnapshot().consent).toMatchObject({ answer: "dontShare", anonymousId: null });
  });

  it("is a decline from a reader who said no before", async () => {
    const { answerAnalyticsConsent, declineAnalyticsConsent } = await freshModule();
    answerAnalyticsConsent("dontShare");

    expect(declineAnalyticsConsent()).toEqual({ declined: true });
  });

  it("is a withdrawal, not a decline, from a reader who said yes, and still deletes the id", async () => {
    const { analyticsConsentSnapshot, answerAnalyticsConsent, declineAnalyticsConsent } = await freshModule();
    answerAnalyticsConsent("share");

    expect(declineAnalyticsConsent()).toEqual({ declined: false });
    expect(analyticsConsentSnapshot().consent).toMatchObject({ answer: "dontShare", anonymousId: null });
  });
});
