import { test } from "../../support/fixtures.testHelper.js";

test("keys saved on the settings page unlock the dialog's generate form", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
  await form.clickCancel();

  const settings = await launcher.appShell.openSettings();
  await settings.apiKeysPanel.saveKeys("sk-ant-test", "sd-test");
  await settings.verifySavedConfirmation();

  await settings.clickBackToOverviews();
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyGenerateButtonEnabled();
});

test("the form's own settings link reaches the same page, and closes the dialog behind it", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.clickSettingsLink();

  await launcher.settingsPage.verifyIsShown();
  await launcher.appShell.newOverviewDialog.verifyIsHidden();
});
