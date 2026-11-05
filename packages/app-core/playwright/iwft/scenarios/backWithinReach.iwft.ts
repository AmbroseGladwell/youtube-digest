import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const longNote = () =>
  makeOverview({
    keyPoints: Array.from({ length: 14 }, (_, index) => ({
      text: `Point ${index + 1}: a sentence long enough to take a line or two of a phone's reading column.`,
      range: null,
    })),
    howToApply: { items: ["Re-run the forecast.", "Ask what the figure excludes.", "Give it four weeks."] },
  });
const LONG_NOTE = longNote();

const seedAScrollingLibrary = (seed: (overview: ReturnType<typeof makeOverview>) => void) => {
  for (let index = 0; index < 14; index += 1) seed(makeOverview());
  seed(LONG_NOTE);
};

test("on a phone the bar takes over the way back once the head has scrolled under it, and gives it up again at the top", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(LONG_NOTE);
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  const shell = launcher.appShell;

  await shell.verifyBarHoldsTheBrand();

  await reader.scrollToTheFoot();
  await reader.verifyHeadBackLinkIsUnderTheBar();
  await shell.verifyBarHoldsTheWayBack();

  await reader.scrollToTheTop();
  await shell.verifyBarHoldsTheBrand();
});

test("tapping the bar's way back goes back in history, so the library is where the reader left it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seedAScrollingLibrary((overview) => backendSimulator.overviews.seed(overview));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.scrollTheList();
  const left = await library.readScrollPosition();
  const reader = await library.openReaderFromACardOnScreen();
  const shell = launcher.appShell;

  await reader.scrollToTheFoot();
  await shell.verifyBarHoldsTheWayBack();
  const libraryAgain = await shell.clickBackInBar();

  await libraryAgain.verifyScrollPosition(left);
  await shell.verifyNavigationDirection("back");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.page.backFollowed"))
    .toMatchObject([{ props: { from: "bar" } }]);
});

test("the head's own link goes back in history too, and is counted as the head's", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seedAScrollingLibrary((overview) => backendSimulator.overviews.seed(overview));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.scrollTheList();
  const left = await library.readScrollPosition();
  const reader = await library.openReaderFromACardOnScreen();

  const libraryAgain = await reader.clickBackToLibrary();

  await libraryAgain.verifyScrollPosition(left);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.page.backFollowed"))
    .toMatchObject([{ props: { from: "head" } }]);
});

test("stepped on to the next overview, the way back is a link home rather than a step back", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(longNote());
  backendSimulator.overviews.seed(longNote());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.verifyPosition("1 of 2");
  await reader.clickNextOverview();
  await reader.verifyPosition("2 of 2");
  const shell = launcher.appShell;

  await reader.scrollToTheFoot();
  await shell.verifyBarHoldsTheWayBack();
  await shell.clickBackInBar();

  await shell.verifyNavigationDirection("back");
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe("/");
});

test("while the read-along moves the page, the bar's way back stays put rather than flickering", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(LONG_NOTE);
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  const shell = launcher.appShell;

  await reader.clickPlayPause();
  await reader.clickLineWithText(LONG_NOTE.keyPoints[13]!.text);
  await reader.verifyTheNoteHasScrolled();

  await shell.verifyBarHoldsTheWayBack();
  await shell.verifyBarKeepsHoldingTheWayBack(1_000);
  await shell.clickBackInBar();
});

test("on the web the head scrolls away and the bar keeps the brand", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.overviews.seed(LONG_NOTE);
  await page.setViewportSize(DESKTOP);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.scrollToTheFoot();
  await launcher.appShell.verifyBarNeverOffersTheWayBack();
});
