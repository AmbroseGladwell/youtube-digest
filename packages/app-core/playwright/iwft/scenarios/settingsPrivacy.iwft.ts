import type { Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import {
  ANONYMOUS_ID,
  makeAnalyticsConsent,
} from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";

const NEVER_ASKED = { analyticsConsent: null } as const;
const SAID_YES = { analyticsConsent: makeAnalyticsConsent({ answer: "share", answeredAt: "2026-09-28T09:00:00.000Z" }) };
const SAID_NO = { analyticsConsent: makeAnalyticsConsent({ answer: "dontShare", answeredAt: "2026-09-28T09:00:00.000Z" }) };
const BUILD = { version: "0.1.0", commit: "30bb95a", dirty: false };
const SIGNED_IN = {
  sync: true,
  syncConnection: {
    apiUrl: "https://sync.test",
    token: null,
    accountId: SIMULATED_ACCOUNT_ID,
    email: SIMULATED_EMAIL,
    firstName: "Ada",
  },
} as const;

const SIGNED_OUT_EXPLANATION =
  "Shares which features you use, never what you watch, read or type, under a random ID in this browser that’s deleted when you turn this off. If you create an account later, it’s linked to your account.";

const storedConsent = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("overview.analyticsConsent.v1") ?? "null"));

// Designs 62d–62i: one switch for sharing usage, between Plan and About
// (docs/features/analytics-consent.md, "Settings › Privacy").
test.describe("signed out", () => {
  // Design 62d.
  test("Privacy sits between Plan and About, says nothing is chosen, and keeps error reports apart", async ({
    launcher,
  }) => {
    await launcher.launch({ ...NEVER_ASKED, build: BUILD });
    const settings = await launcher.appShell.openSettings();

    await settings.verifyRowsAre(["keys", "playlists", "milestones", "plan", "privacy", "about"]);
    await settings.verifyRowReads("privacy", "Not chosen");
    await settings.openSection("privacy");

    await settings.privacySection.verifySwitch(false, "You haven’t chosen yet, so nothing is shared.");
    await settings.privacySection.verifyExplains(SIGNED_OUT_EXPLANATION);
    await settings.privacySection.verifyErrorReportsAreApart();
    await settings.privacySection.verifyPolicyLinks(/^https?:\/\/[^/]+/, false);
  });

  // Design 62e.
  test("turning it on is the same yes as the prompt's: a new id, sent under it, and no prompt after", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await launcher.launch(NEVER_ASKED);
    const settings = await launcher.appShell.openSettings();
    await settings.openSection("privacy");

    await settings.privacySection.switchShareUsage();

    await settings.privacySection.verifySwitch(true, "On since today");
    await settings.verifyRowReads("privacy", "Sharing usage");
    const consent = await storedConsent(page);
    test.expect(consent).toMatchObject({ answer: "share" });
    await test.expect.poll(() => backendSimulator.analytics.events()).toContainEqual({
      name: "analyticsConsent.settings.switched",
      props: { on: true },
    });
    test
      .expect(backendSimulator.analytics.batches().every(({ anonymousId }) => anonymousId === consent.anonymousId))
      .toBe(true);

    await launcher.appShell.clickBrand();
    await launcher.analyticsConsentPrompt.verifyIsAbsent();
    await launcher.analyticsConsentNotice.verifyIsAbsent();
  });

  // Design 62f: withdrawing.
  test("turning it off sends what the yes recorded, then deletes the id and sends nothing more", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await launcher.launch(SAID_YES);
    const settings = await launcher.appShell.openSettings();
    await settings.openSection("privacy");
    await settings.privacySection.verifySwitch(true, "On since 28 September 2026");

    await settings.privacySection.switchShareUsage();

    await settings.privacySection.verifySwitch(false, "Off since today");
    test.expect(await storedConsent(page)).toMatchObject({ answer: "dontShare", anonymousId: null });
    const sent = backendSimulator.analytics.eventNames();
    test.expect(sent.at(-1)).toBe("analyticsConsent.settings.switched");
    test.expect(backendSimulator.analytics.batches().every(({ anonymousId }) => anonymousId === ANONYMOUS_ID)).toBe(true);

    await launcher.appShell.clickBrand();
    await launcher.appShell.openSettings();
    test.expect(backendSimulator.analytics.eventNames()).toEqual(sent);
    test.expect(backendSimulator.analytics.declines()).toEqual([]);
  });

  // Design 62g.
  test("a no is shown with its date, and turning it on makes a new id rather than reusing one", async ({
    launcher,
    page,
  }) => {
    await launcher.launch(SAID_NO);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("privacy", "Not sharing usage");
    await settings.openSection("privacy");
    await settings.privacySection.verifySwitch(false, "Off since 28 September 2026");

    await settings.privacySection.switchShareUsage();

    const { anonymousId } = await storedConsent(page);
    test.expect(anonymousId).not.toBeNull();
    test.expect(anonymousId).not.toBe(ANONYMOUS_ID);
  });

  test("the extension says the id is kept in the extension, and opens the policy in a tab of its own", async ({
    launcher,
  }) => {
    await launcher.launchPanel({ defaultApiUrl: "https://sync.test", ...NEVER_ASKED });
    const settings = await launcher.appShell.openSettings();
    await settings.openSection("privacy");

    await settings.privacySection.verifyExplains(SIGNED_OUT_EXPLANATION.replace("in this browser", "in the extension"));
    await settings.privacySection.verifyPolicyLinks(/^https:\/\/sync\.test/, true);
  });

  test("the notice after answering the prompt leads to this section", async ({ launcher }) => {
    await launcher.launch(NEVER_ASKED);
    await launcher.analyticsConsentPrompt.dontShare();

    await launcher.analyticsConsentNotice.openSettings();

    await launcher.settingsPage.verifySectionIsShown("privacy");
    await launcher.settingsPage.privacySection.verifySwitch(false, "Off since today");
  });
});

test.describe("signed in", () => {
  // Design 62h.
  test("on across the account's devices by default, and off is kept on the account and stops sending", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await launcher.appShell.openSettings();
    await settings.verifyRowReads("privacy", "Sharing usage");
    await settings.openSection("privacy");
    await settings.privacySection.verifySwitch(true, "On across your devices");
    await settings.privacySection.verifyExplains(
      "Shares which features you use, never what you watch, read or type, so we can improve the app.",
    );

    await settings.privacySection.switchShareUsage();

    await settings.privacySection.verifySwitch(false, "Off across your devices since today");
    await test
      .expect.poll(async () => (await backendSimulator.settingsStore.get()).analyticsOptOut)
      .toBe(true);
    const sent = backendSimulator.analytics.eventNames();
    test.expect(sent.at(-1)).toBe("analyticsConsent.settings.switched");

    await launcher.appShell.clickBrand();
    await launcher.appShell.openSettings();
    test.expect(backendSimulator.analytics.eventNames()).toEqual(sent);
  });

  test("turning it back on reads as on across the devices since today", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await launcher.appShell.openSettings();
    await settings.openSection("privacy");
    await settings.privacySection.switchShareUsage();

    await settings.privacySection.switchShareUsage();

    await settings.privacySection.verifySwitch(true, "On across your devices since today");
  });
});

// Design 62i.
test("About links the privacy policy and the terms under the version", async ({ launcher, page }) => {
  await launcher.launch({ build: BUILD });
  const settings = await launcher.appShell.openSettings();

  await settings.openSection("about");

  const about = page.getByRole("region", { name: "About" });
  await test.expect(about.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", /\/privacy$/);
  await test.expect(about.getByRole("link", { name: "Terms" })).toHaveAttribute("href", /\/terms$/);
});
