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

test("the button beside the search marks filters changed from the default, and the sheet's foot shows what they leave", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview({ tags: ["saas"] }));
  backendSimulator.overviews.seed(makeOverview({ tags: ["energy"] }));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  await library.verifyFilterButtonSays("Filters");

  await library.openFilters();
  await library.filterPanel.clickTagChip("saas");
  await library.showResults("Show 1 overview");

  await library.verifyFilterButtonSays("Filters, 1 changed");
  await library.expectCardCountToBe(1);
});
