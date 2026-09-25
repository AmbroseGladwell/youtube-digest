import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { VideoId } from "@overview/domain";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const REASON = "Does the capacity argument hold for the UK?";
const TITLE = "The Quiet Return of Nuclear Baseload";

const storedReasonFor = (backendSimulator: BackendSimulator, title: string) => async () =>
  (await backendSimulator.overviewStore.listOverviews()).find(
    (overview) => overview.video.title === title,
  )?.captureReason;

const openReader = async (
  launcher: Launcher,
  backendSimulator: BackendSimulator,
  captureReason: string | null,
) => {
  const overview = makeOverview({
    captureReason,
    video: { ...makeOverview().video, title: TITLE },
  });
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle(TITLE).openReaderFromTitle();
  return { overview, reader };
};

test("a reason typed while the overview is being made is on the record when it lands", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.verifyIsShown();
  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");
  await dialog.fillCaptureReason(REASON);

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await dialog.verifyStepState("02", "done");

  await expect.poll(storedReasonFor(backendSimulator, "The Simulated Video")).toBe(REASON);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyReasonReads(REASON);
});

test("the field stays through the done state, so a reason added before Read overview is saved too", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  const dialog = launcher.appShell.newOverviewDialog;

  await form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "done");
  await dialog.verifyAsksForAReason(true);
  await dialog.fillCaptureReason(`  ${REASON}  `);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyReasonReads(REASON);
  await expect.poll(storedReasonFor(backendSimulator, "The Simulated Video")).toBe(REASON);
});

test("whatever was typed is kept through Run in background and reopening the run", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  await launcher.launchExpectingLibrary({ apiKeys: API_KEYS });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.verifyStepState("02", "running");
  await dialog.fillCaptureReason(REASON);
  await dialog.clickRunInBackground();
  await launcher.appShell.generationStatusStrip.clickDetails();

  await dialog.verifyCaptureReasonHolds(REASON);

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  await expect.poll(storedReasonFor(backendSimulator, "The Simulated Video")).toBe(REASON);
});

test("an overview without a reason shows no line for one, and the menu offers to add it", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator, null);

  await reader.verifyShowsOverviewPanel();
  await reader.verifyHasNoReason();

  await reader.openActionsMenu();
  await reader.verifyReasonMenuItemReads("Add reason");
});

test("an overview with a reason reads it back above the note, and the menu offers to edit it", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator, REASON);

  await reader.verifyReasonReads(REASON);

  await reader.openActionsMenu();
  await reader.verifyReasonMenuItemReads("Edit reason");
});

test("Add reason turns the line into a field with focus in it, and Enter saves what was typed", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator, null);

  await reader.editReason();
  await reader.verifyReasonFieldIsFocused();
  await reader.verifyOffersToRemoveReason(false);

  await reader.fillReason(REASON);
  await reader.pressEnterInReason();

  await reader.verifyReasonEditorIsShown(false);
  await reader.verifyReasonReads(REASON);
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.captureReason)
    .toBe(REASON);
});

test("Edit reason opens the field on the reason as it is, and Save keeps the change", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator, REASON);

  await reader.editReason();
  await reader.verifyReasonFieldHolds(REASON);

  await reader.fillReason("Careers in the AI era");
  await reader.clickSaveReason();

  await reader.verifyReasonReads("Careers in the AI era");
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.captureReason)
    .toBe("Careers in the AI era");
});

test("Escape and Cancel both put the line back as it was, saving nothing", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator, REASON);

  await reader.editReason();
  await reader.fillReason("something else");
  await reader.pressEscape();
  await reader.verifyReasonEditorIsShown(false);
  await reader.verifyReasonReads(REASON);

  await reader.editReason();
  await reader.fillReason("something else again");
  await reader.clickCancelReason();
  await reader.verifyReasonEditorIsShown(false);
  await reader.verifyReasonReads(REASON);

  expect((await backendSimulator.overviews.get(overview.id))?.captureReason).toBe(REASON);
});

test("Remove reason takes the line away, and the menu goes back to offering to add one", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator, REASON);

  await reader.editReason();
  await reader.verifyOffersToRemoveReason(true);
  await reader.clickRemoveReason();

  await reader.verifyHasNoReason();
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.captureReason)
    .toBeNull();

  await reader.openActionsMenu();
  await reader.verifyReasonMenuItemReads("Add reason");
});

test("saving an emptied field is the same as removing the reason", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator, REASON);

  await reader.editReason();
  await reader.fillReason("   ");
  await reader.pressEnterInReason();

  await reader.verifyHasNoReason();
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.captureReason)
    .toBeNull();
});

test("asked for from another tab, the editor arrives on the Overview tab where the line lives", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator, null);

  await reader.clickTab("Transcript");
  await reader.editReason();

  await reader.verifyShowsOverviewPanel();
});

test("the side panel asks for the reason while it works, and the overview it opens carries it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VALID_URL,
    youTubeFetch: true,
  });

  await capture.clickCreate();
  await capture.verifyIsWorking();
  await capture.verifyAsksForAReason(true);
  await capture.fillCaptureReason(REASON);

  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);
  const reader = await capture.waitForReader();
  await reader.verifyReasonReads(REASON);
  await expect.poll(storedReasonFor(backendSimulator, "The Simulated Video")).toBe(REASON);
});

test("the panel's ⋯ menu edits the reason in place the same way, with a shorter Remove", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview({ captureReason: REASON });
  backendSimulator.overviews.seed({
    ...overview,
    video: {
      ...overview.video,
      id: VideoId.parse(IWFT_VIDEO_ID),
      url: VALID_URL,
      title: "Held already",
    },
  });
  const capture = await launcher.launchPanel({
    apiKeys: API_KEYS,
    activeVideoUrl: VALID_URL,
    youTubeFetch: true,
  });

  const reader = await capture.openStoredOverview();
  await reader.verifyReasonReads(REASON);
  await reader.editReason();
  await reader.clickRemoveReason();

  await reader.verifyHasNoReason();
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.captureReason)
    .toBeNull();
});
