import type { StoredTranscript, TikTokRead, TikTokVideo, TranscriptionOffer } from "@overview/domain";
import { limitInPlaceTestIds } from "../../../src/features/plus/components/LimitInPlace/LimitInPlaceTestIds.js";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { justNowListTestIds } from "../../../src/features/newOverview/components/JustNowList/JustNowListTestIds.js";
import { podcastLinkStatusTestIds } from "../../../src/features/newOverview/components/PodcastLinkStatus/PodcastLinkStatusTestIds.js";
import { tiktokLinkStatusTestIds } from "../../../src/features/newOverview/components/TikTokLinkStatus/TikTokLinkStatusTestIds.js";
import { transcriptionNoticeTestIds } from "../../../src/features/podcasts/components/TranscriptionNotice/TranscriptionNoticeTestIds.js";

const SHOTS = process.env.IWFT_SHOTS;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const HOUR = 3600;
const LINK = "https://www.tiktok.com/@nytcooking/video/7438291055512340000";
const VIDEO: TikTokVideo = {
  id: "7438291055512340000",
  url: LINK,
  handle: "nytcooking",
  authorName: "NYT Cooking",
  description: "Crispy smashed potatoes, the only way #cooking",
  durationSeconds: 38,
  coverUrl: null,
  postedAt: "2026-11-18T12:00:00.000Z",
  captions: [],
};
const ID = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a12";
const WORDS: StoredTranscript = {
  videoId: `tiktok:${VIDEO.id}` as StoredTranscript["videoId"],
  segments: [
    {
      startMs: 0,
      endMs: 38_000,
      text: "Boil the potatoes until a knife slides in, smash them flat on a tray, then roast them hot with plenty of oil until the edges go deep brown and crisp, and finish with salt and parsley.",
    },
  ],
  generated: true,
  fetchedAt: "2026-11-23T09:00:00.000Z",
};
const FRESH_MONTH = { usedSeconds: 0, limitSeconds: 5 * HOUR, episodes: 0 };

const uncaptioned = (transcription: TranscriptionOffer): TikTokRead => ({ status: "read", video: VIDEO, transcript: null, transcription });

test("a TikTok with no captions offers to transcribe it, and Transcribe and create makes it from what's said", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith(uncaptioned({ status: "needed", episodeSeconds: 38, usage: FRESH_MONTH }));
  backendSimulator.podcasts.transcribesAs(
    { status: "waiting", id: ID, episodeSeconds: 38 },
    { status: "transcribing", id: ID, episodeSeconds: null },
    { status: "ready", id: ID, transcript: WORDS },
  );
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(tiktokLinkStatusTestIds.looked)).toContainText("Looked for captions · none");
  await expect(page.getByTestId(tiktokLinkStatusTestIds.needs)).toHaveText("Needs transcribing · about 1 min");
  await expect(page.getByTestId(podcastLinkStatusTestIds.uses)).toHaveText("Uses 38 s of your 5 hr transcribing left, and one overview");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveText("Transcribe and create");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130-transcribe-offer.png` });
  }
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(justNowListTestIds.status).last()).toContainText("Transcribing");
  await expect(page.getByText("Transcribing the TikTok")).toBeVisible();
  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.tiktok.transcriptionAsks()).toEqual([LINK]);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("tiktok.handle", "nytcooking");
});

test("with the month's transcribing used, the limit sits under the TikTok, with Make my overview disabled (351g)", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith(
    uncaptioned({ status: "not-enough", episodeSeconds: 38, usage: { usedSeconds: 5 * HOUR, limitSeconds: 5 * HOUR, episodes: 9 } }),
  );
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(limitInPlaceTestIds.heading)).toHaveText("You’ve used this month’s 5 hours of transcribing.");
  await expect(page.getByTestId(limitInPlaceTestIds.root)).toContainText("This TikTok needs about 38 s of it.");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveAttribute("aria-disabled", "true");
});

test("a TikTok whose sound couldn't be fetched says so in TikTok's words, and Try again asks again", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith(uncaptioned({ status: "needed", episodeSeconds: 38, usage: FRESH_MONTH }));
  backendSimulator.podcasts.transcribesAs({ status: "failed", id: ID, reason: "audio-unreachable" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(transcriptionNoticeTestIds.heading)).toHaveText("We couldn’t get the TikTok’s sound");
  backendSimulator.podcasts.transcribesAs({ status: "ready", id: ID, transcript: WORDS });
  await page.getByTestId(transcriptionNoticeTestIds.primary).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.tiktok.transcriptionAsks()).toHaveLength(2);
});
