import type { Page } from "@playwright/test";
import { OverviewId, SourceKey, type ArticleRead, type Capture, type StoredTranscript, type TikTokVideo } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { keepForExtensionTestIds } from "../../../src/features/captures/components/KeepForExtension/KeepForExtensionTestIds.js";
import { keptHereBannerTestIds } from "../../../src/features/captures/components/KeptHereBanner/KeptHereBannerTestIds.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const ARTICLE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const READ: ArticleRead = {
  status: "read",
  article: {
    url: ARTICLE_URL,
    title: "The town that pays its bridge bill twice",
    siteName: "The Harbour Post",
    author: "Asha Rao",
    publishedAt: null,
    language: "en",
    imageUrl: null,
    sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011.", links: [] }],
    wordCount: 3200,
    recipe: null,
  },
};
const TIKTOK_URL = "https://www.tiktok.com/@bbcnews/video/7438291055512345678";
const VIDEO: TikTokVideo = {
  id: "7438291055512345678",
  url: TIKTOK_URL,
  handle: "bbcnews",
  authorName: "BBC News",
  description: "Why is the UK telling people to stockpile? #news",
  durationSeconds: 58,
  coverUrl: null,
  postedAt: "2026-11-18T12:00:00.000Z",
  captions: [{ language: "eng-US", source: "ASR" }],
};
const WORDS: StoredTranscript = {
  videoId: `tiktok:${VIDEO.id}` as StoredTranscript["videoId"],
  segments: [{ startMs: 0, endMs: 58_000, text: "The government now wants every household to keep three days of food and water at home." }],
  generated: true,
  fetchedAt: "2026-11-22T09:00:00.000Z",
};

const keptForExtension = (id: string, url: string): Capture => ({
  id: OverviewId.parse(id),
  sourceKey: SourceKey.parse(`kept:${id}`),
  url,
  keptAt: "2026-11-25T09:00:00.000Z",
  keptFrom: "phone",
  captureReason: null,
  title: null,
  thumbnailUrl: null,
  fromPlaylist: null,
  addedAt: null,
  playlistIndex: null,
  chosenAt: null,
  stage: "kept",
  source: null,
  waitingFor: "extension",
  resumesAt: null,
  queueStatus: "waiting",
  problem: null,
});

const paste = (page: Page, link: string) => page.getByTestId(generateOverviewFormTestIds.urlInput).fill(link);

const overviewIds = async (backendSimulator: { overviewStore: { listOverviews: () => Promise<Array<{ id: string }>> } }) =>
  (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.id);

test("an article our server can't read is kept from the web, to be made in the extension", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "blocked" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();
  await paste(page, ARTICLE_URL);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("theharbourpost.example doesn’t let us read it from here");

  await page.getByTestId(keepForExtensionTestIds.keep).click();

  await expect(page.getByTestId(keepForExtensionTestIds.kept)).toHaveText(
    "Kept. It’s made the next time the extension is open on a computer.",
  );
  const [kept] = await backendSimulator.captureStore.list();
  expect(kept).toMatchObject({ stage: "kept", waitingFor: "extension", url: ARTICLE_URL });
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a TikTok our server can't read is kept from the web, to be made in the extension", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({ status: "failed", reason: "blocked" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();
  await paste(page, TIKTOK_URL);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("TikTok didn’t let us read this one");

  await page.getByTestId(keepForExtensionTestIds.keep).click();

  await expect(page.getByTestId(keepForExtensionTestIds.kept)).toBeVisible();
  const [kept] = await backendSimulator.captureStore.list();
  expect(kept).toMatchObject({ stage: "kept", waitingFor: "extension", url: TIKTOK_URL, sourceKey: `tiktok:${VIDEO.id}` });
});

test("the extension reads a kept article in a tab of its own and makes it under the kept id", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.ourKey.isAvailable();
  const kept = keptForExtension("8a9b0c1d-2e3f-4a4b-9c5d-6e7f8a9b0c1d", ARTICLE_URL);
  backendSimulator.captureStore.seed(kept);
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    youTubeFetch: true,
    articlePages: { page: null, granted: true, read: READ },
  });

  await expect.poll(() => overviewIds(backendSimulator), { timeout: 20_000 }).toEqual([kept.id]);
  expect(await page.evaluate(() => window.__iwftArticlePages__?.readAddresses)).toEqual([ARTICLE_URL]);
  expect(await backendSimulator.captureStore.list()).toEqual([]);
});

test("without leave to read the site, the banner asks first, and Allow makes it", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.ourKey.isAvailable();
  const kept = keptForExtension("9b0c1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e", ARTICLE_URL);
  backendSimulator.captureStore.seed(kept);
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    youTubeFetch: true,
    articlePages: { page: null, granted: false, read: READ },
  });

  await expect(page.getByTestId(keptHereBannerTestIds.root)).toContainText(
    "The extension needs your OK to read theharbourpost.example first.",
  );
  expect(await overviewIds(backendSimulator)).toEqual([]);
  await page.getByTestId(keptHereBannerTestIds.allow).click();
  await page.evaluate(() => window.__iwftArticlePages__?.answerChrome(true));

  await expect.poll(() => overviewIds(backendSimulator), { timeout: 20_000 }).toEqual([kept.id]);
});

test("the extension reads a kept TikTok in the browser and makes it under the kept id", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.ourKey.isAvailable();
  const kept = keptForExtension("0c1d2e3f-4a5b-4c6d-9e7f-8a9b0c1d2e3f", TIKTOK_URL);
  backendSimulator.captureStore.seed(kept);
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    youTubeFetch: true,
    articlePages: { page: null, granted: true, read: READ },
    tiktokPages: { granted: true, allows: true, read: { status: "read", video: VIDEO, transcript: WORDS } },
  });

  await expect.poll(() => overviewIds(backendSimulator), { timeout: 20_000 }).toEqual([kept.id]);
  expect(await page.evaluate(() => window.__iwftTikTokPages__?.reads)).toEqual([TIKTOK_URL]);
  expect(backendSimulator.tiktok.reads()).toEqual([]);
});

test("with the month's overviews made, the extension saves a kept article instead, under the kept id", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  const kept = keptForExtension("1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a", ARTICLE_URL);
  backendSimulator.captureStore.seed(kept);
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    youTubeFetch: true,
    articlePages: { page: null, granted: true, read: READ },
  });

  await expect
    .poll(async () => (await backendSimulator.captureStore.list()).map((capture) => [capture.id, capture.stage]), { timeout: 20_000 })
    .toEqual([[kept.id, "saved"]]);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});
