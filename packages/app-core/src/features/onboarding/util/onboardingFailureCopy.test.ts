import { describe, expect, it } from "vitest";
import { onboardingFailureCopy } from "./onboardingFailureCopy.js";

const LINK = "https://fieldnotes.com/essays/the-case-for-boredom";

describe("onboardingFailureCopy", () => {
  it("never says nothing counted, since a trial read always counts", () => {
    const reasons = ["nothing-readable", "paywalled", "blocked", "not-found", "no-answer"] as const;
    for (const reason of reasons) {
      const copy = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason } }, LINK, "computer");
      expect(copy.body).not.toMatch(/counted/i);
    }
  });

  it("names a site that turned us away, and tells a computer of the extension only for afterwards", () => {
    const blocked = { kind: "read" as const, failure: { status: "failed" as const, reason: "blocked" as const, siteName: "Field Notes" } };
    expect(onboardingFailureCopy(blocked, LINK, "computer")).toMatchObject({
      title: "Field Notes didn't let us in",
      extension: expect.stringMatching(/after your first overview/),
    });
    expect(onboardingFailureCopy(blocked, LINK, "phone").extension).toBeNull();
  });

  it("offers Try again only where waiting might help", () => {
    const noAnswer = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason: "no-answer" } }, LINK, "computer");
    const paywalled = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason: "paywalled" } }, LINK, "computer");
    expect(noAnswer).toMatchObject({ title: "fieldnotes.com didn't respond", tryAgain: true });
    expect(paywalled).toMatchObject({ title: "That article is behind a paywall", tryAgain: false });
  });

  it("calls a page with nothing readable at a site's root a front page", () => {
    const failure = { kind: "read" as const, failure: { status: "failed" as const, reason: "nothing-readable" as const } };
    expect(onboardingFailureCopy(failure, "https://fieldnotes.com/", "computer").title).toBe("That looks like a front page");
    expect(onboardingFailureCopy(failure, LINK, "computer").title).toBe("We couldn't read that page");
  });

  it("points a device or network out of reads to video links, which use none", () => {
    expect(onboardingFailureCopy({ kind: "trialReads" }, LINK, "computer")).toMatchObject({
      title: "You've tried 5 pages on this device",
      videoOnly: true,
    });
    expect(onboardingFailureCopy({ kind: "trialReadsAddress" }, LINK, "computer")).toMatchObject({
      body: expect.stringMatching(/15 pages a day.*tomorrow/),
      videoOnly: true,
    });
  });
});
