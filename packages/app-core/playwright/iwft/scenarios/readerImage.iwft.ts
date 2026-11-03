import type { Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import {
  makeArticleOverview,
  makeOverview,
  makeRecipeOverview,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";
const BROKEN_IMAGE = "https://cdn.example/missing.jpg";

const withImage = (overview: Overview, url: string | null): Overview =>
  ({
    ...overview,
    source:
      overview.source.kind === "web"
        ? { ...overview.source, imageUrl: url }
        : { ...overview.source, thumbnailUrl: url },
  }) as Overview;

test("a video's image leads the head at the library row's size, with the channel beside it and the title below", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(true);
  await reader.verifyHeadImageSize(168, 94.5);
  await reader.verifyHeadImageLeadsWith("channel");
  await reader.verifyHeadImageIsDecoration();
});

test("the head's image is not dimmed once the note is read", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickMarkRead();
  await reader.verifyIsRead(true);

  await reader.verifyHeadImageIsDecoration();
});

test("on a phone the image is the phone row's size, still beside the channel", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadImageSize(112, 63);
  await reader.verifyHeadImageLeadsWith("channel");
  await reader.verifyPageDoesNotScrollSideways();
});

test("a recipe puts its image beside the site's name", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withImage(makeRecipeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(true);
  await reader.verifyHeadImageLeadsWith("sourceLine");
});

test("an article with no image keeps the head as it was, with no name tile in its place", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withImage(makeArticleOverview(), null));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(false);
  await reader.verifyAboveTitle("sourceLine");
});

test("an image that fails to load leaves the head as it is with none", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.route("https://cdn.example/**", (route) => route.abort());
  backendSimulator.overviews.seed(withImage(makeOverview(), BROKEN_IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(false);
  await reader.verifyAboveTitle("channel");
});

test("the panel's head has no image", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(withImage(overview, IMAGE));
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY, activeVideoUrl: overview.source.url });
  const reader = await capture.openStoredOverview();

  await reader.verifyHeadHasImage(false);
});
