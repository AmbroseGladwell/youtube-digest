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

test("the reader context and sections in Settings are what the next overview is made from", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const sectionsEnabled = { ...DEFAULT_SECTIONS_ENABLED, selling: false };
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["nurse"], time: [], focus: ["new recipes"] }, sectionsEnabled });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  const [request] = backendSimulator.ourKey.generations();
  expect(request?.input.readerContext).toBe("I'm a nurse, and right now I'm focusing on new recipes.");
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
  await settings.verifyRowReads("personalisation", "About you not set · 5 of 6 sections");
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
  await settings.personalisation.verifyAboutYouIsNotSet();

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.fill("who", "parent");
  await settings.personalisation.sentence.fill("time", "teaching");
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a parent, and I spend my time on teaching.");
  await settings.verifyRowReads("personalisation", "A parent · Every section");
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I'm a parent, and I spend my time on teaching.");

  const again = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await again.personalisation.clearAboutYou();
  await again.personalisation.verifyAboutYouIsNotSet();
});

test("a pick in Settings is kept when the card's Done is pressed with the sheet still open", async ({ launcher }) => {
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.openSection("who");
  await settings.personalisation.sentence.pick("parent");
  await settings.personalisation.sentence.verifySentenceReads(
    "I'm a parent, I spend my time on all sorts, and right now I'm focusing on getting better at something.",
  );
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a parent.");
});

test("the sentence reopens in Settings as it was left, and an old line can be seen and edited", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, aboutYou: { who: ["dad"], time: ["A nurse learning to cook"], focus: [] } });
  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifyAboutYouReads("I'm a dad, and I spend my time on A nurse learning to cook.");

  await settings.personalisation.openAboutYou();
  await settings.personalisation.sentence.openSection("time");
  await settings.personalisation.sentence.verifyInSection("A nurse learning to cook");
  await settings.personalisation.sentence.remove("A nurse learning to cook");
  await settings.personalisation.sentence.pick("healthcare");
  await settings.personalisation.sentence.done();
  await settings.personalisation.closeAboutYou();

  await settings.personalisation.verifyAboutYouReads("I'm a dad, and I spend my time on healthcare.");
});
