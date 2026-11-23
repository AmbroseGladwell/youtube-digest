import type { Page } from "@playwright/test";
import type { StoredTranscript, TikTokRead, TikTokVideo } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { tiktokLinkStatusTestIds } from "../../../src/features/newOverview/components/TikTokLinkStatus/TikTokLinkStatusTestIds.js";
import { makeTikTokOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SHOTS = process.env.IWFT_SHOTS;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const LINK = "https://www.tiktok.com/@bbcnews/video/7438291055512345678?is_from_webapp=1";

const VIDEO: TikTokVideo = {
  id: "7438291055512345678",
  url: "https://www.tiktok.com/@bbcnews/video/7438291055512345678",
  handle: "bbcnews",
  authorName: "BBC News",
  description: "Why is the UK telling people to stockpile? #news #uk #explainer",
  durationSeconds: 58,
  coverUrl: null,
  postedAt: "2026-11-18T12:00:00.000Z",
  captions: [{ language: "eng-US", source: "ASR" }],
};

const SAID =
  "The government now wants every household to keep three days of food, water and medicine at home, in case of floods, power cuts or cyber attacks, and it says this follows similar advice in Sweden and Finland.";

const words = (text = SAID): StoredTranscript => ({
  videoId: `tiktok:${VIDEO.id}` as StoredTranscript["videoId"],
  segments: [{ startMs: 0, endMs: 58_000, text }],
  generated: true,
  fetchedAt: "2026-11-22T09:00:00.000Z",
});

const read = (video: Partial<TikTokVideo> = {}, transcript: StoredTranscript | null = words()): TikTokRead => ({
  status: "read",
  video: { ...VIDEO, ...video },
  transcript,
});

const paste = async (page: Page, link = LINK) => {
  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(link);
};

test("a pasted TikTok shows its card before Create, then is written from the captions its read came with", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith(read());
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(tiktokLinkStatusTestIds.kicker)).toHaveText("@bbcnews · TikTok");
  await expect(page.getByTestId(tiktokLinkStatusTestIds.title)).toHaveText(
    "Why is the UK telling people to stockpile? #news #uk #explainer",
  );
  await expect(page.getByTestId(tiktokLinkStatusTestIds.hashtags)).toHaveText("#news #uk #explainer");
  await expect(page.getByTestId(tiktokLinkStatusTestIds.facts)).toHaveText("0:58 · Posted 18 Nov 2026");
  await expect(page.getByTestId(tiktokLinkStatusTestIds.length)).toHaveText("0:58");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130a-pasted.png` });
  }
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("tiktok.handle", "bbcnews");
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("video.description", VIDEO.description);
  expect(backendSimulator.tiktok.reads()).toEqual([LINK]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("a TikTok with no caption is named for its creator, in italics", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.tiktok.answerWith(read({ description: "", handle: "hankgreen" }));
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(tiktokLinkStatusTestIds.title)).toHaveText("A TikTok by @hankgreen");
});

test("a TikTok with no captions, or almost nothing said, stops before Create and says nothing was used", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith(read({}, null));
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("This TikTok has no captions");
  await expect(page.getByTestId(tiktokLinkStatusTestIds.looked)).toContainText("Looked for captions · none");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130e-no-captions.png` });
  }
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toBeHidden();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  backendSimulator.tiktok.answerWith(
    read({ id: "7438291055512345679", url: "https://www.tiktok.com/@fellwalker/video/7438291055512345679" }, words("Wow. Look at that.")),
  );
  await paste(page, "https://www.tiktok.com/@fellwalker/video/7438291055512345679");
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("There’s no speech in this to make an overview from");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toHaveText("Nothing was used.");
});

test("a TikTok that can't be read says why, never naming who reads it, and a photo post or profile is refused without a read", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.tiktok.answerWith({ status: "failed", reason: "unavailable" });
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("This TikTok is private or has been removed");

  backendSimulator.tiktok.answerWith({ status: "failed", reason: "blocked" });
  await paste(page, "https://www.tiktok.com/@bbcnews/video/7438291055512345670");
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("TikTok didn’t let us read this one");
  await expect(page.getByTestId(articleFailureNoticeTestIds.way)).toHaveText("Try again");

  await paste(page, "https://www.tiktok.com/@bbcnews/photo/7438291055512345671");
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("That’s a photo post, not a video");
  await paste(page, "https://www.tiktok.com/@bbcnews");
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("That’s a profile, not a video");
  expect(backendSimulator.tiktok.reads()).toHaveLength(2);
});

test("when our server can't read TikTok at all, the link says TikTok links aren't working, and other links still do", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("TikTok links aren’t working right now");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toContainText("Links from YouTube, web pages and podcasts still work.");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130n-unavailable.png` });
  }
});

test("a TikTok already in the library offers its overview instead", async ({ page, launcher, backendSimulator }) => {
  const held = makeTikTokOverview();
  backendSimulator.overviews.seed({ ...held, source: { ...held.source, id: VIDEO.id as never } });
  backendSimulator.tiktok.answerWith(read());
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await paste(page);
  await expect(page.getByTestId(tiktokLinkStatusTestIds.held)).toContainText("You already have this TikTok.");
});
