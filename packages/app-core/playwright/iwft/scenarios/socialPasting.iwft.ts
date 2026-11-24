import type { SocialPost, SocialRead, StoredTranscript, TranscriptionOffer } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { justNowListTestIds } from "../../../src/features/newOverview/components/JustNowList/JustNowListTestIds.js";
import { socialLinkStatusTestIds } from "../../../src/features/newOverview/components/SocialLinkStatus/SocialLinkStatusTestIds.js";

const SHOTS = process.env.IWFT_SHOTS;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const HOUR = 3600;
const REEL_LINK = "https://www.instagram.com/reel/DAbCdEfGh12/?igsh=abc";
const PHOTO_LINK = "https://www.instagram.com/p/C9xYz12AbCd/";
const FACEBOOK_LINK = "https://www.facebook.com/reel/1535600000000001";
const RECIPE =
  "Sunday basil pesto\n\nTwo cups of basil leaves, half a cup of grated parmesan, a third of a cup of toasted pine nuts and one clove of garlic.\n\nBlend with half a cup of olive oil until smooth, season with salt and lemon, and stir it through hot pasta with a splash of the cooking water.";

const REEL: SocialPost = {
  platform: "instagram",
  id: "DAbCdEfGh12",
  url: "https://www.instagram.com/reel/DAbCdEfGh12/",
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  description: "Five ways to keep basil alive on a windowsill #basil #herbs",
  media: "video",
  durationSeconds: 59,
  coverUrl: null,
  postedAt: "2026-11-21T12:00:00.000Z",
};
const PHOTO: SocialPost = { ...REEL, id: "C9xYz12AbCd", url: PHOTO_LINK, description: RECIPE, media: "photo", durationSeconds: null };
const FACEBOOK: SocialPost = {
  ...REEL,
  platform: "facebook",
  id: "1535600000000001",
  url: FACEBOOK_LINK,
  handle: null,
  durationSeconds: 23,
};

const ID = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a13";
const words = (post: SocialPost): StoredTranscript => ({
  videoId: `${post.platform}:${post.id}` as StoredTranscript["videoId"],
  segments: [
    {
      startMs: 0,
      endMs: 59_000,
      text: "Water from below and never over the leaves, pinch out the top so it grows outwards, turn the pot a quarter every morning, and keep it away from cold glass at night.",
    },
  ],
  generated: true,
  fetchedAt: "2026-11-23T09:00:00.000Z",
});
const read = (post: SocialPost, transcript: StoredTranscript | null, transcription?: TranscriptionOffer): SocialRead => ({
  status: "read",
  post,
  transcript,
  ...(transcription === undefined ? {} : { transcription }),
});

test("an Instagram reel with no words offers to transcribe it, and Transcribe and create makes it from what's said", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith(
    read(REEL, null, { status: "needed", episodeSeconds: 59, usage: { usedSeconds: 0, limitSeconds: 5 * HOUR, episodes: 0 } }),
  );
  backendSimulator.podcasts.transcribesAs(
    { status: "transcribing", id: ID, episodeSeconds: null },
    { status: "ready", id: ID, transcript: words(REEL) },
  );
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(REEL_LINK);
  await expect(page.getByTestId(socialLinkStatusTestIds.kicker)).toHaveText("@windowsillgarden · Instagram");
  await expect(page.getByTestId(socialLinkStatusTestIds.title)).toHaveText("Five ways to keep basil alive on a windowsill");
  await expect(page.getByTestId(socialLinkStatusTestIds.facts)).toHaveText("0:59 · Posted 21 Nov 2026");
  await expect(page.getByTestId(socialLinkStatusTestIds.looked)).toContainText("Looked for captions · none");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveText("Transcribe and create");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/365-reel-pasted.png` });
  }
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(justNowListTestIds.status).last()).toContainText("Transcribing");
  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.social.transcriptionAsks()).toEqual([REEL.url]);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("social.kind", "instagram");
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("video.description", REEL.description);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an Instagram photo post is written from its whole description, never read as a page", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith(read(PHOTO, null));
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(PHOTO_LINK);
  await expect(page.getByTestId(socialLinkStatusTestIds.title)).toHaveText("Sunday basil pesto");
  await expect(page.getByTestId(socialLinkStatusTestIds.facts)).toHaveText("Photo post · 56 words · Posted 21 Nov 2026");
  await expect(page.getByTestId(socialLinkStatusTestIds.looked)).toHaveCount(0);
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  const input = backendSimulator.ourKey.generations()[0]?.input;
  expect(input).toHaveProperty("social.media", "photo");
  expect(input).toHaveProperty("article.siteName", "Instagram");
  expect(input).toHaveProperty("article.sections.0.text", RECIPE);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("a Facebook video comes with its captions, and a post with too little written stops before Create", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith(read({ ...PHOTO, platform: "facebook", media: "text", description: "Sunday vibes" }, null));
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill("https://www.facebook.com/share/p/1AbCdEfGhJ/");
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText(
    "There isn’t enough written in this post to make an overview from",
  );
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveCount(0);

  backendSimulator.social.answerWith(read(FACEBOOK, words(FACEBOOK)));
  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(FACEBOOK_LINK);
  await expect(page.getByTestId(socialLinkStatusTestIds.kicker)).toHaveText("Windowsill Garden · Facebook");
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("social.kind", "facebook");
  expect(backendSimulator.social.transcriptionAsks()).toEqual([]);
});
