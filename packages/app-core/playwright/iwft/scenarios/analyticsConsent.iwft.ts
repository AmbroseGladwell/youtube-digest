import type { Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import {
  SIMULATED_ACCOUNT_ID,
  SIMULATED_EMAIL,
  type BackendSimulator,
} from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import {
  ANONYMOUS_ID,
  makeAnalyticsConsent,
} from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";

const NEVER_ASKED = { analyticsConsent: null } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

const storedConsent = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("overview.analyticsConsent.v1") ?? "null"));

const verifyNothingAsks = async (page: Page) => {
  await test.expect(page.getByText(/improve The Overview\?/)).toHaveCount(0);
  await test.expect(page.getByRole("button", { name: /^(Allow|No thanks)$/ })).toHaveCount(0);
};

// OV-101: onboarding's screen (design 46b) is the only place a reader without an account is
// asked; the library and the panel's home have no strip (docs/features/analytics-consent.md).
test.describe("nowhere but onboarding asks", () => {
  test("Start asks nothing until a link is given, and sends nothing", async ({ launcher, backendSimulator, page }) => {
    await launcher.launch({ sync: true, ...NEVER_ASKED });

    await verifyNothingAsks(page);
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
  });

  test("the library asks nothing, and sends nothing", async ({ launcher, backendSimulator, page }) => {
    await launcher.launch(NEVER_ASKED);

    await verifyNothingAsks(page);
    await launcher.appShell.openSettings();
    await launcher.appShell.clickBrand();
    await verifyNothingAsks(page);
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
  });

  test("the panel's home asks nothing, and sends nothing", async ({ launcher, backendSimulator, page }) => {
    await launcher.launchPanel({ defaultApiUrl: "https://sync.test", ...NEVER_ASKED });

    await verifyNothingAsks(page);
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
  });
});

test.describe("answering in onboarding", () => {
  const startOnboarding = async (launcher: Launcher, backendSimulator: BackendSimulator) => {
    backendSimulator.ourKey.isAvailable();
    const home = await launcher.launch({ sync: true, ...NEVER_ASKED });
    await home.submitHeroUrl(VIDEO_URL);
    const onboarding = await launcher.onboardingPage.verifyIsShown();
    await onboarding.verifyOnScreen("analytics");
    return onboarding;
  };

  test("Allow keeps a random id on the device and sends the reader's usage under it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const onboarding = await startOnboarding(launcher, backendSimulator);

    await onboarding.allowAnalytics();

    await onboarding.verifyOnScreen("video");
    const consent = await storedConsent(page);
    test.expect(consent).toMatchObject({ answer: "share", purposesVersion: 1 });
    test.expect(consent.anonymousId).toMatch(UUID);
    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toContain("analyticsConsent.prompt.accepted");
    test
      .expect(backendSimulator.analytics.batches().map(({ anonymousId }) => anonymousId))
      .toEqual(backendSimulator.analytics.batches().map(() => consent.anonymousId));
    test.expect(backendSimulator.analytics.declines()).toEqual([]);
  });

  test("No thanks is remembered with no id, and told to the server once with the app's context alone", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const onboarding = await startOnboarding(launcher, backendSimulator);

    await onboarding.declineAnalytics();

    await onboarding.verifyOnScreen("video");
    test.expect(await storedConsent(page)).toMatchObject({ answer: "dontShare", anonymousId: null });
    await test.expect.poll(() => backendSimulator.analytics.declines()).toEqual([
      { context: { surface: "web", layout: "full", appVersion: null, platform: test.expect.any(String) } },
    ]);
    test.expect(backendSimulator.analytics.batches()).toEqual([]);
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

    await verifyNothingAsks(page);
    await test.expect.poll(async () => (await storedConsent(page)).anonymousId).toBeNull();

    await launcher.appShell.openSettings();
    await test.expect.poll(() => backendSimulator.analytics.eventNames()).toContain("app.accountMenu.itemChosen");
    test.expect(backendSimulator.analytics.batches().every(({ anonymousId }) => anonymousId === undefined)).toBe(true);
  });
});
