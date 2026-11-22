import { test } from "../../support/fixtures.testHelper.js";
import { keysFor } from "../../support/apiKeysSeed.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";

const CHOSE_GEMINI_ELSEWHERE = {
  apiKeys: keysFor("anthropic"),
  provider: "gemini" as const,
};

test("a provider chosen on another device, with no key here, is a dead end with both ways out", async ({ launcher }) => {
  await launcher.launch(CHOSE_GEMINI_ELSEWHERE);
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.verifyNoKeyHereDeadEnd();
});

test("the row says in words that the key is missing here, which a count cannot", async ({ launcher }) => {
  await launcher.launch(CHOSE_GEMINI_ELSEWHERE);
  const settings = await launcher.appShell.openSettings();

  await settings.verifyRowReads("keys", /no Gemini key here$/);
});

test("taking the other key out of the dead end changes the choice, and generation is possible again", async ({ launcher }) => {
  await launcher.launch(CHOSE_GEMINI_ELSEWHERE);
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.useFallbackKey();

  await settings.apiKeysPanel.verifyInUse("anthropic");
  await settings.verifyRowReads("keys", /· 1 key$/);
});

test("the home hero carries the dead end rather than a button that would fail", async ({ launcher }) => {
  const home = await launcher.launch(CHOSE_GEMINI_ELSEWHERE);

  await home.verifyKeyPromptDeadEnd();
});

test("the model picker offers the ones we describe by name", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.openModelPicker("anthropic");

  await settings.modelPicker.verifyIsShown();
  await settings.modelPicker.verifyOffers("claude-sonnet-5-5");
});

test("the picker closes from its own close button, leaving the keys section behind it", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.openModelPicker("anthropic");
  await settings.modelPicker.verifyIsShown();

  await settings.modelPicker.close();

  await settings.verifySectionIsShown("keys");
  await settings.apiKeysPanel.verifyKeyHeld("anthropic");
});

test("choosing a model closes the picker rather than leaving it open behind the choice", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.openModelPicker("anthropic");

  await settings.modelPicker.chooseModel("claude-haiku-5-5");

  await settings.verifySectionIsShown("keys");
});

test("choosing a model saves it against that provider and shows on its row", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.openModelPicker("anthropic");

  await settings.modelPicker.chooseModel("claude-haiku-5-5");

  await settings.apiKeysPanel.verifyModelReads("anthropic", "Claude Haiku 5.5");
});

test("a provider that will not list its models falls back to the ones we know, without an error", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ apiKeys: keysFor("anthropic") });
  backendSimulator.simulateEndpointError(EndpointKey.PROVIDER_MODELS);
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.openModelPicker("anthropic");

  await settings.modelPicker.verifyFellBackToKnownModels();
  await settings.modelPicker.verifyOffers("claude-opus-5-5");
});

test("every key can be taken off the device at once, and the panel goes back to asking", async ({ launcher }) => {
  await launcher.launch({ apiKeys: keysFor("anthropic", "openai") });
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.removeAllKeys();

  await settings.apiKeysPanel.verifyNoKeyHeld("anthropic");
  await settings.apiKeysPanel.verifyNoKeyHeld("openai");
  await settings.verifyRowReads("keys", "No keys yet");
});
