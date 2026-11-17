import type { PodcastEpisode, StoredTranscript } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { generationStepsTestIds } from "../../../src/features/newOverview/components/GenerationSteps/GenerationStepsTestIds.js";
import { podcastLinkStatusTestIds } from "../../../src/features/newOverview/components/PodcastLinkStatus/PodcastLinkStatusTestIds.js";
import { transcriptionNoticeTestIds } from "../../../src/features/podcasts/components/TranscriptionNotice/TranscriptionNoticeTestIds.js";

// OV-305: an episode with no transcript anywhere, transcribed from its audio when the reader
// chooses it (designs 305c–305o).
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const LINK = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";
const HOUR = 3600;
const EPISODE: PodcastEpisode = {
  feedUrl: "https://feeds.example/diary.xml",
  guid: "episode-guid",
  title: "Why your parents’ decline is a preview",
  showName: "The Diary Of A CEO",
  publishedAt: "2026-11-10T06:00:00.000Z",
  durationSeconds: HOUR + 56 * 60,
  audioUrl: "https://media.example/episode.mp3",
  pageUrl: null,
  imageUrl: null,
  notes: "This week, ageing.",
  notesKeywords: [],
  transcripts: [],
  chaptersUrl: null,
  linkFrom: "spotify",
};
const ID = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a11";
const WORDS: StoredTranscript = {
  videoId: "podcast:episode" as never,
  segments: [{ startMs: 0, endMs: 4_000, text: "Most decline starts a decade before anyone notices it." }],
  generated: true,
  fetchedAt: "2026-11-16T09:00:00.000Z",
};
const FRESH_MONTH = { usedSeconds: 0, limitSeconds: 5 * HOUR, episodes: 0 };

test("an episode with no transcript says so on its card before Create, and Transcribe and create makes it from the audio", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.checkSays({
    words: "none",
    transcription: { status: "needed", episodeSeconds: EPISODE.durationSeconds, usage: FRESH_MONTH },
  });
  backendSimulator.podcasts.transcribesAs(
    { status: "waiting", id: ID, episodeSeconds: EPISODE.durationSeconds },
    { status: "transcribing", id: ID, episodeSeconds: null },
    { status: "ready", id: ID, transcript: WORDS },
  );
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(podcastLinkStatusTestIds.words)).toHaveText("Needs transcribing · about 2 min");
  await expect(page.getByTestId(podcastLinkStatusTestIds.uses)).toHaveText(
    "Uses 1 hr 56 min of your 5 hr transcribing left, and one overview",
  );
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveText("Transcribe and create");
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(generationStepsTestIds.stepDetail("02"))).toHaveText("None, so we’re making one");
  await expect(page.getByText("Transcribing the episode")).toBeVisible();
  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([{ feedUrl: EPISODE.feedUrl, guid: EPISODE.guid }]);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([]);
});

test("with too little transcribing left, the stop takes Create's place, names what's left and the plans with more", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.checkSays({
    words: "none",
    transcription: {
      status: "not-enough",
      episodeSeconds: EPISODE.durationSeconds,
      usage: { usedSeconds: 3 * HOUR + 50 * 60, limitSeconds: 5 * HOUR, episodes: 2 },
    },
  });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(transcriptionNoticeTestIds.heading)).toHaveText("You don’t have enough transcribing left for this one");
  await expect(page.getByTestId(transcriptionNoticeTestIds.body)).toHaveText(
    "It’s 1 hr 56 min, and you have 1 hr 10 min left this month. You’ll have 5 hours again on 1 November. BYO Plus transcribes 15 hours a month, Plus 30. No overview was used.",
  );
  await expect(page.getByTestId(transcriptionNoticeTestIds.plans)).toHaveText("See plans");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveCount(0);
});

test("when the check couldn't tell, Create asks before transcribing, and choosing it makes the overview", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.checkSays({ words: "unknown" });
  backendSimulator.podcasts.offersTranscribing();
  backendSimulator.podcasts.transcribingUsed(FRESH_MONTH);
  backendSimulator.podcasts.transcribesAs({ status: "ready", id: ID, transcript: WORDS });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveText("Generate");
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(transcriptionNoticeTestIds.heading)).toHaveText("This episode needs transcribing");
  await expect(page.getByTestId(transcriptionNoticeTestIds.foot)).toHaveText(
    "Uses 1 hr 56 min of your 5 hr transcribing left, and one overview",
  );
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
  await page.getByTestId(transcriptionNoticeTestIds.primary).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.podcasts.transcriptionAsks()).toHaveLength(1);
});

test("a transcription that couldn't start says nothing was counted, and Try again asks again", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.checkSays({
    words: "none",
    transcription: { status: "needed", episodeSeconds: EPISODE.durationSeconds, usage: FRESH_MONTH },
  });
  backendSimulator.podcasts.transcribesAs({ status: "failed", id: ID, reason: "no-transcriber" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByTestId(transcriptionNoticeTestIds.heading)).toHaveText("Transcribing couldn’t start");
  await expect(page.getByTestId(transcriptionNoticeTestIds.body)).toContainText(
    "Nothing was counted: no transcribing time and no overview.",
  );
  backendSimulator.podcasts.transcribesAs({ status: "ready", id: ID, transcript: WORDS });
  await page.getByTestId(transcriptionNoticeTestIds.primary).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length, { timeout: 20_000 }).toBe(1);
  expect(backendSimulator.podcasts.transcriptionAsks()).toHaveLength(2);
});

test("Settings › Plan counts the month's transcribing in its own row, and the Plan row names it once some is used", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.transcribingUsed({ usedSeconds: HOUR + 56 * 60, limitSeconds: 5 * HOUR, episodes: 3 });
  await launcher.launch(SIGNED_IN);
  const settings = await launcher.appShell.openSettings();

  await settings.verifyRowReads("plan", "Free · 5 of 5 left · 3 hr 4 min transcribing");
  await settings.openSection("plan");
  await settings.verifyPlanUsageCellReads("transcribing", [
    "3 hr 4 min of 5 hr left",
    "Episodes with no transcript are made from their audio. Ones you’ve transcribed before are free.",
  ]);
});
