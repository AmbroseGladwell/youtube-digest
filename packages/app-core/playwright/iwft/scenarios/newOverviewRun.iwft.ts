import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const PHONE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 900 };

for (const [name, viewport] of [
  ["on a phone", PHONE],
  ["on a desktop", DESKTOP],
] as const) {
  test(`${name} the paste field lives behind + New, in a dialog Escape closes`, async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seed(makeOverview());
    await page.setViewportSize(viewport);
    await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });

    const dialog = launcher.appShell.newOverviewDialog;
    await dialog.verifyIsHidden();

    await launcher.appShell.openNewOverview();
    await dialog.form.verifyUrlInputVisible();

    await dialog.pressEscape();
    await dialog.verifyIsHidden();
  });
}

test("each step reports what it produced, and there is no audio step because there is no audio", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);

  await dialog.verifySourceTitle("The Simulated Video");
  await dialog.verifyStepCountIs(2);
  await dialog.verifyStepDetail("01", "Transcript fetched · 23 words");
  await dialog.verifyStepState("01", "done");
  await dialog.verifyStepState("02", "running");
  await dialog.verifyElapsedIsShown();

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await dialog.verifyStepDetailMatches("02", /^Overview written · \d+ min read$/);
  await dialog.verifyStepState("02", "done");
});

test("a finished generation opens in the reader from the dialog, and leaves no strip behind", async ({
  launcher,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "done");
  await dialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The Simulated Video");
  await dialog.verifyIsHidden();
  await launcher.appShell.generationStatusStrip.verifyIsHidden();
});

test("run in the background, the strip carries the run and the new row arrives with the design's entrance", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);

  const library = await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");

  const strip = launcher.appShell.generationStatusStrip;
  await dialog.clickRunInBackground();
  await dialog.verifyIsHidden();
  await strip.verifyIsShown();
  await strip.verifyReads("Creating overview", "Step 2 of 2");

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await strip.verifyReads("Overview ready", "Done");

  await library.expectCardCountToBe(2);
  await library.cardWithTitle("The Simulated Video").verifyIsEntering(true);
  await library.cardWithTitle("Example").verifyIsEntering(false);
});

test("the ready strip stands down on its own, once the note is in the library behind it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);

  await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickRunInBackground();

  const strip = launcher.appShell.generationStatusStrip;
  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await strip.verifyReads("Overview ready", "Done");
  await strip.verifyStandsDownOnItsOwn();
});

test("the strip's Details reopens the same run rather than starting a second one", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.clickRunInBackground();
  await launcher.appShell.generationStatusStrip.clickDetails();

  await dialog.verifyIsShown();
  await dialog.verifyStepState("01", "done");
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_METADATA)).toBe(1);
});

test("cancelling a run saves nothing, even once the call it was waiting on comes back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");
  await dialog.clickCancelRun();

  await dialog.verifyIsHidden();
  await launcher.appShell.generationStatusStrip.verifyIsHidden();

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(0);
});

test("a failure hands the dialog back to the form with the link still in it, and saves nothing", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyGenerationErrorIsVisible();
  await form.verifyUrlInputHolds(VALID_URL);

  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(0);
});
