import { test } from "../../support/fixtures.testHelper.js";

test("keys saved on the settings page unlock the header's generate form", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();

  const settings = await launcher.appShell.openSettings();
  await settings.apiKeysPanel.saveKeys("sk-ant-test", "sd-test");
  await settings.verifySavedConfirmation();

  await settings.clickBackToOverviews();
  await form.verifyGenerateButtonEnabled();
});

test("the form's own settings link reaches the same page", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.clickSettingsLink();
  await launcher.appShell.generateForm.verifyUrlInputDisabled();
});
