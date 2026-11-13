import type { PodcastEpisode } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { podcastLinkStatusTestIds } from "../../../src/features/newOverview/components/PodcastLinkStatus/PodcastLinkStatusTestIds.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const LINK = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=1a2b3c4d5e6f";
const EPISODE: PodcastEpisode = {
  feedUrl: "https://feeds.example/diary.xml",
  guid: "episode-guid",
  title: "Why your parents’ decline is a preview",
  showName: "The Diary Of A CEO",
  publishedAt: "2026-11-10T06:00:00.000Z",
  durationSeconds: 6948,
  audioUrl: "https://media.example/episode.mp3",
  pageUrl: null,
  imageUrl: null,
  notes: "This week, ageing.",
  notesKeywords: [],
  transcripts: [],
  chaptersUrl: null,
  linkFrom: "spotify",
};

test("a pasted Spotify episode is named before Generate, then found, written, and kept with the link the reader shared", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.wordsAre({
    videoId: "podcast:episode" as never,
    segments: [{ startMs: 0, endMs: 4_000, text: "Most decline starts a decade before anyone notices it." }],
    generated: true,
    fetchedAt: "2026-11-13T09:00:00.000Z",
  });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(podcastLinkStatusTestIds.kicker)).toHaveText("The Diary Of A CEO · Podcast · from Spotify");
  await expect(page.getByTestId(podcastLinkStatusTestIds.title)).toHaveText(EPISODE.title);
  await expect(page.getByTestId(podcastLinkStatusTestIds.facts)).toHaveText("1 hr 56 min · 10 Nov 2026");
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByText("Looking for a transcript")).toBeVisible();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty(
    "podcast.sharedFrom",
    "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
  );
  expect(backendSimulator.podcasts.reads()).toEqual([LINK]);
  expect(backendSimulator.podcasts.transcriptAsks()[0]).toEqual({ feedUrl: EPISODE.feedUrl, guid: EPISODE.guid });
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an episode with no transcript yet says so calmly, that nothing was used, and that transcribing is coming", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(podcastLinkStatusTestIds.found)).toBeVisible();
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByRole("heading", { name: "There’s no transcript for this episode yet" })).toBeVisible();
  await expect(page.getByText("No overview was used.", { exact: false })).toBeVisible();
  await expect(page.getByText("Transcribing is coming soon")).toBeVisible();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a Spotify exclusive is named as one before anything is made, and nothing is offered to generate", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "failed", reason: "no-public-feed", showName: "Night Shift Stories" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("Night Shift Stories looks like a Spotify exclusive");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toContainText("No overview was used.");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveCount(0);
});
