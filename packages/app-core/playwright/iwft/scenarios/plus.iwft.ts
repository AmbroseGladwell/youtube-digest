import { VideoId } from "@overview/domain";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EVERY_ACCOUNT_INCLUDES, PLAN_CARDS, UNSET_ALLOWANCE } from "../../../src/features/plus/planCards.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test" };

const panel = { apiKeys: API_KEYS, activeVideoUrl: WATCHED_URL, youTubeFetch: true };

const seedHeldOverview = (backendSimulator: BackendSimulator) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, id: VideoId.parse(IWFT_VIDEO_ID), url: WATCHED_URL },
  });
};

// The paid plans sell volume, never features, and no plan ever says "unlimited"
// (docs/architecture/tiers.md).
test("Settings names the plan, gives every account the features, and sells both paid plans on volume", async ({
  launcher,
}) => {
  await launcher.launchPanel(panel);
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("plan", "Free");
  await settings.openSection("plan");

  await settings.verifyPlanReads("Free");
  await settings.verifyEveryAccountIncludes(EVERY_ACCOUNT_INCLUDES);
  await settings.verifyPlanCardsRead(
    PLAN_CARDS.map((card) => [card.name, card.ourKey ?? UNSET_ALLOWANCE, card.ownKey, card.note]),
  );
  await settings.verifyPlanMarkedAsYours("Free");
  await settings.verifyPlansAreNotOnSale("isn't built yet");
});

test("on Plus, Settings rings the reader's own plan among the three", async ({ launcher }) => {
  await launcher.launchPanel({
    ...panel,
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
    plan: "plus",
  });
  const settings = await (await launcher.appShell.openSettings()).openSection("plan");

  await settings.verifyPlanReads("Plus");
  await settings.verifyEveryAccountIncludes(EVERY_ACCOUNT_INCLUDES);
  await settings.verifyPlanMarkedAsYours("Plus");
  await settings.verifyPlansAreNotOnSale("set by hand");
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

test("a plan the server couldn't be asked for is said as unknown, not as Free, and can be asked again", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SESSION_READ);
  await launcher.launch({
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
    plan: "plus",
  });
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("plan", "Couldn't check");
  await settings.verifyRowReads("connections", "Couldn't check");
  await settings.openSection("plan");
  await settings.verifyPlanReads("Couldn't check your plan");

  backendSimulator.simulateEndpointDefault(EndpointKey.SESSION_READ);
  await settings.recheckPlan();

  await settings.verifyPlanReads("Plus");
  await settings.verifyRowReads("plan", "Plus");
});
