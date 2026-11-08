import type { Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { onboardingAboutYouTestIds } from "../../../src/features/onboarding/components/OnboardingAboutYou/OnboardingAboutYouTestIds.js";
import { onboardingAnalyticsTestIds } from "../../../src/features/onboarding/components/OnboardingAnalytics/OnboardingAnalyticsTestIds.js";
import { onboardingTopicsTestIds } from "../../../src/features/onboarding/components/OnboardingTopics/OnboardingTopicsTestIds.js";
import { onboardingVoiceTestIds } from "../../../src/features/onboarding/components/OnboardingVoice/OnboardingVoiceTestIds.js";
import { onboardingPageTestIds } from "../../../src/features/onboarding/OnboardingPage/OnboardingPageTestIds.js";
import { aboutYouSheetTestIds } from "../../../src/features/settings/components/AboutYouSheet/AboutYouSheetTestIds.js";
import { narrationVoicePickerTestIds } from "../../../src/features/settings/components/NarrationVoicePicker/NarrationVoicePickerTestIds.js";

// OV-210, designs 210a–210k: Continue never scrolls off an onboarding step. The step's content
// scrolls and its foot stays at the bottom, topped with OV-166's fade, mirrored, while there
// is content under it (docs/features/onboarding-foot.md).
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const PHONE = { width: 390, height: 844 };
const PHONE_AT_200 = { width: 195, height: 422 };
const WIDE = { width: 1440, height: 640 };
const LAST_VOICE = "bf_isabella";

const reachTopics = async (launcher: Launcher, backendSimulator: BackendSimulator) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch({ sync: true });
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.verifyOnScreen("topics");
  return onboarding;
};

// Chromium's touch emulation is what makes (pointer: coarse) match.
const useATouchScreen = async (page: Page) => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
};

test("on a phone Continue is on screen on arrival at topics, and the list scrolls under the foot's fade to its end", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(PHONE);
  const onboarding = await reachTopics(launcher, backendSimulator);

  await onboarding.verifyStepOverflows(true);
  await onboarding.verifyContinueInReachWithoutScrolling(onboardingTopicsTestIds.continue);
  await onboarding.verifyFootFadeIsShown(onboardingTopicsTestIds.continue, true);
  await onboarding.verifyFootSitsOnTheWindowsEdge(onboardingTopicsTestIds.continue);

  await onboarding.scrollStepToTheEnd();

  await onboarding.verifyFootFadeIsShown(onboardingTopicsTestIds.continue, false);
  await onboarding.verifyClearOfTheFoot(onboardingTopicsTestIds.count, onboardingTopicsTestIds.continue);
  await onboarding.verifyPageDoesNotScrollSideways();
  await onboarding.continueFromTopics();
  await onboarding.verifyOnScreen("library");
});

test("on a phone the voice list scrolls under the foot, and the last voice comes clear of it and can be chosen", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(PHONE);
  const onboarding = await reachTopics(launcher, backendSimulator);
  for (const step of ["topics", "library", "aboutYou", "stepsForYou"] as const) {
    await onboarding.verifyOnScreen(step);
    await onboarding.skip();
  }
  await onboarding.verifyOnScreen("voice");

  await onboarding.verifyStepOverflows(true);
  await onboarding.verifyContinueInReachWithoutScrolling(onboardingVoiceTestIds.continue);
  await onboarding.verifyFootFadeIsShown(onboardingVoiceTestIds.continue, true);
  await onboarding.verifyFootSitsOnTheWindowsEdge(onboardingVoiceTestIds.continue);

  await onboarding.scrollStepToTheEnd();

  await onboarding.verifyClearOfTheFoot(narrationVoicePickerTestIds.row(LAST_VOICE), onboardingVoiceTestIds.continue);
  await onboarding.voicePicker.chooseVoice(LAST_VOICE);
  await onboarding.voicePicker.verifyChosen(LAST_VOICE);
  await onboarding.continueFromVoice();
  await onboarding.verifyOnScreen("askYourAi");
});

// Design 210d: the foot is pinned on every step, so one that fits keeps it where it was.
test("a step that fits shows no fade and doesn't scroll", async ({ page, launcher }) => {
  await page.setViewportSize(PHONE);
  const home = await launcher.launch({ sync: true, analyticsConsent: null });
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics");

  await onboarding.verifyStepOverflows(false);
  await onboarding.verifyContinueInReachWithoutScrolling(onboardingAnalyticsTestIds.allow);
  await onboarding.verifyFootFadeIsShown(onboardingAnalyticsTestIds.allow, false);
});

// Design 210c: on a touch screen the keyboard takes half the screen while a topic is typed.
test("on a touch screen the foot stands aside while a topic is typed, and Pick keeps the field for the next one", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(PHONE);
  const onboarding = await reachTopics(launcher, backendSimulator);

  await onboarding.focusTopicField();
  await onboarding.verifyContinueIsShown(onboardingTopicsTestIds.continue, true);
  await onboarding.leaveTopicField();

  await useATouchScreen(page);
  await onboarding.focusTopicField();
  await onboarding.verifyContinueIsShown(onboardingTopicsTestIds.continue, false);
  await onboarding.typeTopic("Sourdough");
  await onboarding.verifyTopicFieldHasFocus();
  await onboarding.verifyTopicPressed("Sourdough", true);
  await onboarding.leaveTopicField();
  await onboarding.verifyContinueIsShown(onboardingTopicsTestIds.continue, true);
});

// Design 210f: at 200% zoom a phone is 195 × 422 CSS px.
test("at 200% zoom on a phone Continue is still on screen on arrival", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize(PHONE_AT_200);
  const onboarding = await reachTopics(launcher, backendSimulator);

  await onboarding.verifyContinueInReachWithoutScrolling(onboardingTopicsTestIds.continue);
  await onboarding.scrollStepToTheEnd();
  await onboarding.verifyClearOfTheFoot(onboardingTopicsTestIds.count, onboardingTopicsTestIds.continue);
});

// Design 210h: the foot pins inside the flow column, the stepper stays at its top, and the
// preview beside them doesn't move.
test("on a wide screen Continue is in reach in the flow column, and only the flow scrolls beside the preview", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(WIDE);
  const onboarding = await reachTopics(launcher, backendSimulator);

  await onboarding.verifyStepOverflows(true);
  await onboarding.verifyContinueInReachWithoutScrolling(onboardingTopicsTestIds.continue);
  await onboarding.verifyFootFadeIsShown(onboardingTopicsTestIds.continue, true);
  await onboarding.verifyFootSitsOnTheWindowsEdge(onboardingTopicsTestIds.continue);

  await onboarding.verifyPreviewStaysPut(() => onboarding.scrollStepToTheEnd());

  await onboarding.verifyFootFadeIsShown(onboardingTopicsTestIds.continue, false);
  await onboarding.verifyFadeHangsFrom(onboardingPageTestIds.stepper);
  await onboarding.verifyFadeIsShown(true);
  await onboarding.verifyPageDoesNotScrollSideways();
});

// Design 210j: an open section's card runs under the foot, and opening one brings its Done
// above it.
test("on a wide screen opening a section of the sentence brings its Done clear of the foot", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  const onboarding = await reachTopics(launcher, backendSimulator);
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");

  await onboarding.sentence.openSection("focus");

  await onboarding.verifyClearOfTheFoot(aboutYouSheetTestIds.done, onboardingAboutYouTestIds.continue);
  await onboarding.verifyContinueIsInView(onboardingAboutYouTestIds.continue);
});
