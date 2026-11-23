import type { SocialPost, StoredTranscript } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { socialOfferTestIds } from "../../../src/features/capture/components/SocialOffer/SocialOfferTestIds.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { capturePageTestIds } from "../../../src/features/capture/CapturePage/CapturePageTestIds.js";
import { makeSocialOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const REEL_URL = "https://www.instagram.com/reel/DAbCdEfGh12/";
const nothingReadable = { status: "failed" as const, reason: "nothing-readable" as const };
const onTab = (url: string, title: string) => ({ page: { url, title, tabId: 9 }, granted: true, read: nothingReadable });
const REEL: SocialPost = {
  platform: "instagram",
  id: "DAbCdEfGh12",
  url: REEL_URL,
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  description: "Five ways to keep basil alive on a windowsill #basil",
  media: "video",
  durationSeconds: 59,
  coverUrl: null,
  postedAt: "2026-11-21T12:00:00.000Z",
};
const WORDS: StoredTranscript = {
  videoId: `instagram:${REEL.id}` as StoredTranscript["videoId"],
  segments: [
    {
      startMs: 0,
      endMs: 59_000,
      text: "Water from below and never over the leaves, pinch out the top so it grows outwards, turn the pot a quarter every morning, and keep it away from cold glass at night.",
    },
  ],
  generated: true,
  fetchedAt: "2026-11-23T09:00:00.000Z",
};

test("on an Instagram reel's tab the panel offers it from the tab's title, reads it through our server only on the press, never the page", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith({ status: "read", post: REEL, transcript: WORDS });
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTab(REEL_URL, 'Windowsill Garden on Instagram: "Five ways" • Instagram'),
  });

  const offer = page.getByTestId(socialOfferTestIds.card);
  await expect(offer.getByText("On this tab")).toBeVisible();
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  expect(backendSimulator.social.reads()).toEqual([]);

  await page.getByTestId(socialOfferTestIds.makeButton).click();

  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.social.reads()).toEqual([REEL_URL]);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("social.kind", "instagram");
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("a photo post with too little written stops after the press, without writing anything", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith({
    status: "read",
    post: { ...REEL, media: "photo", durationSeconds: null, description: "Sunday vibes" },
    transcript: null,
  });
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTab("https://www.instagram.com/p/C9xYz12AbCd/", "Instagram"),
  });

  await page.getByTestId(socialOfferTestIds.makeButton).click();
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText(
    "There isn’t enough written in this post to make an overview from",
  );
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a reel already in the library offers to read it, and nothing is read", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.overviews.seed(makeSocialOverview());
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: onTab(REEL_URL, "Instagram") });

  await expect(page.getByTestId(capturePageTestIds.readOverviewButton)).toBeVisible();
  await expect(page.getByTestId(socialOfferTestIds.card)).toHaveCount(0);
  expect(backendSimulator.social.reads()).toEqual([]);
});

test("a reel with no words is offered to transcribe after the press, and Transcribe and create makes it", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const id = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a15";
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith({
    status: "read",
    post: REEL,
    transcript: null,
    transcription: { status: "needed", episodeSeconds: 59, usage: { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 } },
  });
  backendSimulator.podcasts.transcribesAs({ status: "ready", id, transcript: WORDS });
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: onTab(REEL_URL, "Instagram") });

  await page.getByTestId(socialOfferTestIds.makeButton).click();
  await expect(page.getByTestId(socialOfferTestIds.needs)).toHaveText("No captions · Needs transcribing · about 1 min");
  await page.getByTestId(socialOfferTestIds.transcribeButton).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.social.transcriptionAsks()).toEqual([REEL_URL]);
});

test("a profile's tab offers nothing", async ({ page, launcher }) => {
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: onTab("https://www.instagram.com/windowsillgarden/", "Windowsill Garden"),
  });
  await expect(page.getByTestId(capturePageTestIds.root)).toBeVisible();
  await expect(page.getByTestId(socialOfferTestIds.card)).toHaveCount(0);
});
