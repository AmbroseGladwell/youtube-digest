import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const settingsEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings."));

test("opening a section, sampling a voice and choosing one are counted by the section and voice's own names", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.narration.seedSamples();
  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("voice");
  const picker = await settings.voicePicker.verifyIsShown();

  await picker.playSample("bm_george");
  await picker.stopSample("bm_george");
  await picker.chooseVoice("bm_george");

  await expect
    .poll(() => settingsEvents(backendSimulator))
    .toEqual([
      { name: "settings.page.sectionOpened", props: { section: "voice" } },
      { name: "settings.voice.samplePlayed", props: { voice: "bm_george" } },
      { name: "settings.voice.sampleStopped", props: { voice: "bm_george" } },
      { name: "settings.voice.chosen", props: { voice: "bm_george" } },
    ]);
});

test("saving keys says which are set and the model chosen, and never a key", async ({ launcher, backendSimulator }) => {
  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("keys");

  await settings.apiKeysPanel.saveKeys("sk-ant-test-typed");

  await expect
    .poll(() => settingsEvents(backendSimulator).filter(({ name }) => name === "settings.apiKeys.saved"))
    .toEqual([
      {
        name: "settings.apiKeys.saved",
        props: { anthropicKey: true, model: expect.any(String), modelChanged: false },
      },
    ]);
  expect(JSON.stringify(backendSimulator.analytics.batches())).not.toContain("sk-ant-test-typed");
});
