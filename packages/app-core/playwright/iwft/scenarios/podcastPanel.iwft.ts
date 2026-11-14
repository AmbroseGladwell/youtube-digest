import type { Page } from "@playwright/test";
import { podcastSourceId, VideoId, type PodcastEpisode } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { IwftArticlePagesConfig } from "../../network/IwftArticlePages.testHelper.js";
import { makePodcastOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { episodeOfferTestIds } from "../../../src/features/capture/components/EpisodeOffer/EpisodeOfferTestIds.js";
import { episodeNoTranscriptTestIds } from "../../../src/features/capture/components/EpisodeNoTranscript/EpisodeNoTranscriptTestIds.js";
import { onThisTabLineTestIds } from "../../../src/features/capture/components/OnThisTabLine/OnThisTabLineTestIds.js";
import { capturePageTestIds } from "../../../src/features/capture/CapturePage/CapturePageTestIds.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const LINK = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=1a2b3c4d5e6f";
const EPISODE_TAB = { url: LINK, title: "Why your parents’ decline is a preview | Podcast on Spotify", tabId: 7 };
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
const WORDS = {
  videoId: "podcast:episode" as never,
  segments: [{ startMs: 0, endMs: 4_000, text: "Most decline starts a decade before anyone notices it." }],
  generated: true,
  fetchedAt: "2026-11-13T09:00:00.000Z",
};

// Never asked for the site: the address is all our server needs (106k).
const beside = (page: IwftArticlePagesConfig["page"]): IwftArticlePagesConfig => ({
  page,
  granted: false,
  read: { status: "failed", reason: "nothing-readable" },
});
const chromeAsked = (page: Page) => page.evaluate(() => window.__iwftArticlePages__?.asked ?? []);
const moveTo = (page: Page, next: IwftArticlePagesConfig["page"]) => page.evaluate((to) => window.__iwftArticlePages__?.moveTo(to), next);

test("beside a Spotify episode, the panel finds it, offers it in text, and makes it without asking Chrome", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.wordsAre(WORDS);
  backendSimulator.podcasts.holdReads();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside(EPISODE_TAB) });

  await expect(page.getByTestId(episodeOfferTestIds.finding)).toHaveText("Finding the episode…");
  await expect(page.getByTestId(capturePageTestIds.createButton)).toBeDisabled();
  backendSimulator.podcasts.letReadsGo();

  await expect(page.getByTestId(episodeOfferTestIds.kicker)).toHaveText("The Diary Of A CEO · Podcast · on Spotify");
  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText(EPISODE.title);
  await expect(page.getByTestId(episodeOfferTestIds.facts)).toHaveText("1 hr 56 min · 10 Nov 2026");
  await expect(page.getByTestId(episodeOfferTestIds.card).getByRole("img")).toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.firstTimeNote)).toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.usageLine.root)).toBeVisible();

  await page.getByTestId(capturePageTestIds.createButton).click();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(EPISODE.title);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty(
    "podcast.sharedFrom",
    "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk",
  );
  expect(await chromeAsked(page)).toEqual([]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an episode already in the library offers to read it, and the line on its note offers another episode on the tab", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  const held = makePodcastOverview();
  backendSimulator.overviews.seed({ ...held, source: { ...held.source, id: VideoId.parse(await podcastSourceId(EPISODE)) } });
  const capture = await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside(EPISODE_TAB) });

  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText(EPISODE.title);
  await expect(page.getByTestId(capturePageTestIds.alreadyInLibraryNote)).toHaveText("Already in your library");
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  const reader = await capture.openStoredOverview();
  await reader.verifyOnThisTabLineIsShown(false);

  await moveTo(page, { ...EPISODE_TAB, url: "https://open.spotify.com/episode/0aBcDeFgHiJkLmNoPqRsTu" });
  await reader.verifyOnThisTabLineSays("Another episode on this tab", "Make an overview");

  await page.getByTestId(onThisTabLineTestIds.offer).click();
  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText(EPISODE.title);
  expect(await chromeAsked(page)).toEqual([]);
});

test("on a show's page, the panel says to open an episode, and asks our server nothing", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: beside({
      url: "https://podcasts.apple.com/gb/podcast/the-diary-of-a-ceo/id1291423644",
      title: "The Diary Of A CEO",
      tabId: 7,
    }),
  });

  await expect(page.getByTestId(episodeOfferTestIds.kicker)).toHaveText("Podcast · on Apple Podcasts");
  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText("This is the show’s page");
  await expect(page.getByTestId(episodeOfferTestIds.showPage)).toContainText(
    "Open one of its episodes, and you can make an overview of it here.",
  );
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  expect(backendSimulator.podcasts.reads()).toEqual([]);
});

test("an episode with no transcript says so calmly in place of Create, and moving the tab on clears it", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside(EPISODE_TAB) });

  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText(EPISODE.title);
  await page.getByTestId(capturePageTestIds.createButton).click();

  await expect(page.getByTestId(episodeNoTranscriptTestIds.root)).toContainText("No transcript for this one yet");
  await expect(page.getByTestId(episodeNoTranscriptTestIds.root)).toContainText("No overview was used.");
  await expect(page.getByText("Transcribing is coming soon")).toBeVisible();
  await expect(page.getByTestId(episodeOfferTestIds.title)).toHaveText(EPISODE.title);
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await moveTo(page, { ...EPISODE_TAB, url: "https://open.spotify.com/episode/0aBcDeFgHiJkLmNoPqRsTu" });
  await expect(page.getByTestId(episodeNoTranscriptTestIds.root)).toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.createButton)).toBeEnabled();
});

test("an episode our server can't use says why, with nothing to make and no other link to paste", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "failed", reason: "no-public-feed", showName: "Night Shift Stories" });
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside(EPISODE_TAB) });

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("Night Shift Stories looks like a Spotify exclusive");
  await expect(page.getByTestId(articleFailureNoticeTestIds.way)).toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
});
