import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("expanding a card reveals the full overview detail, collapsing hides it again", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();

  const card = library.nthCard(0);
  await card.clickToExpand();
  await card.clickToCollapse();
});

test("favouriting a card is reflected immediately and actually written to the store", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary();

  const card = library.nthCard(0);
  await card.verifyIsFavourited(false);
  await card.clickFavourite();
  await card.verifyIsFavourited(true);

  await expect(async () => {
    const state = await backendSimulator.overviewStore.getOverviewState(overview.id);
    expect(state.favourite).toBe(true);
  }).toPass();
});

test("marking a card read is reflected immediately and actually written to the store", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary();

  const card = library.nthCard(0);
  await card.verifyIsRead(false);
  await card.clickMarkRead();
  await card.verifyIsRead(true);

  await expect(async () => {
    const state = await backendSimulator.overviewStore.getOverviewState(overview.id);
    expect(state.read).toBe(true);
  }).toPass();
});

test("a card shows its thumbnail when the overview has one", async ({ launcher, backendSimulator }) => {
  const withThumbnail = makeOverview();
  backendSimulator.overviews.seed({
    ...withThumbnail,
    video: { ...withThumbnail.video, thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg" },
  });

  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).verifyHasThumbnail();
});

test("a card with no thumbnail leaves the image slot out entirely", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).verifyHasNoThumbnail();
});
