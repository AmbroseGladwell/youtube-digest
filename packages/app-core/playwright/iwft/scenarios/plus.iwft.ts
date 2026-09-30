import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { PLUS_FEATURES } from "../../../src/features/plus/plusFeatures.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const panel = { apiKeys: API_KEYS, activeVideoUrl: WATCHED_URL, youTubeFetch: true };

const seedHeldOverview = (backendSimulator: BackendSimulator) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL },
  });
};

test("Settings names the plan, lists what Plus adds, and admits there is nothing to buy yet", async ({
  launcher,
}) => {
  await launcher.launchPanel(panel);
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("plan", "Free");
  await settings.openSection("plan");

  await settings.verifyPlanReads("Free");
  await settings.verifyOffersPlus(true);
  await settings.verifyPlusFeaturesRead(PLUS_FEATURES);
  await settings.verifySaysPlusIsNotOnSale();
});

test("on Plus, Settings states the plan rather than pitching it", async ({ launcher }) => {
  await launcher.launchPanel({
    ...panel,
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
    plan: "plus",
  });
  const settings = await (await launcher.appShell.openSettings()).openSection("plan");

  await settings.verifyPlanReads("Plus");
  await settings.verifyOffersPlus(false);
  await settings.verifyPlusFeaturesRead(PLUS_FEATURES);
});

// Design 2d: the Plus prompt on Listen is retired, since audio is open to every account
// (docs/features/audio-player.md).
test("Listen on a free plan docks the player and plays, with no case for Plus", async ({
  launcher,
  backendSimulator,
}) => {
  seedHeldOverview(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifyPlayerIsDocked(false);
  await reader.clickListen();

  await reader.verifyPlayerIsDocked(true);
  await reader.verifyListenReads("Listening");
});

// The bar is the only place a panel listener can pause, so pausing from it must not be
// the thing that takes it away.
test("pausing from the docked player leaves it docked, and Listening puts it away", async ({
  launcher,
  backendSimulator,
}) => {
  seedHeldOverview(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();
  await reader.clickListen();

  await reader.clickPlayPause();
  await reader.verifyPlayerIsDocked(true);
  await reader.verifyListenReads("Listening");

  await reader.clickListen();
  await reader.verifyPlayerIsDocked(false);
  await reader.verifyListenReads("Listen");
});

test("an overview the panel has just written says where it lives, once", async ({ launcher }) => {
  const capture = await launcher.launchPanel(panel);
  await capture.clickCreate();
  const reader = await capture.waitForReader();

  await reader.verifySavedLocallyNoteIsShown(true);
});

test("dismissing that note is remembered rather than asked again on the next capture", async ({
  launcher,
  backendSimulator,
}) => {
  const capture = await launcher.launchPanel(panel);
  await capture.clickCreate();
  const reader = await capture.waitForReader();

  await reader.dismissSavedLocallyNote();
  await reader.verifySavedLocallyNoteIsShown(false);

  await expect
    .poll(async () => (await backendSimulator.settingsStore.get()).plusNoticeDismissed)
    .toBe(true);
});

test("a reader opened from the library, rather than just written, says nothing about where it lives", async ({
  launcher,
  backendSimulator,
}) => {
  seedHeldOverview(backendSimulator);
  const capture = await launcher.launchPanel(panel);
  const reader = await capture.openStoredOverview();

  await reader.verifySavedLocallyNoteIsShown(false);
});

test("the web reader is untouched by any of it: the player is always there, and nothing is sold", async ({
  launcher,
  backendSimulator,
}) => {
  seedHeldOverview(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyPlayerIsDocked(true);
  await reader.verifySavedLocallyNoteIsShown(false);
});
