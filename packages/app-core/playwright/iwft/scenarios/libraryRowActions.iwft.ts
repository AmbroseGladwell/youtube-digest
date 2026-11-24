import type { Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 844 };

const lasting = (minutes: number): Overview =>
  makeOverview({ source: { ...makeOverview().source, title: `${minutes} minute video`, durationMs: minutes * 60_000 } });

test("below 48rem the row's actions are 40px icons on its timing line, each still named", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);

  await card.verifyActionsAreIconsOnTheTimingLine();
  await card.verifyActionsAreNamed("Favourite", "Mark read", "Listen");
});

test("marking read fills the circle, renames it, and the saved chip takes the timing line's place", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize(PHONE);
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);
  const before = await card.height();

  await card.clickMarkRead();

  await card.verifyIsRead(true);
  await card.verifyActionsAreNamed("Favourite", "Read", "Listen");
  await card.verifySavedChipHoldsTheTimingLinesPlace(before);
  await card.verifySavedChipSays("Saved you 10 minutes");
});

test("an icon names itself when focused, as a tip", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize(PHONE);
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyReadButtonShowsItsNameOnFocus("Mark read");
});

test("Listen becomes Playing on a phone, by name and pressed state", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize(PHONE);
  backendSimulator.overviews.seed(lasting(11));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);

  await card.clickListen();

  await card.verifyActionsAreNamed("Favourite", "Mark read", "Playing");
});
