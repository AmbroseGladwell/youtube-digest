import { ShareToken, shareSnapshot, type Overview, type SharePayload } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const TOKEN = ShareToken.parse("k7Qm2x9RfTabcdef");
const SERVER = "https://sync.test";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect width='1280' height='720' fill='%23cccccc'/%3E%3C/svg%3E";
const BROKEN_IMAGE = "https://cdn.example/missing.jpg";

const shared = (thumbnailUrl: string | null): Overview => {
  const overview = makeOverview({ savedAt: "2026-09-20T00:00:00.000Z" });
  return { ...overview, source: { ...overview.source, channel: "Practical Engineering", thumbnailUrl } } as Overview;
};

const signedIn = () => ({
  apiUrl: SERVER,
  token: null,
  accountId: SIMULATED_ACCOUNT_ID,
  email: SIMULATED_EMAIL,
  firstName: "Ada",
});

const sharedPayload = (overview: Overview): SharePayload => ({
  state: "shared",
  token: TOKEN,
  sharedAt: "2026-09-30T11:00:00.000Z",
  snapshot: shareSnapshot({
    overview,
    transcript: makeStoredTranscript({ videoId: overview.source.id! }),
    narration: null,
  }),
});

// OV-191: the shared page draws the reader's own image, small on every visit.

test("the video's image leads the shared head at the tile's size beside the channel, and a click makes it the column's width and back", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload(shared(IMAGE)));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shown = await launcher.sharedOverviewPage.verifyIsShown();

  await shown.headImage.verifyShown(true);
  await shown.headImage.verifySize(176, 99);
  await shown.verifyHeadImageLeadsWithChannel();
  await shown.headImage.verifyOffers("full");

  await shown.headImage.clickImage();
  await shown.headImage.verifyIsFullWidth();
  await shown.verifyHeadImageAboveChannel();
  await shown.headImage.verifyOffers("small");
  await shown.headImage.verifyHasFocus();

  await shown.headImage.clickImage();
  await shown.headImage.verifySize(176, 99);
  await shown.verifyHeadImageLeadsWithChannel();
  await shown.headImage.verifyOffers("full");

  await expect
    .poll(() => backendSimulator.analytics.sharedPage.events().filter(({ name }) => name === "sharedPage.headImage.resized"))
    .toEqual([
      { name: "sharedPage.headImage.resized", props: { size: "full" } },
      { name: "sharedPage.headImage.resized", props: { size: "small" } },
    ]);
});

test("on a phone the shared image is the phone row's size, still beside the channel", async ({ launcher, page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload(shared(IMAGE)));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shown = await launcher.sharedOverviewPage.verifyIsShown();

  await shown.headImage.verifySize(112, 63);
  await shown.verifyHeadImageLeadsWithChannel();
  await shown.verifyPageDoesNotScrollSideways();

  await shown.headImage.clickImage();
  await shown.headImage.verifyIsFullWidth();
  await shown.verifyPageDoesNotScrollSideways();
});

test("a copy shared without an image keeps the head as it was, with nothing to press", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload(shared(null)));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shown = await launcher.sharedOverviewPage.verifyIsShown();

  await shown.headImage.verifyShown(false);
  await shown.verifyChannelAboveTitle();
});

test("an image that fails to load leaves the shared head with none", async ({ launcher, page }) => {
  await page.route("https://cdn.example/**", (route) => route.abort());
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload(shared(BROKEN_IMAGE)));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shown = await launcher.sharedOverviewPage.verifyIsShown();

  await shown.headImage.verifyShown(false);
  await shown.verifyChannelAboveTitle();
});

test("a signed-in reader who chose full width still opens a shared page small, and pressing the image writes nothing to their account", async ({
  launcher,
}) => {
  await launcher.launch({ sync: true, syncConnection: signedIn(), defaultApiUrl: SERVER, headImageSize: "full" });
  await launcher.inlineSharePayload(sharedPayload(shared(IMAGE)));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const shown = await launcher.sharedOverviewPage.verifyIsShown();

  await shown.headImage.verifySize(176, 99);
  await shown.headImage.clickImage();
  await shown.headImage.verifyIsFullWidth();
  await shown.headImage.clickImage();
  await shown.headImage.verifySize(176, 99);

  expect(await launcher.settingsStoreRead()).toMatchObject({ headImageSize: "full" });
});
