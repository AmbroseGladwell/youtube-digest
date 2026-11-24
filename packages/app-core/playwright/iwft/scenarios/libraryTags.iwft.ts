import { test } from "../../support/fixtures.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const titled = (title: string, tags: string[], savedAt = new Date().toISOString()) =>
  makeOverview({ source: { ...makeOverview().source, title }, tags, savedAt });

const seedLibrary = (backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seed(titled("Side project to forty k", ["saas", "founder-interview", "pricing"], "2026-10-03T09:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Chrome extension money", ["saas", "founder-interview"], "2026-10-02T09:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Nuclear in the UK", ["energy", "nuclear"], "2026-10-01T09:00:00.000Z"));
};

test("the filter menu lists the library's tags under Tags, most used first, and choosing one filters to it", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.verifyListsTags(["#founder-interview2", "#saas2", "#energy1", "#nuclear1", "#pricing1"]);

  await library.filterMenu.clickTagChip("saas");

  await library.verifyCardOrder(["Side project to forty k", "Chrome extension money"]);
  await library.filterMenu.verifyFoldReads("tags", "#saas");
  await library.filterMenu.close();
  await library.verifyChipsRead(["#saas"]);
  await library.verifyCountReads("2 overviews tagged #saas · 2 unread");
});

test("several tags show what has any of them, and each chip under the search takes off only its own", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.clickTagChip("saas");
  await library.filterMenu.clickTagChip("energy");
  await library.expectCardCountToBe(3);
  await library.verifyChipsRead(["#saas", "#energy"]);

  await library.removeChip("tag:saas");
  await library.verifyChipsRead(["#energy"]);
  await library.verifyCardOrder(["Nuclear in the UK"]);

  await library.removeChip("tag:energy");
  await library.verifyNoChips();
});

test("a search typed beside the tag searches within it", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.clickTagChip("saas");
  await library.search("chrome");

  await library.verifyCardOrder(["Chrome extension money"]);
});

test("a link to a tag opens the library filtered to it, with its chip", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await launcher.openPage(Routes.taggedLibrary("founder-interview"));

  await library.expectCardCountToBe(2);
  await library.verifyChipsRead(["Read and unread", "#founder-interview"]);
});

test("past five tags the rest wait behind Show all", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Many tags", ["a1", "a2", "a3", "a4", "a5", "a6"]));
  backendSimulator.overviews.seed(titled("More tags", ["a1", "b1", "b2"]));
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.verifyListsTags(["#a12", "#a21", "#a31", "#a41", "#a51"]);

  await library.filterMenu.clickShowAllTags();
  await library.filterMenu.verifyListsTags(["#a12", "#a21", "#a31", "#a41", "#a51", "#a61", "#b11", "#b21"]);
});

test("a library with no tags has no Tags group at all", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Untagged", []));
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.verifyOffersNoTags();
});
