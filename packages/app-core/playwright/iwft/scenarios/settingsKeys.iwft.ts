import { test } from "../../support/fixtures.testHelper.js";

test("keys saved on the settings page unlock the dialog's generate form", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
  await form.clickCancel();

  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.saveKeys("sk-ant-test", "sd-test");
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

// The Supadata key stopped being required the moment a browser could fetch captions
// itself, so the panel has to say which of those is true here
// (docs/features/transcript-retrieval.md).
test("a browser that fetches its own captions says the transcript key is not needed", async ({
  launcher,
}) => {
  await launcher.launch({ youTubeFetch: true });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.verifySupadataNoteReads(/Not needed here/);
});

test("a key saved on a browser that does not need it is reported as saved but unused", async ({
  launcher,
}) => {
  await launcher.launch({
    apiKeys: { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" },
    youTubeFetch: true,
  });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.verifySupadataNoteReads(/Saved, but not in use/);
});

test("a browser that cannot reach YouTube is told when the key is the thing that would", async ({
  launcher,
}) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.verifySupadataNoteReads(/Only needed where nothing else/);
});

test("the Anthropic key alone unlocks generation where captions come for free", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: { anthropicApiKey: "sk-ant-test", supadataApiKey: null },
    youTubeFetch: true,
  });

  await form.verifyGenerateButtonEnabled();
});
