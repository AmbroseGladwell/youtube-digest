import type { StoredTranscript, TikTokVideo } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { OnboardingPageObject } from "../../pageObjects/OnboardingPageObject.testHelper.js";

const signedOutAnswered = { sync: true };
const ADA = { firstName: "Ada", email: SIMULATED_EMAIL, code: "ABCD-EFGH" };
const LINK = "https://www.tiktok.com/@bbcnews/video/7438291055512345678";
const VIDEO: TikTokVideo = {
  id: "7438291055512345678",
  url: LINK,
  handle: "bbcnews",
  authorName: "BBC News",
  description: "Why is the UK telling people to stockpile? #news",
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

const skipToAccount = async (onboarding: OnboardingPageObject) => {
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account to get your overview.");
};

test("a TikTok link at Start is read on the device's trial, shown back as the TikTok, and written with its captions once the account exists", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({ status: "read", video: VIDEO, transcript: WORDS });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Here’s what’s in the TikTok you saved.");
  await onboarding.verifyVideoTitle("Why is the UK telling people to stockpile?");
  await skipToAccount(onboarding);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.openOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("tiktok.handle", "bbcnews");
  expect(backendSimulator.tiktok.reads()).toEqual([LINK]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("a TikTok with no captions says on Your link that it will be transcribed, and is, once the account exists", async ({
  launcher,
  backendSimulator,
}) => {
  const id = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a14";
  backendSimulator.ourKey.isAvailable();
  backendSimulator.tiktok.answerWith({
    status: "read",
    video: { ...VIDEO, captions: [] },
    transcript: null,
    transcription: { status: "needed", episodeSeconds: 58, usage: { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 } },
  });
  backendSimulator.podcasts.transcribesAs({ status: "waiting", id, episodeSeconds: 58 }, { status: "ready", id, transcript: WORDS });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyNoticeReads(
    "There are no captions, so we’ll make a transcript from its sound: 58 s of your 5 free hours this month.",
  );
  await skipToAccount(onboarding);
  expect(backendSimulator.tiktok.transcriptionAsks()).toEqual([]);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyCanOpenOverview(true);
  expect(backendSimulator.tiktok.transcriptionAsks()).toEqual([VIDEO.url]);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("tiktok.handle", "bbcnews");
});
