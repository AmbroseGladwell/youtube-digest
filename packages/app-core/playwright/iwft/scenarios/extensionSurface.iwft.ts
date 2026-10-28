import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = ANTHROPIC_KEY;

test("the extension says its library is its own, where an empty shelf would otherwise be a mystery", async ({
  launcher,
}) => {
  const home = await launcher.launch({ surface: "extension" });
  await home.verifyShowsFirstRunHero();
  await home.verifyShowsSeparateLibraryNote();
});

test("signed out, the extension's Settings says signing in keeps its library in step", async ({ launcher }) => {
  await launcher.launch({ surface: "extension", sync: true });

  const settings = await (await launcher.appShell.openSettings()).openSection("account");
  await settings.verifyRowReads("account", "Not signed in");
  await settings.syncPanel.verifyHintReads(/^Sign in with your email, and the extension keeps your library in step/);
});

test("the web app, which has no second library to be confused with, says none of it", async ({
  launcher,
}) => {
  const home = await launcher.launch({ surface: "web", sync: true });
  await home.verifyHasNoSeparateLibraryNote();

  const settings = await (await launcher.appShell.openSettings()).openSection("account");
  await settings.syncPanel.verifyHintReads(/^Sign in with your email, and this browser keeps your library in step/);
});

test("a run in the side panel admits that closing the panel stops it, unlike closing the dialog", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS, surface: "extension", youTubeFetch: true });
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
