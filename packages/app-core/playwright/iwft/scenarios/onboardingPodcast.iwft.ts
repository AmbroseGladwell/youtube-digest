import type { PodcastEpisode } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { onboardingReadFailureTestIds } from "../../../src/features/onboarding/components/OnboardingReadFailure/OnboardingReadFailureTestIds.js";

const signedOutAnswered = { sync: true };
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

test("an Apple Podcasts link is read on the device's trial, confirmed as the right episode, and made once the questions are passed", async ({
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
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right episode?");
  await onboarding.verifyVideoTitle(EPISODE.title);
  await onboarding.verifyFound({ kicker: "The Diary Of A CEO · Podcast", facts: "1 hr 56 min · 10 Nov 2026" });
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.seeOverview();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaserReads({
    byline: "The Diary Of A CEO · Podcast · 1 hr 56 min",
    locked: "Key points, How to apply and Verdict open with an account.",
  });
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("podcast.sharedFrom", LINK);
  expect(backendSimulator.podcasts.reads()).toEqual([LINK]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an episode with no transcript stops at the confirm step, says so, and leaves the free overview unused", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(LINK);
  await launcher.onboardingPage.verifyIsShown();

  await expect(page.getByRole("heading", { name: "There’s no transcript for this episode yet" })).toBeVisible();
  await expect(page.getByTestId(onboardingReadFailureTestIds.comingSoon)).toHaveText("Transcribing is coming soon");
  await expect(page.getByText("Your free overview hasn't been used.", { exact: false })).toBeVisible();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a Spotify exclusive is named as one at the confirm step, with a field for another link", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.podcasts.answerWith({ status: "failed", reason: "no-public-feed", showName: "Night Shift Stories" });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl("https://open.spotify.com/episode/1x9QbL0aWm3abcdefghijk");
  await launcher.onboardingPage.verifyIsShown();

  await expect(page.getByRole("heading", { name: "Night Shift Stories looks like a Spotify exclusive" })).toBeVisible();
  await expect(page.getByTestId(onboardingReadFailureTestIds.linkField)).toBeVisible();
});
