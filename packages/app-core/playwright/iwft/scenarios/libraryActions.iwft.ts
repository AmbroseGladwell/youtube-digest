import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const WIDE_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";

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

test("the way in and the way back are marked as different journeys for the pane to animate", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  const library = await launcher.launchExpectingLibrary();

  const reader = await library.nthCard(0).openReader();
  await launcher.appShell.verifyNavigationDirection("forward");

  await reader.clickBackToLibrary();
  await launcher.appShell.verifyNavigationDirection("back");
});

// The two rows differ only in whether a thumbnail was ever stored, and on a phone neither
// shows one — so they have to lay out identically. They don't get there by the same route:
// a hidden thumbnail is still the first child in the tree, so the selector that gives a
// thumbnail-less row its own grid fires for one of them and not the other.
test("on a phone a row drops its thumbnail, whether or not one was ever saved", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  const withThumbnail = makeOverview();
  backendSimulator.overviews.seed({
    ...withThumbnail,
    video: { ...withThumbnail.video, thumbnailUrl: WIDE_THUMBNAIL },
  });
  const withoutThumbnail = makeOverview({ savedAt: "2026-09-10T00:00:00.000Z" });
  backendSimulator.overviews.seed({
    ...withoutThumbnail,
    video: { ...withoutThumbnail.video, thumbnailUrl: null },
  });
  await page.setViewportSize({ width: 375, height: 800 });

  const library = await launcher.launchExpectingLibrary();

  for (const index of [0, 1]) {
    await library.nthCard(index).verifyHasNoThumbnail();
    await library.nthCard(index).verifyTitleSpansTheRow();
    await library.nthCard(index).verifyActionsAreTouchSized();
    await library.nthCard(index).verifyActionsLineUpWithTheTitle();
  }
});

// The row and the note are one claim about the same overview, so they must not be able to
// disagree — both read overviewMetaParts rather than estimating separately.
test("a row prints its read, listen and video times, and the note it opens says the same", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, durationMs: 698_000 },
  });

  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).verifyMetaReads("1 min read · 1 min listen · 11:38 video");

  const reader = await library.nthCard(0).openReader();
  await reader.verifyMetaReads("1 min read · 1 min listen · 11:38 video");
});

test("a row drops the video term when the source recorded no duration, rather than guessing", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: { ...overview.video, durationMs: null },
  });

  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyMetaReads("1 min read · 1 min listen");
});

test("a row carries no chrome until you point at it, and its text doesn't move when it does", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.overviews.seed(makeOverview({ savedAt: "2026-09-10T00:00:00.000Z" }));

  const library = await launcher.launchExpectingLibrary();
  const row = library.nthCard(0);

  await row.verifyHasNoChrome();
  const atRest = await row.titleLeftEdge();

  await row.hoverTitle();
  await row.verifyShowsItsTile();
  await library.nthCard(1).verifyHasNoChrome();

  // The tile bleeds outwards rather than pushing the text in, so nothing reflows under the
  // pointer — which is the whole reason the inline padding is given back as a margin.
  expect(await row.titleLeftEdge()).toBe(atRest);

  await page.mouse.move(0, 0);
  await row.verifyHasNoChrome();
});

test("the tile follows keyboard focus, so a row hunted by tab looks the same as one pointed at", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.overviews.seed(makeOverview({ savedAt: "2026-09-10T00:00:00.000Z" }));

  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(1).focusFirstControl();

  await library.nthCard(1).verifyShowsItsTile();
  await library.nthCard(0).verifyHasNoChrome();
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
