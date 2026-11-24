import type { Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { DOUBLED_TEXT_SIZE, setTextSize } from "../../support/reflowConditions.testHelper.js";
import {
  makeArticleOverview,
  makeOverview,
  makePodcastOverview,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";

const video = (thumbnailUrl: string | null): Overview => {
  const overview = makeOverview();
  return { ...overview, source: { ...overview.source, thumbnailUrl, durationMs: 698_000 } };
};

test("below 30rem a video's image runs across the top of its tile, with its length on it", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  backendSimulator.overviews.seed(video(IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);

  await card.verifyImageSpansTheTile();
  await card.verifyLengthBadgeReads("11:38");
  await card.verifyLengthShownInTheMeta(false);
  await card.verifyMetaReads("1 min read · 1 min listen · 11:38 video");
  await library.verifyPageDoesNotScrollSideways();
});

test("selecting on a phone puts each tick on its image's corner, as the wide row does", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  backendSimulator.overviews.seed(video(IMAGE));
  const library = await launcher.launchExpectingLibrary();

  await library.startSelecting();

  await library.nthCard(0).verifySelectBoxSitsOnTheImageCorner();
});

test("at the narrowest phone the image still spans the tile and nothing runs off the side", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  backendSimulator.overviews.seed(video(IMAGE));
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyImageSpansTheTile();
  await library.verifyPageDoesNotScrollSideways();
});

for (const [width, imageWidth] of [
  [480, 128],
  [600, 164],
  [767, 176],
] as const) {
  test(`at ${width} wide the row keeps its image beside the text, ${imageWidth}px across`, async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize({ width, height: 900 });
    backendSimulator.overviews.seed(video(IMAGE));
    const library = await launcher.launchExpectingLibrary();

    await library.nthCard(0).verifyImageWidth(imageWidth);
    await library.nthCard(0).verifyLengthBadgeReads("11:38");
    await library.verifyPageDoesNotScrollSideways();
  });
}

test("a video with no image keeps its length in the meta, and has no badge", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  backendSimulator.overviews.seed(video(null));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);

  await card.verifyHasNoThumbnail();
  await card.verifyTitleSpansTheRow();
  await card.verifyLengthBadgeReads(null);
  await card.verifyLengthShownInTheMeta(true);
});

test("an image that fails to load gives its length back to the meta", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://cdn.example/**", (route) => route.abort());
  backendSimulator.overviews.seed(video("https://cdn.example/missing.jpg"));
  const library = await launcher.launchExpectingLibrary();
  const card = library.nthCard(0);

  await card.verifyHasNoThumbnail();
  await card.verifyLengthBadgeReads(null);
  await card.verifyLengthShownInTheMeta(true);
});

test("an episode's square art is matted across the tile, with its length in hours and minutes", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://cdn.example/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: decodeURIComponent(IMAGE.split(",")[1]!) }),
  );
  backendSimulator.overviews.seed(makePodcastOverview());
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyImageSpansTheTile();
  await library.nthCard(0).verifyLengthBadgeReads("1 hr 56 min");
});

test("an article with no image shows its name across the tile, with its reading length", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyImageSpansTheTile();
  await library.nthCard(0).verifyLengthBadgeReads("14 min");
});

test("with 200% text a tablet-wide window keeps the banner, since the switch is in rem", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await setTextSize(page, DOUBLED_TEXT_SIZE);
  backendSimulator.overviews.seed(video(IMAGE));
  const library = await launcher.launchExpectingLibrary();

  await library.nthCard(0).verifyImageSpansTheTile();
  await library.verifyPageDoesNotScrollSideways();
});
