import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a row's Read along opens that note in the reader, and the back link returns to the library", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "A Saved Video" } }));
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await reader.verifyTitle("A Saved Video");

  await reader.clickBackToLibrary();
});

test("the row's title is the same way in to the reader as its Read along action", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).openReaderFromTitle();
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

test("clicking a row's thumbnail opens the same reader its title does", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg" },
  });

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReaderFromThumbnail();
  await reader.verifyTitle(overview.video.title);
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
