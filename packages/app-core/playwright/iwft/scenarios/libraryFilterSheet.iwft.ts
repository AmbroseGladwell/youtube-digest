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

test("a filter applied from the sheet glides the list beneath the sheet, never over it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview({ tags: ["saas"] }));
  backendSimulator.overviews.seed(makeOverview({ tags: ["energy"] }));
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();
  await library.openFilters();

  await library.verifyTheGlideCapturesTheFilterSheet(() => library.filterPanel.clickTagChip("saas"));

  await library.verifyFiltersAreOpen(true);
  await library.showResults("Show 1 overview");
});

test("on a phone the chips under the search keep to one line, with +N opening the sheet for the rest", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seedTopic(BUSINESS);
  backendSimulator.overviews.seed(
    makeOverview({ tags: ["founder-interview"], topicIds: [BUSINESS.id], verdict: FRESH_ANGLE }),
  );
  await page.setViewportSize({ width: 360, height: 760 });
  const library = await launcher.launchExpectingLibrary();

  await library.openFilters();
  await library.filterPanel.clickTagChip("founder-interview");
  await library.filterPanel.clickTopicChip(BUSINESS.id);
  await library.filterPanel.clickNoveltyChip("fresh_angle");
  await library.showResults("Show 1 overview");

  await library.verifyChipsRead(["#founder-interview", "+2"]);
  await library.verifySearchPlaceholderReads("Search within these");
  await library.openMoreChips();
});

test("on a phone sort is an icon beside the search, which shows a short name for any order but the newest", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.verifyCompactReads("", "Newest saved first");
  await library.sortPill.verifyCompactIsACircleAroundTheIcon();
  await library.sortPill.sortBy("oldest");

  await library.sortPill.verifyCompactReads("Oldest", "Oldest saved first");
  await library.verifySearchPlaceholderReads("Search overviews");
});
