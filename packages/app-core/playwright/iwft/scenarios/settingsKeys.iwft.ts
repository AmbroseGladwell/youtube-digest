import { test } from "../../support/fixtures.testHelper.js";

test("keys saved on the settings page unlock the dialog's generate form", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
  await form.clickCancel();

  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.saveKeys("sk-ant-test");
  await settings.verifySavedConfirmation();
  await settings.verifyRowReads("keys", /^Anthropic key set · /);

  await settings.clickBackToOverviews();
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyGenerateButtonEnabled();
});

test("the form's own settings link lands on the keys section, and closes the dialog behind it", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.clickSettingsLink();

  await launcher.settingsPage.verifySectionIsShown("keys");
  await launcher.settingsPage.verifyCurrentRow("keys");
  await launcher.appShell.newOverviewDialog.verifyIsHidden();
});

// Nothing but the Anthropic key is ever asked for: the extension fetches captions itself, and
// the web app asks our server (docs/features/transcript-retrieval.md).
test("a web reader writes with the Anthropic key alone, because our server fetches the transcript", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: { anthropicApiKey: "sk-ant-test" } });

  await form.verifyGenerateButtonEnabled();
});

test("with our server's fetching off and no extension, the Anthropic key alone is not enough", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.serviceIsOff();
  const form = await launcher.launchExpectingFirstRun({ apiKeys: { anthropicApiKey: "sk-ant-test" } });

  await form.verifyUrlInputDisabled();
});

test("the Anthropic key alone unlocks generation where captions come for free", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: { anthropicApiKey: "sk-ant-test" },
    youTubeFetch: true,
  });

  await form.verifyGenerateButtonEnabled();
});
