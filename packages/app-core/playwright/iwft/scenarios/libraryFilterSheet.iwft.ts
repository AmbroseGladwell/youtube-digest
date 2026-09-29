import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const PHONE = { width: 390, height: 760 };

test("the filter sheet opens clear of the bar, rather than sliding its head under it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();

  await library.verifyFilterSheetClearsTheBar();
});

test("the open sheet holds the keyboard, and gives it back to the button that opened it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();
  await library.verifyTabbingStaysInTheFilterSheet(12);

  await library.closeFiltersWithEscape();

  await library.verifyFocusIsOnTheFilterButton();
});
