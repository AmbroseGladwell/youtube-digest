import { DEFAULT_MODEL, DEFAULT_SECTIONS_ENABLED } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import {
  SIMULATED_ACCOUNT_ID,
  SIMULATED_EMAIL,
  SIMULATED_OUR_MODEL,
  type BackendSimulator,
} from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
  apiKeys: ANTHROPIC_KEY,
};
// With an account, so our key is ours rather than the signed-out trial's.
const WITH_AN_ACCOUNT = { ...SIGNED_IN, syncConnection: { ...SIGNED_IN.syncConnection, accountId: SIMULATED_ACCOUNT_ID } };
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
          howToApplyWritten: true,
          howToApplyItems: 1,
          personalised: false,
          sourceWords: 23,
          keyPoints: 3,
          keyPointCeiling: 7,
          chapters: 2,
          noteKind: "default",
          key: "own",
          provider: "anthropic",
          model: DEFAULT_MODEL.anthropic,
        },
      },
      { name: "capture.newOverviewDialog.readChosen", props: { overviewId: overview!.id, from: "dialog" } },
    ]);
});

const finishedProps = (backendSimulator: BackendSimulator) =>
  captureEvents(backendSimulator).find(({ name }) => name === "capture.newOverview.finished")?.props;

test("an overview made on our key names our key, and the provider and model our server said", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const { apiKeys: _noKey, ...signedInWithoutAKey } = WITH_AN_ACCOUNT;
  await launcher.launch(signedInWithoutAKey);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect.poll(() => finishedProps(backendSimulator)).toMatchObject({ key: "ours", ...SIMULATED_OUR_MODEL });
});

test("signed out, an overview made on our key is counted as the trial's", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const { apiKeys: _noKey, ...signedOutWithoutAKey } = SIGNED_IN;
  await launcher.launch(signedOutWithoutAKey);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect.poll(() => finishedProps(backendSimulator)).toMatchObject({ key: "trial", ...SIMULATED_OUR_MODEL });
});

test("an overview our key makes after the reader's runs out of credit names our key, not the one tried first", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.anthropicIsOutOfCredit();
  await launcher.launch(WITH_AN_ACCOUNT);
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect.poll(() => finishedProps(backendSimulator)).toMatchObject({ key: "ours", ...SIMULATED_OUR_MODEL });
});

test("How to apply is counted by how many actions it holds, an empty list as written, and never by what the actions or the reader say", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.setGeneratedOutputOverrides({ howToApply: { items: [] } });
  await launcher.launch({ ...SIGNED_IN, aboutYou: { who: ["nurse"], time: [], focus: ["night shifts"] } });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect
    .poll(() => finishedProps(backendSimulator))
    .toMatchObject({ howToApplyWritten: true, howToApplyItems: 0, personalised: true });
  const sent = JSON.stringify(backendSimulator.analytics.events());
  expect(sent).not.toContain("nurse");
  expect(sent).not.toContain("night shifts");
});

test("How to apply switched off is counted as not written, not as an empty list", async ({ launcher, backendSimulator }) => {
  backendSimulator.setGeneratedOutputOverrides({ howToApply: undefined });
  await launcher.launch({ ...SIGNED_IN, sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, howToApply: false } });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();

  await expect
    .poll(() => finishedProps(backendSimulator))
    .toMatchObject({ howToApplyWritten: false, howToApplyItems: 0, personalised: false });
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

  const finishedEvent = () => captureEvents(backendSimulator).find(({ name }) => name === "capture.newOverview.finished");
  await expect.poll(() => backendSimulator.errors.timings()).toHaveLength(1);
  await expect.poll(() => finishedEvent()).toBeDefined();
  const [timing] = backendSimulator.errors.timings();
  const finished = finishedEvent();
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
      props: {
        from: "dialog",
        failure: "generation",
        durationMs: expect.any(Number),
        key: "own",
        provider: "anthropic",
        model: DEFAULT_MODEL.anthropic,
      },
    });
});

test("a model the provider refuses is counted as its own failure, naming the provider and the model", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.anthropicRefusesTheModel();
  await launcher.launch({ ...SIGNED_IN, provider: "anthropic", modelByProvider: { anthropic: "claude-haiku-5-5" } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.form.verifyGenerationErrorIsVisible();

  await expect
    .poll(() => captureEvents(backendSimulator).at(-1))
    .toEqual({
      name: "capture.newOverview.failed",
      props: {
        from: "dialog",
        failure: "model-refused",
        durationMs: expect.any(Number),
        key: "own",
        provider: "anthropic",
        model: "claude-haiku-5-5",
      },
    });
  expect(JSON.stringify(backendSimulator.analytics.events())).not.toContain("compiled grammar");
});
