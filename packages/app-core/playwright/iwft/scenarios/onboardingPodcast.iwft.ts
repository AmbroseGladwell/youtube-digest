import type { PodcastEpisode } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { onboardingReadFailureTestIds } from "../../../src/features/onboarding/components/OnboardingReadFailure/OnboardingReadFailureTestIds.js";
import type { OnboardingPageObject } from "../../pageObjects/OnboardingPageObject.testHelper.js";

const signedOutAnswered = { sync: true };
const ADA = { firstName: "Ada", email: SIMULATED_EMAIL, code: "ABCD-EFGH" };
const LINK = "https://podcasts.apple.com/gb/podcast/the-diary-of-a-ceo/id1291423644?i=1000735123456";
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
  linkFrom: "apple",
};
const WORDS = {
  videoId: "podcast:episode" as never,
  segments: [{ startMs: 0, endMs: 4_000, text: "Most decline starts a decade before anyone notices it." }],
  generated: true,
  fetchedAt: "2026-11-13T09:00:00.000Z",
};

const skipToAccount = async (onboarding: OnboardingPageObject) => {
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account to get your overview.");
};

test("an Apple Podcasts link is read on the device's trial and shown back as the episode, and its words are found only once the account exists", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.wordsAre(WORDS);
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Here’s what’s in the episode you saved.");
  await onboarding.verifyVideoTitle(EPISODE.title);
  await onboarding.verifyFound({ kicker: "The Diary Of A CEO · Podcast", facts: "1 hr 56 min · 10 Nov 2026 · from Apple Podcasts" });
  await onboarding.verifyYourLinkLineReads(/^1 hr 56 min from The Diary Of A CEO, turned into an overview you can read in about \d+/);
  await onboarding.verifyPillsRead(/^Read\d+ min$/, /^Listen\d+ min$/, "Share");
  await skipToAccount(onboarding);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([]);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyWaitStageCount(3);
  await onboarding.verifyWaitStage(0, { state: "done", text: "Episode found · 1 hr 56 min" });
  await onboarding.verifyWaitStage(2, { state: "done", text: /^Overview written/ });
  await onboarding.openOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("podcast.sharedFrom", LINK);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([{ feedUrl: EPISODE.feedUrl, guid: EPISODE.guid }]);
  expect(backendSimulator.podcasts.reads()).toEqual([LINK]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an episode with no transcript, where our server doesn't transcribe, is found to have none after the account, and the wait says it failed", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyVideoTitle(EPISODE.title);
  await skipToAccount(onboarding);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([]);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyWaitFailed();
  await onboarding.verifyCanOpenOverview(false);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([
    { feedUrl: EPISODE.feedUrl, guid: EPISODE.guid },
    { feedUrl: EPISODE.feedUrl, guid: EPISODE.guid, searchYouTube: true },
  ]);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a Spotify exclusive is named as one where the read lands, with a field for another link", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "failed", reason: "no-public-feed", showName: "Night Shift Stories" });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl("https://open.spotify.com/episode/1x9QbL0aWm3abcdefghijk");
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await expect(page.getByRole("heading", { name: "Night Shift Stories looks like a Spotify exclusive" })).toBeVisible();
  await expect(page.getByTestId(onboardingReadFailureTestIds.linkField)).toBeVisible();
  await onboarding.verifyOffersTranscribing(false);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([]);
});
