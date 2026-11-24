import type { SocialPost, StoredTranscript } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { OnboardingPageObject } from "../../pageObjects/OnboardingPageObject.testHelper.js";

const signedOutAnswered = { sync: true };
const ADA = { firstName: "Ada", email: SIMULATED_EMAIL, code: "ABCD-EFGH" };
const FACEBOOK_LINK = "https://www.facebook.com/reel/1535600000000001";
const PHOTO_LINK = "https://www.instagram.com/p/C9xYz12AbCd/";
const RECIPE =
  "Sunday basil pesto\n\nTwo cups of basil leaves, half a cup of grated parmesan, a third of a cup of toasted pine nuts and one clove of garlic.\n\nBlend with half a cup of olive oil until smooth, season with salt and lemon, and stir it through hot pasta.";

const FACEBOOK: SocialPost = {
  platform: "facebook",
  id: "1535600000000001",
  url: FACEBOOK_LINK,
  handle: null,
  authorName: "Windowsill Garden",
  description: "Five ways to keep basil alive on a windowsill",
  media: "video",
  durationSeconds: 23,
  coverUrl: null,
  postedAt: "2026-11-21T12:00:00.000Z",
};
const PHOTO: SocialPost = {
  ...FACEBOOK,
  platform: "instagram",
  id: "C9xYz12AbCd",
  url: PHOTO_LINK,
  handle: "windowsillgarden",
  description: RECIPE,
  media: "photo",
  durationSeconds: null,
};
const WORDS: StoredTranscript = {
  videoId: `facebook:${FACEBOOK.id}` as StoredTranscript["videoId"],
  segments: [
    {
      startMs: 0,
      endMs: 23_000,
      text: "Water from below and never over the leaves, pinch out the top so it grows outwards, turn the pot a quarter every morning, and keep it away from cold glass at night.",
    },
  ],
  generated: true,
  fetchedAt: "2026-11-23T09:00:00.000Z",
};

const skipToAccount = async (onboarding: OnboardingPageObject) => {
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account to get your overview.");
};

test("a Facebook video at Start is read on the device's trial, shown back as the post, and written with its captions once the account exists", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith({ status: "read", post: FACEBOOK, transcript: WORDS });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(FACEBOOK_LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Here’s what’s in the Facebook post you saved.");
  await onboarding.verifyVideoTitle("Five ways to keep basil alive on a windowsill");
  await skipToAccount(onboarding);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.openOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("social.kind", "facebook");
  expect(backendSimulator.social.reads()).toEqual([FACEBOOK_LINK]);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("an Instagram photo post at Start is written from its description once the account exists, never read as a page", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.social.answerWith({ status: "read", post: PHOTO, transcript: null });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(PHOTO_LINK);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Here’s what’s in the Instagram post you saved.");
  await onboarding.verifyVideoTitle("Sunday basil pesto");
  await skipToAccount(onboarding);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.openOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("social.media", "photo");
  expect(made?.input).toHaveProperty("article.sections.0.text", RECIPE);
  expect(backendSimulator.articles.reads()).toEqual([]);
});
