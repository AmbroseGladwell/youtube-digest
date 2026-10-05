import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import {
  ANONYMOUS_ID,
  makeAnalyticsConsent,
} from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";

const NEVER_ASKED = { analyticsConsent: null } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const storedConsent = (page: import("@playwright/test").Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("overview.analyticsConsent.v1") ?? "null"));

// Design 62: a reader without an account is asked, once, whether to share usage, and
// nothing is sent for them until they say yes (docs/features/analytics-consent.md).
test.describe("asking a reader without an account", () => {
  // Design 62a.
  test("the library asks, says what is counted, and sends nothing while it waits", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(makeOverview());
    await launcher.launchExpectingLibrary({ sync: true, ...NEVER_ASKED });

    await launcher.analyticsConsentPrompt.verifyAsksFirst();
    await launcher.analyticsConsentPrompt.verifyPrivacyLink(/\/privacy$/, false);
    await launcher.analyticsConsentPrompt.verifyAnswersLookAlike();
    await launcher.accountStrip.verifyIsAbsent();

    await launcher.appShell.openSettings();
    await launcher.appShell.clickBrand();

    await launcher.analyticsConsentPrompt.verifyAsksFirst();
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
  });

  // Design 62c.
  test("a yes keeps a random id on the device and sends the reader's usage under it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await launcher.launch(NEVER_ASKED);

    await launcher.analyticsConsentPrompt.share();

    await launcher.analyticsConsentNotice.verifyReads("Sharing usage.");
    await launcher.analyticsConsentPrompt.verifyIsAbsent();
    const consent = await storedConsent(page);
    test.expect(consent).toMatchObject({ answer: "share", purposesVersion: 1 });
    test.expect(consent.anonymousId).toMatch(UUID);

    await launcher.appShell.openSettings();
    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toContain("app.accountMenu.itemChosen");
    test.expect(backendSimulator.analytics.events()[0]).toEqual({
      name: "analyticsConsent.prompt.accepted",
      props: { asked: "first" },
    });
    test
      .expect(backendSimulator.analytics.batches().map(({ anonymousId }) => anonymousId))
      .toEqual(backendSimulator.analytics.batches().map(() => consent.anonymousId));
  });

  // Design 62c.
  test("a no is remembered, keeps no id, and sends nothing", async ({ launcher, backendSimulator, page }) => {
    await launcher.launch(NEVER_ASKED);

    await launcher.analyticsConsentPrompt.dontShare();

    await launcher.analyticsConsentNotice.verifyReads("Not sharing usage.");
    test.expect(await storedConsent(page)).toMatchObject({ answer: "dontShare", anonymousId: null });

    await launcher.appShell.openSettings();
    await launcher.appShell.clickBrand();

    await launcher.analyticsConsentPrompt.verifyIsAbsent();
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
  });

  test("a no is told to the server once, with the app's context and no id", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(NEVER_ASKED);

    await launcher.analyticsConsentPrompt.dontShare();

    await test.expect.poll(() => backendSimulator.analytics.declines()).toEqual([
      { context: { surface: "web", layout: "full", appVersion: null, platform: test.expect.any(String) } },
    ]);
  });

  test("a yes is not a decline", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(NEVER_ASKED);
    await launcher.analyticsConsentPrompt.share();

    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toContain("analyticsConsent.prompt.accepted");
    test.expect(backendSimulator.analytics.declines()).toEqual([]);
  });

  test("closing the notice gives the slot back to the account offer", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(makeOverview());
    await launcher.launchExpectingLibrary({ sync: true, ...NEVER_ASKED });
    await launcher.analyticsConsentPrompt.dontShare();

    await launcher.analyticsConsentNotice.dismiss();

    await launcher.analyticsConsentNotice.verifyIsAbsent();
    await launcher.accountStrip.verifyOffersAnAccount();
  });

  test("the prompt is on the library only, not on Settings", async ({ launcher }) => {
    await launcher.launch(NEVER_ASKED);

    await launcher.appShell.openSettings();

    await launcher.analyticsConsentPrompt.verifyIsAbsent();
  });

  test("the panel asks above its home, and opens the policy in a tab of its own", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launchPanel({ defaultApiUrl: "https://sync.test", ...NEVER_ASKED });

    await launcher.analyticsConsentPrompt.verifyAsksFirst();
    await launcher.analyticsConsentPrompt.verifyPrivacyLink(/^https:\/\/sync\.test\/privacy$/, true);

    await launcher.analyticsConsentPrompt.share();

    await launcher.analyticsConsentNotice.verifyReads("Sharing usage.");
    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toEqual(["analyticsConsent.prompt.accepted"]);
  });

  test("a panel with no server to send to asks nothing", async ({ launcher }) => {
    await launcher.launchPanel(NEVER_ASKED);

    await launcher.analyticsConsentPrompt.verifyIsAbsent();
  });
});

test.describe("signed in", () => {
  test("a signed-in reader is never asked, and is counted under the session without the anonymous id", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await launcher.launch({
      sync: true,
      syncConnection: {
        apiUrl: "https://sync.test",
        token: null,
        accountId: SIMULATED_ACCOUNT_ID,
        email: SIMULATED_EMAIL,
        firstName: "Ada",
      },
      analyticsConsent: makeAnalyticsConsent({ answer: "share", anonymousId: ANONYMOUS_ID }),
    });

    await launcher.analyticsConsentPrompt.verifyIsAbsent();
    await test.expect.poll(async () => (await storedConsent(page)).anonymousId).toBeNull();

    await launcher.appShell.openSettings();
    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toContain("app.accountMenu.itemChosen");
    test.expect(backendSimulator.analytics.batches().every(({ anonymousId }) => anonymousId === undefined)).toBe(true);
  });
});
