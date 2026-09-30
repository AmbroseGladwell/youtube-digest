import { expect, test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";

const NOTE = makeOverview({
  inOneLine: "A talking-head explainer about three data points.",
  coreClaim: "The economy may finally be improving.",
  keyPoints: ["Growth beat expectations.", "Productivity is moving.", "Hiring intent has turned."],
});

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

test("a reader hears a sample, chooses that voice, and the next note is asked for in it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.narration.seedSamples();
  backendSimulator.overviews.seed(NOTE);
  await launcher.launchExpectingLibrary(SIGNED_IN);
  const settings = await launcher.appShell.openSettings();
  const picker = await settings.voicePicker.verifyIsShown();
  await picker.verifyChosen("af_heart");
  await picker.verifyRowSecondLineReads("af_heart", "Your voice");
  await picker.verifyPlayButtonName("bm_george", "Play sample: George, British");

  await picker.playSample("bm_george");
  await picker.verifySampleIsPlaying("bm_george", true);
  await picker.verifyRowSecondLineReads("bm_george", /^Playing · 0:0\d of 0:20$/);
  await picker.chooseVoice("bm_george");

  await picker.verifyChosen("bm_george");
  await picker.verifyStatusSays(/^George is your voice now\. New audio uses it on every device\./);
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).narrationVoice).toBe("bm_george");

  await launcher.openPage(Routes.overview(NOTE.id));
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyBarSays("Audio is made on first play · about 20 s");
  await reader.clickPlayPause();
  await expect.poll(() => backendSimulator.narration.requestedVoices()).toEqual(["bm_george"]);
});

test("one sample plays at a time: pressing another stops the first", async ({ launcher, backendSimulator }) => {
  backendSimulator.narration.seedSamples();
  await launcher.launch(SIGNED_IN);
  const picker = await (await launcher.appShell.openSettings()).voicePicker.verifyIsShown();

  await picker.playSample("bf_emma");
  await picker.verifySampleIsPlaying("bf_emma", true);
  await picker.playSample("am_puck");

  await picker.verifySampleIsPlaying("am_puck", true);
  await picker.verifySampleIsPlaying("bf_emma", false);
  await picker.stopSample("am_puck");
  await picker.verifySampleIsPlaying("am_puck", false);
});

test("samples that do not load leave every voice choosable, and trying again brings them back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.narration.seedSamples();
  backendSimulator.simulateEndpointError(EndpointKey.NARRATION_SAMPLES);
  await launcher.launch(SIGNED_IN);
  const picker = await (await launcher.appShell.openSettings()).voicePicker.verifyIsShown();

  await picker.verifySamplesDidNotLoad();
  await picker.verifyOffersSamples(false);
  await picker.chooseVoice("bf_isabella");
  await picker.verifyChosen("bf_isabella");

  backendSimulator.simulateEndpointDefault(EndpointKey.NARRATION_SAMPLES);
  await picker.clickTryAgain();
  await picker.verifyOffersSamples(true);
});

test("signed out, there is no narration to choose a voice for, so there is no picker", async ({ launcher }) => {
  await launcher.launch();
  const settings = await launcher.appShell.openSettings();

  await settings.voicePicker.verifyIsAbsent();
});

test("a note narrated before the reader chose another voice plays as it was, and re-records in the new one", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE, "af_heart");
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, narrationVoice: "bf_emma" });
  const reader = await library.nthCard(0).openReader();

  await reader.verifyBarSays(/^Narrated · Heart voice/);
  await reader.verifyOffersReRecord("Re-record in Emma");

  await reader.clickReRecord();
  await reader.verifyBarSays(/^Preparing audio/);
  backendSimulator.narration.finishRenders();

  await reader.verifyBarSays(/^Now playing/);
  await reader.verifyOffersReRecord(null);
  expect(backendSimulator.narration.requestedVoices()).toEqual(["bf_emma"]);
  await expect.poll(() => backendSimulator.narration.isStored(NOTE, "af_heart")).toBe(false);
  expect(backendSimulator.narration.isStored(NOTE, "bf_emma")).toBe(true);
});

test("the voice the bar names opens Settings with that voice in view", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(NOTE);
  backendSimulator.narration.seedReady(NOTE, "af_heart");
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  await reader.verifyBarSays("Narrated · Heart voice");

  const settings = await reader.openVoiceSettingFromBar();

  const picker = await settings.voicePicker.verifyIsShown();
  await picker.verifyChosen("af_heart");
  await picker.verifyChosenRowIsInView("af_heart");
});

test("the panel keeps Settings short: one row names the voice and opens the list on its own page", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.narration.seedSamples();
  await launcher.launchPanel({ ...SIGNED_IN, narrationVoice: "bm_fable" });
  const settings = await launcher.appShell.openSettings();

  await settings.verifyVoiceRowReads("FableBritish English · hear the others");
  const voices = await settings.openVoiceList();
  await voices.voicePicker.verifyChosen("bm_fable");
  await voices.voicePicker.verifyChosenRowIsInView("bm_fable");
  await voices.voicePicker.chooseVoice("af_nova");

  const back = await voices.clickBackToSettings();
  await back.verifyVoiceRowReads("NovaAmerican English · hear the others");
});
