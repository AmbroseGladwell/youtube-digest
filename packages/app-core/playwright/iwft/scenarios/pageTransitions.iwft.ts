import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 800 };

// A row only becomes a head when there is a picture to carry: both ends read the same
// `sourceImage`, so one thumbnail here gives the library its tile and the note its head.
const THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23996644'/%3E%3C/svg%3E";

const withImage = () => {
  const base = makeOverview();
  return makeOverview({ source: { ...base.source, thumbnailUrl: THUMBNAIL } });
};

// The pane and its two journeys shipped with design 9c, but only the library and the reader
// ever asked for them. These cover the pages that were swapping with no transition at all
// (docs/features/page-transitions.md).

test("opening Settings, and then one of its sections, are animated journeys", async ({ launcher, backendSimulator }) => {
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

// Design OV-170 170a-170h: the row's thumbnail travels and lands as the note's head image,
// and everything else crossfades in place.
// Opened once first, because the image can only land on a head that is already there: a note
// whose record is still being read renders ReaderPage's pending state, and the transition
// captures a new page with no head image in it (docs/features/page-transitions.md, "Where the
// design and the build differ"). The second open is the one with something to land on.
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

// 170g: straight back after a glance, with the head's image still in view and the row where
// the library's restored scroll puts it.
test("the head's image carries back into its row", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await library.nthCard(0).openReader();
  await reader.verifyHeadHasImage(true);

  await shell.verifyImageCarriesAcross(() => reader.clickBackToLibrary());
});

// 170g-s: after a long note the head has scrolled away, so there is nothing on screen for
// the image to leave from and 9c's return plays instead. The way back has to be the bar's
// lent link (OV-167), because clicking the head's own would scroll it back into view first
// and the image would have something to leave from after all.
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

// 170d: a note with no picture sets no name at either end, and the journey is 9c as built.
test("a note with no image is 9c unchanged", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await shell.verifyImageDoesNotCarryAcross(() => library.nthCard(0).openReader());
  await reader.verifyHeadHasImage(false);
});

// 170h: the image does the travelling, so the pane only crossfades. Without an image to
// carry, the very same navigation keeps 9c's 10px slide.
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

// Design 170e draws the phone morph from a 112px row tile, but this library has none to
// give: below 768px LibraryOverviewCard hides the thumbnail on purpose, because at that
// width it can't tell one video from another and it costs the title its column. So there is
// nothing to carry and 9c plays, which is the same answer the panel gets for its own reason
// (docs/features/page-transitions.md, "Where the design and the build differ").
test("a phone has no row thumbnail to carry, so the journey stays 9c", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  const shell = launcher.appShell;

  const reader = await shell.verifyImageDoesNotCarryAcross(() => library.nthCard(0).openReader());
  await reader.verifyHeadHasImage(true);
});
