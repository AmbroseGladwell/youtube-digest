import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test" };

test("an empty library shows the first-run hero, not the filter/library chrome", async ({ launcher }) => {
  const home = await launcher.launch();
  await home.verifyShowsFirstRunHero();
});

test("with no keys saved, the url input stays disabled behind the keys panel", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun();
  await form.verifyUrlInputDisabled();
});

test("with keys already saved, the generate form is usable immediately, no keys panel", async ({ launcher }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  await form.verifyIsShown();
  await form.verifyGenerateButtonEnabled();
});

test("submitting a non-YouTube URL shows a validation error and makes no network calls", async ({
  launcher,
  backendSimulator,
}) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl("https://vimeo.com/12345");
  await form.verifyValidationError("That doesn't look like a YouTube URL.");

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);
});

test("the hero's own field is dead until the keys are in, and says so under it", async ({ launcher }) => {
  const home = await launcher.launch();
  await home.verifyShowsFirstRunHero();

  await home.verifyHeroFieldDisabled();
  await home.verifyShowsKeysNote();
});

test("with keys saved the hero field is live, and a link pasted there runs in the dialog", async ({
  launcher,
}) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  await home.verifyShowsFirstRunHero();
  await home.verifyHeroFieldEnabled();
  await home.verifySaysKeysAreSaved();

  await home.submitHeroUrl(VALID_URL);

  const dialog = await home.expectRunDialog();
  await dialog.verifySourceTitle("The Simulated Video");
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
});

test("the hero field refuses a non-YouTube link without opening anything", async ({
  launcher,
  backendSimulator,
}) => {
  const home = await launcher.launch({ apiKeys: API_KEYS });
  await home.verifyShowsFirstRunHero();

  await home.submitHeroUrl("https://vimeo.com/12345");
  await home.verifyHeroValidationError("That doesn't look like a YouTube URL.");
  await launcher.appShell.newOverviewDialog.verifyIsHidden();

  expect(backendSimulator.getCallCount(EndpointKey.SHARED_TRANSCRIPT)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);
});
