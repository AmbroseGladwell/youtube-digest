import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 800 };

// Both ends read the same sourceImage, so one thumbnail gives the tile and the head.
const THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23996644'/%3E%3C/svg%3E";

const withImage = () => {
  const base = makeOverview();
  return makeOverview({ source: { ...base.source, thumbnailUrl: THUMBNAIL } });
};

test("opening Settings, and then one of its sections, are animated journeys", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const settings = await shell.verifyNavigationAnimates(() => shell.openSettings());
  await shell.verifyNavigationDirection("forward");

  await shell.verifyNavigationAnimates(() => settings.openSection("appearance"));
  await shell.verifyNavigationDirection("forward");
});

// Both ways from one flag: docs/features/page-transitions.md, "A pop is animated by replay, not by a flag".
test("on a phone, coming back out of a section and out of Settings is animated too", async ({ page, launcher, backendSimulator }) => {
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

test("nothing animates when the reader has asked for reduced motion", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const settings = await shell.verifyNavigationDoesNotAnimate(() => shell.openSettings());
  await shell.verifyNavigationDoesNotAnimate(() => settings.openSection("appearance"));
});

// Opened twice: docs/features/page-transitions.md, "Where it doesn't carry".
test("the row's thumbnail carries across into the note's head", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const warmed = await library.nthCard(0).openReader();
  await warmed.verifyHeadHasImage(true);
  const back = await warmed.clickBackToLibrary();

  const reader = await shell.verifyImageCarriesAcross(() => back.nthCard(0).openReader());
  await reader.verifyHeadHasImage(true);
});

test("the head's image carries back into its row", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await library.nthCard(0).openReader();
  await reader.verifyHeadHasImage(true);

  await shell.verifyImageCarriesAcross(() => reader.clickBackToLibrary());
});

// The bar's lent link: the head's own would scroll it back into view first.
test("coming back from a scrolled note leaves the image behind and plays 9c's return", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await library.nthCard(0).openReader();
  await reader.scrollToTheFoot();

  await shell.verifyImageDoesNotCarryAcross(() => shell.clickBackInBar());
  await shell.verifyNavigationDirection("back");
});

test("a note with no image is 9c unchanged", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await shell.verifyImageDoesNotCarryAcross(() => library.nthCard(0).openReader());
  await reader.verifyHeadHasImage(false);
});

test("the pane holds still while the image travels, and slides when it doesn't", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;
  await shell.verifyThePaneKeyframesAre("paneFade", () => library.nthCard(0).openReader());
});

test("without an image the pane keeps 9c's slide", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;
  await shell.verifyThePaneKeyframesAre("paneEnterForward", () => library.nthCard(0).openReader());
});

// Opened twice, as on the desktop: docs/features/page-transitions.md, "Where it doesn't carry".
for (const [name, viewport] of [
  ["a phone's banner", PHONE],
  ["the narrow row's", { width: 480, height: 800 }],
] as const) {
  test(`${name} image carries across into the note's head`, async ({ page, launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(withImage());
    await page.setViewportSize(viewport);
    const library = await launcher.launchExpectingLibrary();
    const shell = launcher.appShell;

    const warmed = await library.nthCard(0).openReader();
    await warmed.verifyHeadHasImage(true);
    const back = await warmed.clickBackToLibrary();

    const reader = await shell.verifyImageCarriesAcross(() => back.nthCard(0).openReader());
    await reader.verifyHeadHasImage(true);
  });
}
