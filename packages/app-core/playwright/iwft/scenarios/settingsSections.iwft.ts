import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";

const PHONE = { width: 390, height: 800 };
const BUILD = { version: "0.14.2", commit: "30bb95a", dirty: false };
const EVERYTHING = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
  apiKeys: { anthropicApiKey: "sk-ant-test", supadataApiKey: null },
  narrationVoice: "bm_george" as const,
  plan: "plus" as const,
  build: BUILD,
};

test("on a wide screen, Settings opens beside its first section, and every row carries its value", async ({
  launcher,
}) => {
  await launcher.launch(EVERYTHING);
  const settings = await launcher.appShell.openSettings();

  await settings.verifyRowsAre(["account", "voice", "keys", "plan", "about"]);
  await settings.verifyCurrentRow("account");
  await settings.verifySectionIsShown("account");
  await settings.verifyRowReads("account", /^Ada · (Synced|Connected)/);
  await settings.verifyRowReads("voice", "George · British English");
  await settings.verifyRowReads("keys", /^Anthropic key set · /);
  await settings.verifyRowReads("plan", "Plus");
  await settings.verifyRowReads("about", "Version 0.14.2");
});

test("choosing a row swaps the section beside the list and moves focus to its heading", async ({ launcher }) => {
  await launcher.launch(EVERYTHING);
  const settings = await launcher.appShell.openSettings();

  await settings.openSection("keys");

  await settings.verifyCurrentRow("keys");
  await settings.verifySectionIsAbsent("account");
  await settings.verifyListIsShown(true);
  await settings.verifySectionHeadingIsFocused("keys");
});

test("a section's own address opens it beside the list", async ({ launcher }) => {
  await launcher.launch(EVERYTHING);
  await launcher.openPage(Routes.settingsSection("plan"));

  const settings = await launcher.settingsPage.verifyIsShown();
  await settings.verifyCurrentRow("plan");
  await settings.verifyPlanReads("Plus");
});

test("on a phone the list is the page, and each row opens its section with the way back", async ({
  page,
  launcher,
}) => {
  await page.setViewportSize(PHONE);
  await launcher.launch(EVERYTHING);
  await launcher.openPage(Routes.settings());
  const settings = await launcher.settingsPage.verifyIsShown();
  await settings.verifyListIsShown(true);
  await settings.verifySectionIsAbsent("account");

  await settings.openSection("about");
  await settings.verifyListIsShown(false);
  await settings.verifySectionHeadingIsFocused("about");
  await settings.verifyBuildLineReads("Version 0.14.2 (30bb95a)");

  await settings.clickBackToSettings();
  await settings.verifySectionIsAbsent("about");
  await settings.clickBackToOverviews();
  await launcher.homePage.verifyIsShown();
});

test("arriving on the voice section keeps the reader's voice in view, even far down the list", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.narration.seedSamples();
  await page.setViewportSize({ width: 1200, height: 500 });
  await launcher.launch({ ...EVERYTHING, narrationVoice: "af_sarah" });
  await launcher.openPage(Routes.settingsSection("voice"));

  const settings = await launcher.settingsPage.verifyIsShown();
  await settings.verifySectionHeadingIsFocused("voice");
  await settings.voicePicker.verifyChosenRowIsInView("af_sarah");
});
