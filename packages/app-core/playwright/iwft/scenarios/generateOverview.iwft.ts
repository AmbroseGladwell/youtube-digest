import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

test("a successful generation opens what it just wrote in the reader, and the library has it too", async ({
  launcher,
}) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  await home.verifyShowsFirstRunHero();
  const form = await launcher.appShell.openNewOverview();
  await form.submitUrl(VALID_URL);

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The Simulated Video");

  const library = await reader.clickBackToLibrary();
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("The Simulated Video").verifyTitle("The Simulated Video");
});

test("the transcript-fetch phase surfaces its error, and generation never reaches Anthropic", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SUPADATA_METADATA);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyGenerationError("Unauthorized");

  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("a stalled transcript fetch shows the fetching-transcript progress message and stays there", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.SUPADATA_METADATA);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyProgressShows("Fetching the transcript…");
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
