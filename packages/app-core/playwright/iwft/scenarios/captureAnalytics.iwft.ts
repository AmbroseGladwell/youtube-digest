import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
  apiKeys: ANTHROPIC_KEY,
};
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

const captureEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("capture."));

test("making an overview is counted from asking to reading it, with where it was asked from and which source answered", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  const [overview] = await backendSimulator.overviewStore.listOverviews();
  await expect
    .poll(() => captureEvents(backendSimulator))
    .toEqual([
      { name: "capture.newOverviewDialog.opened", props: { from: "newButton" } },
      { name: "capture.newOverview.started", props: { from: "dialog" } },
      {
        name: "capture.newOverview.finished",
        props: {
          overviewId: overview!.id,
          from: "dialog",
          transcriptSource: "service",
          durationMs: expect.any(Number),
          reasonGiven: false,
          novelty: "original",
          standsOut: true,
          tagsReused: 0,
          tagsAdded: 3,
        },
      },
      { name: "capture.newOverviewDialog.readChosen", props: { overviewId: overview!.id, from: "dialog" } },
    ]);
});

test("how the capture's time split is reported beside its events, step by step, and agrees with the event's duration", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ ...SIGNED_IN, surface: "extension" });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect.poll(() => backendSimulator.errors.timings()).toHaveLength(1);
  const [timing] = backendSimulator.errors.timings();
  const finished = captureEvents(backendSimulator).find(({ name }) => name === "capture.newOverview.finished");
  expect(timing).toEqual({
    name: "captureTimed",
    outcome: "finished",
    steps: [
      { step: "stored", outcome: "no-answer", ms: expect.any(Number) },
      { step: "shared-cache", outcome: "no-answer", ms: expect.any(Number) },
      { step: "service", outcome: "answered", ms: expect.any(Number) },
      { step: "model", outcome: "answered", ms: expect.any(Number) },
      { step: "save", outcome: "answered", ms: expect.any(Number) },
    ],
    totalMs: finished!.props.durationMs,
    transcriptCharacters: expect.any(Number),
    at: expect.any(String),
  });
  expect(backendSimulator.errors.batches().find(({ timings }) => timings)!.context).toMatchObject({ surface: "extension" });
});

test("a run that fails is counted by what went wrong, never by its message", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.ANTHROPIC_MESSAGES);
  await launcher.launch(SIGNED_IN);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.form.verifyGenerationErrorIsVisible();

  await expect
    .poll(() => captureEvents(backendSimulator).at(-1))
    .toEqual({
      name: "capture.newOverview.failed",
      props: { from: "dialog", failure: "generation", durationMs: expect.any(Number) },
    });
});
