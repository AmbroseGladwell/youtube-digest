import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { VideoId } from "@overview/types";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const panel = { apiKeys: API_KEYS, activeVideoUrl: WATCHED_URL, youTubeFetch: true };

test("the side panel's masthead is the mark and Settings, with no + New and no list behind it", async ({
  launcher,
}) => {
  await launcher.launchPanel(panel);

  await launcher.appShell.verifyIsParedBackToThePanel();
});

test("the extension's own full page is still the library, with all of that chrome", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "extension" });

  await launcher.appShell.verifyCarriesTheLibraryChrome();
});

test("the panel offers to take the video in front of it, and says what that will cost", async ({
  launcher,
}) => {
  const capture = await launcher.launchPanel(panel);

  await capture.verifyOffersToCreate(true);
  await capture.verifySaysNothingAboutMissingVideo();
  await capture.verifyAsksForKeys(false);
  await capture.verifyCaptionsNoteReads(/captions are already here|Fetching its captions now/);
});

test("a panel open on something that isn't a video says which page it wants instead", async ({
  launcher,
}) => {
  const capture = await launcher.launchPanel({ apiKeys: API_KEYS, activeVideoUrl: null });

  await capture.verifyOffersToCreate(false);
  await capture.verifySaysThereIsNoVideo();
});

test("without keys the panel asks for them rather than offering a button that would fail", async ({
  launcher,
}) => {
  const capture = await launcher.launchPanel({ activeVideoUrl: WATCHED_URL });

  await capture.verifyOffersToCreate(false);
  await capture.verifyAsksForKeys(true);

  const settings = await capture.openSettings();
  await settings.verifyIsShown();
});

test("creating turns the whole panel into the run, which reports the same steps the dialog does", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel(panel);

  await capture.clickCreate();

  await capture.verifyIsWorking();
  await capture.verifyWorkingTitleReads("The Simulated Video");
  await capture.steps.verifyStepState("01", "done");
  await capture.steps.verifyStepState("02", "running");
  await capture.verifyElapsedIsShown();
  await capture.verifySaysToKeepThePanelOpen();
});

test("a finished run puts the panel on the overview it just wrote", async ({ launcher }) => {
  const capture = await launcher.launchPanel(panel);

  await capture.clickCreate();

  const reader = await capture.waitForReader();
  await reader.verifyTitle("The Simulated Video");
});

test("a failed run says so on the panel and offers to start over rather than stranding it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel(panel);

  await capture.clickCreate();
  await capture.verifyShowsGenerationError();

  await capture.clickStartAgain();
  await capture.verifyOffersToCreate(true);
});

test("cancelling a run hands the panel back rather than leaving the progress list up", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel(panel);

  await capture.clickCreate();
  await capture.verifyIsWorking();

  await capture.clickCancel();
  await capture.verifyOffersToCreate(true);
});

test("a video already in the library is offered to read, not bought a second time", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: {
      ...overview.video,
      id: VideoId.parse(IWFT_VIDEO_ID),
      url: WATCHED_URL,
      title: "Held already",
    },
  });
  const capture = await launcher.launchPanel(panel);

  await capture.verifySaysItIsAlreadyInTheLibrary();

  const reader = await capture.openStoredOverview();
  await reader.verifyTitle("Held already");
});

test("the panel's reader drops the trail, the stepper and the rail it has nothing to point at", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview({ savedAt: "2026-09-15T00:00:00.000Z" }));
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    savedAt: "2026-09-16T00:00:00.000Z",
    video: { ...overview.video, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL },
  });
  const capture = await launcher.launchPanel(panel);

  const reader = await capture.openStoredOverview();
  await reader.verifyMastheadIsPanelSized();
});
