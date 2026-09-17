import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const DESKTOP = { width: 1280, height: 800 };

test("the library's rail rests on the masthead and stays there while the list scrolls past it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  for (let index = 0; index < 14; index += 1) {
    backendSimulator.overviews.seed(makeOverview());
  }
  await page.setViewportSize(DESKTOP);

  const library = await launcher.launchExpectingLibrary();
  await library.verifyRailRestsOnTheMasthead();
  await library.verifyRailDividerRunsToTheFoot();

  await library.scrollTheList();
  await library.verifyRailRestsOnTheMasthead();
  await library.verifyRailDividerRunsToTheFoot();
});

test("the reader's rail rests under the tab strip and stays there while the note scrolls past it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(
    makeOverview({
      keyPoints: Array.from({ length: 24 }, (_, index) => `Key point number ${index + 1}, at some length.`),
    }),
  );
  await page.setViewportSize(DESKTOP);

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyRailRestsUnderTheTabs();
  await reader.verifyRailDividerMeetsThePlayerBar();

  await reader.scrollTheNote();
  await reader.verifyRailRestsUnderTheTabs();
  await reader.verifyRailDividerMeetsThePlayerBar();
});
