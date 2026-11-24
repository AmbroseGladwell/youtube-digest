import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const PHONE = { width: 390, height: 760 };
const BUSINESS = makeTopic({ name: "Business" });
const FRESH_ANGLE = {
  novelty: "fresh_angle" as const,
  standsOut: { text: "A new idea.", range: null },
  dubious: false,
  dubiousClaims: [],
  reasoning: "x",
  similarTo: [],
};

test("the filter sheet opens clear of the bar, rather than sliding its head under it", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();

  await library.verifyFilterSheetClearsTheBar();
});

test("on a wide screen the filters open as a popover under the button, and Escape gives the keyboard back to it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize({ width: 1280, height: 800 });
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();
  await library.verifyFiltersAreOpen(true);
  await library.filterMenu.verifyCountReads("1 overview");

  await library.closeFiltersWithEscape();
  await library.verifyFocusIsOnTheFilterButton();
});

test("the open sheet holds the keyboard, and gives it back to the button that opened it", async ({ launcher, backendSimulator, page }) => {
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
  await library.filterMenu.clickTagChip("saas");
  await library.showResults("Show 1 overview");

  await library.verifyFilterButtonSays("Filters, 1 applied");
  await library.expectCardCountToBe(1);
});

test("on a phone the chips under the search keep to one line, with +N opening Applied filters for the rest", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seedTopic(BUSINESS);
  backendSimulator.overviews.seed(makeOverview({ tags: ["founder-interview"], topicIds: [BUSINESS.id], verdict: FRESH_ANGLE }));
  await page.setViewportSize({ width: 360, height: 760 });
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();
  await library.filterMenu.clickTagChip("founder-interview");
  await library.filterMenu.clickTopicChip(BUSINESS.id);
  await library.filterMenu.clickNoveltyChip("fresh_angle");
  await library.showResults("Show 1 overview");

  await library.verifyChipsRead(["Business", "+2"]);
  await library.verifySearchPlaceholderReads("Search within these");
  await library.openMoreChips();
});

test("on a phone sort opens as a sheet with Reset and Done, and the button carries a dot for any order but the default", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.verifyReads("Added, newest first");
  await library.sortMenu.verifyMarkedChanged(false);
  await library.sortMenu.sortBy("oldest");

  await library.sortMenu.verifyReads("Added, oldest first");
  await library.sortMenu.verifyMarkedChanged(true);
  await library.verifySearchPlaceholderReads("Search overviews");
});
