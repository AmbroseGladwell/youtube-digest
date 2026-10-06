import { test } from "../../support/fixtures.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const titled = (title: string, tags: string[]) =>
  makeOverview({ video: { ...makeOverview().video, title }, tags });

const seedLibrary = (backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seed(titled("Side project to forty k", ["saas", "founder-interview", "pricing"]));
  backendSimulator.overviews.seed(titled("Chrome extension money", ["saas", "founder-interview"]));
  backendSimulator.overviews.seed(titled("Nuclear in the UK", ["energy", "nuclear"]));
};

test("the rail lists the library's tags under More filters, most used first, and choosing one filters to it", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.openMoreFilters();
  await library.filterPanel.verifyListsTags(["#founder-interview2", "#saas2", "#energy1", "#nuclear1", "#pricing1"]);

  await library.filterPanel.clickTagChip("saas");

  await library.verifyCardOrder(["Side project to forty k", "Chrome extension money"]);
  await library.filterPanel.verifyMoreFiltersSummaryReads("Any verdict · #saas");
  await library.verifySearchTagReads("#saas");
  await library.verifyCountReads("2 tagged #saas");
});

test("one tag at a time: choosing another swaps it, and the chip in the search clears it", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.clickTagChip("saas");
  await library.filterPanel.clickTagChip("energy");
  await library.verifyCardOrder(["Nuclear in the UK"]);

  await library.removeSearchTag();
  await library.verifyNoSearchTag();
  await library.expectCardCountToBe(3);
});

test("a search typed beside the tag searches within it", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.clickTagChip("saas");
  await library.search("chrome");

  await library.verifyCardOrder(["Chrome extension money"]);
});

test("a link to a tag opens the library filtered to it, with the group it is in open", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await launcher.openPage(Routes.taggedLibrary("founder-interview"));

  await library.expectCardCountToBe(2);
  await library.verifySearchTagReads("#founder-interview");
  await library.filterPanel.verifyMoreFiltersAreOpen();
});

test("past six tags the rest wait behind Show all", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Many tags", ["a1", "a2", "a3", "a4", "a5", "a6"]));
  backendSimulator.overviews.seed(titled("More tags", ["a1", "b1", "b2"]));
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.openMoreFilters();
  await library.filterPanel.verifyListsTags(["#a12", "#a21", "#a31", "#a41", "#a51", "#a61"]);

  await library.filterPanel.clickShowAllTags();
  await library.filterPanel.verifyListsTags(["#a12", "#a21", "#a31", "#a41", "#a51", "#a61", "#b11", "#b21"]);
});

test("a library with no tags has no Tags group at all", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Untagged", []));
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.openMoreFilters();
  await library.filterPanel.verifyOffersNoTags();
});
