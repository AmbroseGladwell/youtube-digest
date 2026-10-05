import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test" };

test("a successful generation ends up in the library, and opens in the reader when asked", async ({
  launcher,
}) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  await home.verifyShowsFirstRunHero();
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await dialog.clickReadOverview();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The Simulated Video");

  const library = await reader.clickBackToLibrary();
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("The Simulated Video").verifyTitle("The Simulated Video");
});

test("a live link shared from the iOS app makes a note, stored under the plain watch link", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(`https://www.youtube.com/live/${IWFT_VIDEO_ID}?is=2_N5yomNqBmNf2yl`);
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");

  const [overview] = await backendSimulator.overviewStore.listOverviews();
  expect(overview?.video.url).toBe(VALID_URL);
});

test("the transcript-fetch phase surfaces its error, and generation never reaches Anthropic", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SERVICE_TRANSCRIPT);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyGenerationError("Simulated: our server has fetched all the transcripts it can for today.");

  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("a stalled transcript fetch holds the first step there, with nothing claimed about the second", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.SERVICE_TRANSCRIPT);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);

  await dialog.verifyStepState("01", "running");
  await dialog.verifyStepDetail("01", "Reading captions from YouTube");
  await dialog.verifyStepState("02", "waiting");
  await dialog.verifyStepDetail("02", "Queued");
});

test("a failed generation call surfaces its error without saving anything to the library", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyGenerationErrorIsVisible();

  const overviews = await backendSimulator.overviewStore.listOverviews();
  expect(overviews).toHaveLength(0);
});
