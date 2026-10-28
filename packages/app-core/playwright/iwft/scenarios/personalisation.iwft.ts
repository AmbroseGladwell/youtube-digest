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
  await settings.verifyRowReads("personalisation", "About you not set · Every section");

  await settings.personalisation.clickSwitch("watchAnyway");

  await settings.personalisation.verifySwitchIs("Watch it anyway?", false);
  await settings.personalisation.verifySwitchIs("Verdict", true);
  await settings.verifyRowReads("personalisation", "About you not set · 3 of 4 sections");
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

test("About you set in Settings › Personalisation is what the next overview is written for, and can be cleared", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifyAboutYouReads("Not set, so overviews are written for anyone.");

  await settings.personalisation.setAboutYou({ role: "Teaching", goals: ["Tech"] });

  await settings.personalisation.verifyAboutYouReads("A teacher, learning about tech.");
  await settings.verifyRowReads("personalisation", "A teacher, learning about tech. · Every section");
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("A teacher, learning about tech.");

  const again = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await again.personalisation.clearAboutYou();
  await again.personalisation.verifyAboutYouReads("Not set, so overviews are written for anyone.");
});
