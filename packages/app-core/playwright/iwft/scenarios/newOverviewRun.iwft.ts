import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = ANTHROPIC_KEY;
const PHONE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 900 };

for (const [name, viewport] of [
  ["on a phone", PHONE],
  ["on a desktop", DESKTOP],
] as const) {
  test(`${name} the paste field lives behind + New, in a dialog Escape closes`, async ({ launcher, backendSimulator, page }) => {
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

test("each step reports what it produced, and there is no audio step because nobody waits on the audio", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);

  await dialog.verifySourceTitle("The Simulated Video");
  await dialog.verifyStepState("01", "done");
  await dialog.verifyStepState("02", "running");
  await dialog.verifyStatusReads(/· Step 2 of 2/);

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await dialog.verifyStatusReads(/^Overview written · \d+ min read$/);
  await dialog.verifyStepState("02", "done");
});

test("Create opens with the link field ready to paste into", async ({ launcher }) => {
  await launcher.launch({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.verifyFieldHasFocus();
});

test("a finished generation opens in the reader from the dialog, and leaves no strip behind", async ({ launcher }) => {
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
  await dialog.clickDone();
  await dialog.verifyIsHidden();
  await strip.verifyIsShown();
  await strip.verifyReads("Creating overview", "Step 2 of 2");

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await strip.verifyReads("Overview ready", "Done");

  await library.expectCardCountToBe(2);
  await library.cardWithTitle("The Simulated Video").verifyIsEntering(true);
  await library.cardWithTitle("Example").verifyIsEntering(false);
});

test("the ready strip stands down on its own, once the note is in the library behind it", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);

  await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickDone();

  const strip = launcher.appShell.generationStatusStrip;
  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await strip.verifyReads("Overview ready", "Done");
  await strip.verifyStandsDownOnItsOwn();
});

test("the strip's Details reopens the same run rather than starting a second one", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.clickDone();
  await launcher.appShell.generationStatusStrip.clickDetails();

  await dialog.verifyIsShown();
  await dialog.verifyStepState("01", "done");
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(1);
});

test("a failure shows on its row, the field is ready for the next link, and nothing is saved", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(VALID_URL);
  await form.verifyGenerationErrorIsVisible();
  await launcher.appShell.newOverviewDialog.verifyStage("failed");
  await form.verifyUrlInputHolds("");

  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(0);
});

test("a video the library already holds offers to open the existing overview, and generates nothing", async ({
  launcher,
  backendSimulator,
}) => {
  const held = makeOverview({ source: { ...makeOverview().source, id: VideoId.parse(IWFT_VIDEO_ID), title: "Already Here" } });
  backendSimulator.overviews.seed(held);
  await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await dialog.verifyAlreadyHeld();
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await dialog.clickOpenHeld();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("Already Here");
  await dialog.verifyIsHidden();
});

test("several links in a row: the next waits its turn with its transcript fetched, and each is made one after another", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");
  await form.verifyUrlInputHolds("");
  await form.submitUrl("https://www.youtube.com/watch?v=secondVideo1");

  await dialog.verifyWaitingCount(1);
  await dialog.verifyWaitingReads(/^Next · Transcript ready$/);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(1);

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(2);
  await dialog.verifyWaitingCount(0);
  await dialog.verifyStage("done");
  await dialog.verifySourceTitle("How Your Brain Fills In the Gaps");
});

test("closing with a link still waiting leaves both to be made in the background", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;
  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");
  await form.submitUrl("https://www.youtube.com/watch?v=secondVideo1");
  await dialog.verifyWaitingCount(1);

  await dialog.clickDone();
  await dialog.verifyIsHidden();
  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(2);
});
