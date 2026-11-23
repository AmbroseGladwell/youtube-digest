import type { Page } from "@playwright/test";
import type { StoredTranscript, TikTokVideo } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { IwftTikTokPagesConfig } from "../../network/IwftTikTokPages.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { tiktokOfferTestIds } from "../../../src/features/capture/components/TikTokOffer/TikTokOfferTestIds.js";
import { capturePageTestIds } from "../../../src/features/capture/CapturePage/CapturePageTestIds.js";
import { tiktokLinkStatusTestIds } from "../../../src/features/newOverview/components/TikTokLinkStatus/TikTokLinkStatusTestIds.js";
import { makeTikTokOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SHOTS = process.env.IWFT_SHOTS;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const URL = "https://www.tiktok.com/@bbcnews/video/7438291055512345678";
const TAB = { url: URL, title: "Why is the UK telling people to stockpile? | TikTok", tabId: 9 };
const VIDEO: TikTokVideo = {
  id: "7438291055512345678",
  url: URL,
  handle: "bbcnews",
  authorName: "BBC News",
  description: "Why is the UK telling people to stockpile? #news #uk #explainer",
  durationSeconds: 58,
  coverUrl: null,
  postedAt: "2026-11-18T12:00:00.000Z",
  captions: [{ language: "eng-US", source: "ASR" }],
};
const WORDS: StoredTranscript = {
  videoId: `tiktok:${VIDEO.id}` as StoredTranscript["videoId"],
  segments: [
    {
      startMs: 0,
      endMs: 58_000,
      text: "The government now wants every household to keep three days of food, water and medicine at home, in case of floods, power cuts or cyber attacks, following Sweden and Finland.",
    },
  ],
  generated: true,
  fetchedAt: "2026-11-22T09:00:00.000Z",
};

const onTikTok = { page: TAB, granted: false, read: { status: "failed" as const, reason: "nothing-readable" as const } };
const tiktokPages = (config: Partial<IwftTikTokPagesConfig> = {}): IwftTikTokPagesConfig => ({
  granted: false,
  allows: true,
  read: { status: "read", video: VIDEO, transcript: WORDS },
  ...config,
});
const chromeAskedForTikTok = (page: Page) => page.evaluate(() => window.__iwftTikTokPages__?.asked ?? 0);

test("on a TikTok tab the panel offers it from the tab's title, asks Chrome on the press, and reads it in the browser for free", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: onTikTok, tiktokPages: tiktokPages() });

  const offer = page.getByTestId(tiktokOfferTestIds.card);
  await expect(offer.getByText("On this tab")).toBeVisible();
  await expect(page.getByTestId(tiktokOfferTestIds.tabTitle)).toHaveText("Why is the UK telling people to stockpile?");
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  expect(await chromeAskedForTikTok(page)).toBe(0);

  await page.getByTestId(tiktokOfferTestIds.makeButton).click();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("Why is the UK telling people to stockpile?");
  expect(await chromeAskedForTikTok(page)).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("tiktok.handle", "bbcnews");
  expect(backendSimulator.tiktok.reads()).toEqual([]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("with TikTok already allowed, the offer shows the whole card before the press", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: onTikTok, tiktokPages: tiktokPages({ granted: true }) });

  await expect(page.getByTestId(tiktokLinkStatusTestIds.kicker)).toHaveText("@bbcnews · TikTok");
  await expect(page.getByTestId(tiktokOfferTestIds.makeButton)).toHaveText("Make an overview of this TikTok");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130i-offer.png` });
  }
  expect(backendSimulator.tiktok.reads()).toEqual([]);
});

test("when the browser can't read it, the vendor is asked silently, and only when both fail does the offer say so", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({ status: "read", video: VIDEO, transcript: WORDS });
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTikTok,
    tiktokPages: tiktokPages({ allows: false }),
  });

  await page.getByTestId(tiktokOfferTestIds.makeButton).click();
  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.tiktok.reads()).toEqual([URL]);
});

test("both ways failing says it can't be read right now, that nothing was used, and offers to try again", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({ status: "failed", reason: "no-answer" });
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTikTok,
    tiktokPages: tiktokPages({ granted: true, read: { status: "failed", reason: "no-answer" } }),
  });

  await page.getByTestId(tiktokOfferTestIds.makeButton).click();

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("This TikTok can’t be read right now");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toContainText("Nothing was used.");
  await expect(page.getByTestId(articleFailureNoticeTestIds.way)).toHaveText("Try again");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130i-2-both-failed.png` });
  }
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a TikTok already in the library offers to read it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const held = makeTikTokOverview();
  backendSimulator.overviews.seed({ ...held, source: { ...held.source, id: VIDEO.id as never } });
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: onTikTok, tiktokPages: tiktokPages() });

  await expect(page.getByTestId(capturePageTestIds.readOverviewButton)).toBeVisible();
  await expect(page.getByTestId(tiktokOfferTestIds.card)).toHaveCount(0);
});

test("a TikTok with no captions anywhere is offered to transcribe after the press, and Transcribe and create makes it", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const id = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a13";
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({
    status: "read",
    video: { ...VIDEO, captions: [] },
    transcript: null,
    transcription: { status: "needed", episodeSeconds: 58, usage: { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 } },
  });
  backendSimulator.podcasts.transcribesAs({ status: "transcribing", id, episodeSeconds: 58 }, { status: "ready", id, transcript: WORDS });
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTikTok,
    tiktokPages: tiktokPages({ read: { status: "read", video: { ...VIDEO, captions: [] }, transcript: null } }),
  });

  await page.getByTestId(tiktokOfferTestIds.makeButton).click();

  await expect(page.getByTestId(tiktokOfferTestIds.needs)).toHaveText("No captions · Needs transcribing · about 1 min");
  await expect(page.getByTestId(tiktokOfferTestIds.transcribeButton)).toHaveText("Transcribe and create");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130i-transcribe.png` });
  }
  expect(backendSimulator.tiktok.transcriptionAsks()).toEqual([]);
  await page.getByTestId(tiktokOfferTestIds.transcribeButton).click();

  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.tiktok.transcriptionAsks()).toEqual([URL]);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("tiktok.handle", "bbcnews");
});
