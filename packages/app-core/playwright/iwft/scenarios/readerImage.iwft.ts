import type { Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";
const BROKEN_IMAGE = "https://cdn.example/missing.jpg";

const withImage = (overview: Overview, url: string | null): Overview =>
  ({
    ...overview,
    source: overview.source.kind === "web" ? { ...overview.source, imageUrl: url } : { ...overview.source, thumbnailUrl: url },
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
  await reader.verifyHeadImageSize(176, 99);
  await reader.verifyHeadImageLeadsWith("channel");
  await reader.verifyHeadImageOffers("full");
});

test("the head's image is not dimmed once the note is read", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickMarkRead();
  await reader.verifyIsRead(true);

  await reader.verifyHeadImageOffers("full");
});

test("on a phone the image is the phone row's size, still beside the channel", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadImageSize(112, 63);
  await reader.verifyHeadImageLeadsWith("channel");
  await reader.verifyPageDoesNotScrollSideways();
});

test("a recipe puts its image beside the site's name", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage(makeRecipeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(true);
  await reader.verifyHeadImageLeadsWith("sourceLine");
});

test("an article with no image keeps the head as it was, with no name tile in its place", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage(makeArticleOverview(), null));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(false);
  await reader.verifyAboveTitle("sourceLine");
});

test("an image that fails to load leaves the head as it is with none", async ({ launcher, backendSimulator, page }) => {
  await page.route("https://cdn.example/**", (route) => route.abort());
  backendSimulator.overviews.seed(withImage(makeOverview(), BROKEN_IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(false);
  await reader.verifyAboveTitle("channel");
});

// Design 205b gives the panel the phone's head, image and all. It is the note's own stored
// thumbnail, never taken from the tab.
test("the panel's head carries the note's image, as the phone's does", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(withImage(overview, IMAGE));
  const capture = await launcher.launchPanel({ apiKeys: ANTHROPIC_KEY, activeVideoUrl: overview.source.url });
  const reader = await capture.openStoredOverview();

  await reader.verifyHeadHasImage(true);
});

// OV-151: the image is the control that switches it between the tile and the column's width.

const YOUTUBE_THUMBNAIL = "https://i.ytimg.com/vi/pricing/hqdefault.jpg";
const svg = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#5b6c74"/></svg>`;

test("clicking the image makes it the column's width with who it's from below, and clicking again makes it small", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickHeadImage();
  await reader.verifyHeadImageIsFullWidth();
  await reader.verifyHeadImageAbove("channel");
  await reader.verifyHeadImageOffers("small");
  await reader.verifyHeadImageHasFocus();

  await reader.clickHeadImage();
  await reader.verifyHeadImageSize(176, 99);
  await reader.verifyHeadImageLeadsWith("channel");
  await reader.verifyHeadImageOffers("full");
});

test("the keyboard reaches the image and switches it with Enter or Space", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.pressHeadImageFromKeyboard("Enter");
  await reader.verifyHeadImageOffers("small");
  await reader.verifyHeadImageIconShown(true);

  await reader.pressHeadImageFromKeyboard(" ");
  await reader.verifyHeadImageOffers("full");
});

test("under the pointer the image shows what a click will do, and nothing once the pointer leaves", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadImageIconShown(false);
  await reader.hoverHeadImage();
  await reader.verifyHeadImageIconShown(true);
  await reader.hoverTitle();
  await reader.verifyHeadImageIconShown(false);
});

test("the size chosen is the account's, so the next note opens at it, and it is counted", async ({ launcher, backendSimulator }) => {
  const first = withImage(makeOverview({ savedAt: "2026-09-12T00:00:00.000Z" }), IMAGE);
  const second = withImage(makeOverview({ savedAt: "2026-09-10T00:00:00.000Z" }), IMAGE);
  backendSimulator.overviews.seed(first);
  backendSimulator.overviews.seed(second);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.clickHeadImage();
  await expect.poll(() => launcher.settingsStoreRead()).toMatchObject({ headImageSize: "full" });

  const next = await (await reader.clickBackToLibrary()).nthCard(1).openReader();
  await next.verifyHeadImageIsFullWidth();
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.headImage.resized"))
    .toEqual([{ name: "reader.headImage.resized", props: { overviewId: first.id, size: "full" } }]);
});

test("a reader who chose full width opens every note with an image at it, and on a phone it is the column's width", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  backendSimulator.overviews.seed(withImage(makeRecipeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary({ headImageSize: "full" });
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadImageIsFullWidth();
  await reader.verifyHeadImageAbove("sourceLine");
  await reader.verifyPageDoesNotScrollSideways();
});

test("with full width chosen, a note without an image keeps today's head and has nothing to press", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withImage(makeArticleOverview(), null));
  const library = await launcher.launchExpectingLibrary({ headImageSize: "full" });
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(false);
  await reader.verifyAboveTitle("sourceLine");
});

test("full width asks YouTube for its sharper picture and shows it once it has arrived", async ({ launcher, backendSimulator, page }) => {
  await page.route("https://i.ytimg.com/vi/pricing/hqdefault.jpg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg(480, 360) }),
  );
  await page.route("https://i.ytimg.com/vi/pricing/maxresdefault.jpg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg(1280, 720) }),
  );
  backendSimulator.overviews.seed(withImage(makeOverview(), YOUTUBE_THUMBNAIL));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifySharperHeadImageShown(false);
  await reader.clickHeadImage();
  await reader.verifySharperHeadImageShown(true);
});

test("when YouTube has no sharper picture, the tile's own stays", async ({ launcher, backendSimulator, page }) => {
  await page.route("https://i.ytimg.com/vi/pricing/hqdefault.jpg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg(480, 360) }),
  );
  await page.route("https://i.ytimg.com/vi/pricing/maxresdefault.jpg", (route) =>
    route.fulfill({ status: 404, contentType: "image/svg+xml", body: svg(120, 90) }),
  );
  backendSimulator.overviews.seed(withImage(makeOverview(), YOUTUBE_THUMBNAIL));
  const library = await launcher.launchExpectingLibrary({ headImageSize: "full" });
  const reader = await library.nthCard(0).openReader();

  await reader.verifyHeadHasImage(true);
  await reader.verifySharperHeadImageShown(false);
});

test("Settings › Appearance names the same choice clicking the image makes, and changing it there is counted", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyHeadImageSizeIs("small");
  await settings.appearance.chooseHeadImageSize("full");
  await settings.appearance.verifyStatusReads("Image at the top of a note: Full width. Saved to your account.");
  await expect.poll(() => launcher.settingsStoreRead()).toMatchObject({ headImageSize: "full" });
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "settings.appearance.headImageChosen"))
    .toEqual([{ name: "settings.appearance.headImageChosen", props: { size: "full" } }]);
});

test("the image grows into place, and with reduced motion the head swaps without moving", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.overviews.seed(withImage(makeOverview(), IMAGE));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.clickHeadImage();
  await reader.verifyHeadImageGrows(true);
  await reader.verifyHeadImageIsFullWidth();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await reader.clickHeadImage();
  await reader.verifyHeadImageGrows(false);
  await reader.verifyHeadImageSize(176, 99);
});
