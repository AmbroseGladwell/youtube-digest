import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

test("a successful generation transitions the home page from the first-run hero to the library, with the new card expanded", async ({
  launcher,
}) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  const form = await home.verifyShowsFirstRunHero();
  await form.submitUrl(VALID_URL);

  const library = await home.verifyShowsLibrary();
  await library.expectCardCountToBe(1);
  const card = library.cardWithTitle("The Simulated Video");
  await card.verifyIsExpanded();
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
