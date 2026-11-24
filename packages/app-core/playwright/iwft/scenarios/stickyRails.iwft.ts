import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const DESKTOP = { width: 1280, height: 800 };

test("the sidebar rests on the masthead and stays there while the list scrolls past it", async ({ launcher, backendSimulator, page }) => {
  for (let index = 0; index < 14; index += 1) {
    backendSimulator.overviews.seed(makeOverview());
  }
  await page.setViewportSize(DESKTOP);

  const library = await launcher.launchExpectingLibrary();
  await library.sidebar.verifyRestsOnTheMasthead();
  await library.sidebar.verifyRuleRunsToTheFoot();

  await library.scrollTheList();
  await library.sidebar.verifyRestsOnTheMasthead();
  await library.sidebar.verifyRuleRunsToTheFoot();
});
