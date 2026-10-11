import { test } from "../../support/fixtures.testHelper.js";
import { ANTHROPIC_KEY, keysFor } from "../../support/apiKeysSeed.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";

test("a key added on the settings page unlocks the dialog's generate form", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
  await form.clickCancel();

  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.addKey("anthropic", "sk-ant-test");

  await settings.apiKeysPanel.verifyKeyHeld("anthropic");
  await settings.verifyRowReads("keys", /· 1 key$/);

  await settings.clickBackToOverviews();
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.verifyGenerateButtonEnabled();
});

// The first key saved becomes what generation runs on; later ones never change it, because
// a reader adding a second provider to compare has not asked for their next overview to be
// made with it (design 110d).
test("the first key becomes the choice, and a second one does not take it", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.addKey("anthropic", "sk-ant-test");
  await settings.apiKeysPanel.verifyInUse("anthropic");

  await settings.apiKeysPanel.addKey("openai", "sk-oa-test");

  await settings.apiKeysPanel.verifyKeyHeld("openai");
  await settings.apiKeysPanel.verifyInUse("anthropic");
});

test("a key the provider refuses is not saved, and says so on its own row", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.PROVIDER_MODELS);
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.addKey("openai", "sk-oa-wrong");

  await settings.apiKeysPanel.verifyRefused("openai");
  await settings.apiKeysPanel.verifyNoKeyHeld("openai");
});

// Design 110i: removing the key in use moves generation to another key this device holds,
// and the overviews it made are untouched.
test("removing the key in use moves generation to another key this device holds", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic", "openai") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.verifyInUse("anthropic");

  await settings.apiKeysPanel.removeKey("anthropic");

  await settings.apiKeysPanel.verifyNoKeyHeld("anthropic");
  await settings.apiKeysPanel.verifyInUse("openai");
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

// Nothing but one provider key is ever asked for: the extension fetches captions itself,
// and the web app asks our server (docs/features/transcript-retrieval.md).
test("a web reader writes with one provider key alone, because our server fetches the transcript", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_KEY });

  await form.verifyGenerateButtonEnabled();
});

test("with our server's fetching off and no extension, the provider key alone is not enough", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.serviceIsOff();
  const form = await launcher.launchExpectingFirstRun({ apiKeys: ANTHROPIC_KEY });

  await form.verifyUrlInputDisabled();
});

test("the provider key alone unlocks generation where captions come for free", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun({
    apiKeys: ANTHROPIC_KEY,
    youTubeFetch: true,
  });

  await form.verifyGenerateButtonEnabled();
});
