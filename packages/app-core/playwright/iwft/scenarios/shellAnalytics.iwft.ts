import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const eventsUnder = (backendSimulator: BackendSimulator, prefix: string) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith(prefix));

test("the account menu's opening and the item chosen are counted", async ({ launcher, backendSimulator }) => {
  await launcher.launch(SIGNED_IN);

  await launcher.appShell.openSettings();

  await expect
    .poll(() => eventsUnder(backendSimulator, "app.accountMenu."))
    .toEqual([
      { name: "app.accountMenu.opened", props: {} },
      { name: "app.accountMenu.itemChosen", props: { item: "settings" } },
    ]);
});

test("a dead end's way out is counted by which dead end it was, never its title", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  const deadEnd = await launcher.launchExpectingDeadEnd({ ...SIGNED_IN, failingReads: ["topics"] });

  await deadEnd.takeAction();

  await expect
    .poll(() => eventsUnder(backendSimulator, "app.errorState."))
    .toEqual([{ name: "app.errorState.actionChosen", props: { screen: "topicsLoad" } }]);
});

test("pausing and closing the mini-player are counted against the overview playing", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  backendSimulator.narration.seedReady(overview);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).clickListen();
  await launcher.miniPlayer.verifyIsShown(true);

  await launcher.miniPlayer.clickPlayPause();
  await launcher.miniPlayer.clickClose();

  await expect
    .poll(() => eventsUnder(backendSimulator, "player.miniPlayer."))
    .toEqual([
      { name: "player.miniPlayer.playToggled", props: { overviewId: overview.id, playing: false } },
      { name: "player.miniPlayer.stopped", props: { overviewId: overview.id } },
    ]);
});
