import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

test("the extension says its library is its own, where an empty shelf would otherwise be a mystery", async ({
  launcher,
}) => {
  const home = await launcher.launch({ surface: "extension" });
  await home.verifyShowsFirstRunHero();
  await home.verifyShowsSeparateLibraryNote();

  const settings = await launcher.appShell.openSettings();
  await settings.verifySeparateLibraryNote();
});

test("the web app, which has no second library to be confused with, says none of it", async ({
  launcher,
}) => {
  const home = await launcher.launch({ surface: "web" });
  await home.verifyHasNoSeparateLibraryNote();

  const settings = await launcher.appShell.openSettings();
  await settings.verifyHasNoSeparateLibraryNote();
});

test("a run in the side panel admits that closing the panel stops it, unlike closing the dialog", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS, surface: "extension" });
  await form.submitUrl(VALID_URL);

  await launcher.appShell.newOverviewDialog.verifyFootNote(/Closing the side panel does stop it\./);
});

test("the same run on the web promises only that the dialog can be closed", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS, surface: "web" });
  await form.submitUrl(VALID_URL);

  await launcher.appShell.newOverviewDialog.verifyFootNote(/^You can close this — it keeps going\.$/);
});
