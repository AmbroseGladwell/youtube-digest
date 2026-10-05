import { describe, expect, it } from "vitest";
import { makeAnalyticsConsent } from "../types/AnalyticsConsentFactory.testHelper.js";
import { shareUsageOn, shareUsageRowValue, shareUsageStatus, sinceDay, type ShareUsageState } from "./shareUsageStatus.js";

const NOW = new Date("2026-10-06T15:00:00");
const EARLIER = new Date("2026-10-04T09:00:00").toISOString();
const TODAY = new Date("2026-10-06T08:00:00").toISOString();


describe("sinceDay", () => {
  it("says today for today, and the full date otherwise", () => {
    expect(sinceDay(TODAY, NOW)).toBe("today");
    expect(sinceDay(EARLIER, NOW)).toBe("4 October 2026");
  });
});

describe("a reader without an account", () => {
  const state = (consent: Parameters<typeof makeAnalyticsConsent>[0] | null, outdated = false): ShareUsageState =>
    ({ signedIn: false, consent: consent === null ? null : makeAnalyticsConsent(consent), outdated });

  it("has not chosen: off, and says nothing is shared", () => {
    expect(shareUsageOn(state(null))).toBe(false);
    expect(shareUsageStatus(state(null), NOW)).toBe("You haven’t chosen yet, so nothing is shared.");
    expect(shareUsageRowValue(state(null))).toBe("Not chosen");
  });

  it("said yes: on, since the day they said it", () => {
    const yes = state({ answer: "share", answeredAt: EARLIER });
    expect(shareUsageOn(yes)).toBe(true);
    expect(shareUsageStatus(yes, NOW)).toBe("On since 4 October 2026");
    expect(shareUsageStatus(state({ answer: "share", answeredAt: TODAY }), NOW)).toBe("On since today");
    expect(shareUsageRowValue(yes)).toBe("Sharing usage");
  });

  it("said no: off, since the day they said it", () => {
    const no = state({ answer: "dontShare", answeredAt: EARLIER });
    expect(shareUsageOn(no)).toBe(false);
    expect(shareUsageStatus(no, NOW)).toBe("Off since 4 October 2026");
    expect(shareUsageRowValue(no)).toBe("Not sharing usage");
  });

  it("answered an older list: the old answer shows, and the line says nothing new is shared yet", () => {
    const old = state({ answer: "share", answeredAt: EARLIER }, true);
    expect(shareUsageOn(old)).toBe(true);
    expect(shareUsageStatus(old, NOW)).toBe("Share usage now covers more. Nothing new is shared until you choose.");
  });
});

describe("a signed-in reader", () => {
  it("is on across their devices by default, with no date until they change it", () => {
    const state: ShareUsageState = { signedIn: true, optedOut: false, changedAt: null };
    expect(shareUsageOn(state)).toBe(true);
    expect(shareUsageStatus(state, NOW)).toBe("On across your devices");
    expect(shareUsageRowValue(state)).toBe("Sharing usage");
  });

  it("switched off says since when, and switched back on today says so", () => {
    expect(shareUsageStatus({ signedIn: true, optedOut: true, changedAt: EARLIER }, NOW)).toBe(
      "Off across your devices since 4 October 2026",
    );
    expect(shareUsageStatus({ signedIn: true, optedOut: false, changedAt: TODAY }, NOW)).toBe(
      "On across your devices since today",
    );
    expect(shareUsageRowValue({ signedIn: true, optedOut: true, changedAt: EARLIER })).toBe("Not sharing usage");
  });
});
