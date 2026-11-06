import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 800 };

// The pane and its two journeys shipped with design 9c, but only the library and the reader
// ever asked for them. These cover the pages that were swapping with no transition at all
// (docs/features/page-transitions.md).

test("opening Settings, and then one of its sections, are animated journeys", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const settings = await shell.verifyNavigationAnimates(() => shell.openSettings());
  await shell.verifyNavigationDirection("forward");

  await shell.verifyNavigationAnimates(() => settings.openSection("appearance"));
  await shell.verifyNavigationDirection("forward");
});

// A section is a page of its own only where the list is the page, which is the panel and the
// phone (SettingsPage's `stacked`). Coming back out of one pops history rather than pushing
// (useBackTo), and react-router replays the transition it recorded on the way in, so the flag
// on the forward link is what turns both directions on.
test("on a phone, coming back out of a section and out of Settings is animated too", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const settings = await shell.openSettings();
  await shell.verifyNavigationAnimates(() => settings.openSection("appearance"));

  await shell.verifyNavigationAnimates(() => settings.clickBackToSettings());
  await shell.verifyNavigationDirection("back");

  await shell.verifyNavigationAnimates(() => settings.clickBackToOverviews());
  await shell.verifyNavigationDirection("back");
});

test("nothing animates when the reader has asked for reduced motion", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const settings = await shell.verifyNavigationDoesNotAnimate(() => shell.openSettings());
  await shell.verifyNavigationDoesNotAnimate(() => settings.openSection("appearance"));
});
