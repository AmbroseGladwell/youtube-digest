import { DEFAULT_SECTIONS_ENABLED } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

// Overviews made on us, so the simulator holds the input each one was made from.
const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

test("the reader context and sections in Settings are what the next overview is made from", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const sectionsEnabled = { ...DEFAULT_SECTIONS_ENABLED, selling: false };
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, readerContext: "A nurse learning to cook.", sectionsEnabled });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  const [request] = backendSimulator.ourKey.generations();
  expect(request?.input.readerContext).toBe("A nurse learning to cook.");
  expect(request?.input.sectionsEnabled).toEqual(sectionsEnabled);
});

test("turning a section off in Settings › Personalisation leaves it out of the next overview, and is counted", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.verifyRowReads("personalisation", "Every section");

  await settings.personalisation.clickSwitch("watchAnyway");

  await settings.personalisation.verifySwitchIs("Watch it anyway?", false);
  await settings.personalisation.verifySwitchIs("Verdict", true);
  await settings.verifyRowReads("personalisation", "3 of 4 sections");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.personalisation.")))
    .toEqual([{ name: "settings.personalisation.sectionSwitched", props: { section: "watchAnyway", on: false } }]);

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  const [request] = backendSimulator.ourKey.generations();
  expect(request?.input.sectionsEnabled).toEqual({ ...DEFAULT_SECTIONS_ENABLED, watchAnyway: false });
});
