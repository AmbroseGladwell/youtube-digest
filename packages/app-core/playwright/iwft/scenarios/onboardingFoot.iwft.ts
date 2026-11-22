import type { Page } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { onboardingAboutYouTestIds } from "../../../src/features/onboarding/components/OnboardingAboutYou/OnboardingAboutYouTestIds.js";
import { onboardingAnalyticsTestIds } from "../../../src/features/onboarding/components/OnboardingAnalytics/OnboardingAnalyticsTestIds.js";
import { onboardingProjectsCardTestIds } from "../../../src/features/onboarding/components/OnboardingProjectsCard/OnboardingProjectsCardTestIds.js";
import { onboardingTopicsTestIds } from "../../../src/features/onboarding/components/OnboardingTopics/OnboardingTopicsTestIds.js";
import { onboardingPageTestIds } from "../../../src/features/onboarding/OnboardingPage/OnboardingPageTestIds.js";
import { aboutYouSheetTestIds } from "../../../src/features/settings/components/AboutYouSheet/AboutYouSheetTestIds.js";

const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const PHONE = { width: 390, height: 844 };
const PHONE_AT_200 = { width: 195, height: 422 };
// Tall enough for the projects card to fit whole, short enough that the topics step still scrolls.
const WIDE = { width: 1440, height: 720 };

const reachTopics = async (launcher: Launcher, backendSimulator: BackendSimulator, { allTopics = true } = {}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch({ sync: true });
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.verifyOnScreen("topics");
  if (allTopics) {
    await onboarding.seeAllTopics();
  }
  return onboarding;
};

// Chromium's touch emulation is what makes (pointer: coarse) match.
const useATouchScreen = async (page: Page) => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
};

test("on a phone Continue is on screen with all topics open, and the list scrolls under the foot's fade to its end", async ({
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
  await onboarding.verifyOnScreen("knowledgeBase");
});

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

// At 200% zoom a phone is 195 × 422 CSS px (design 210f).
test("at 200% zoom on a phone Continue is still on screen on arrival", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize(PHONE_AT_200);
  const onboarding = await reachTopics(launcher, backendSimulator, { allTopics: false });

  await onboarding.verifyContinueInReachWithoutScrolling(onboardingTopicsTestIds.continue);
  await onboarding.scrollStepToTheEnd();
  await onboarding.verifyClearOfTheFoot(onboardingTopicsTestIds.count, onboardingTopicsTestIds.continue);
});

test("on a wide screen Continue is in reach in the flow column, and only the flow scrolls beside the projects card", async ({
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

  await onboarding.verifyAsideStaysPut(onboardingProjectsCardTestIds.root, () => onboarding.scrollStepToTheEnd());

  await onboarding.verifyFootFadeIsShown(onboardingTopicsTestIds.continue, false);
  await onboarding.verifyFadeHangsFrom(onboardingPageTestIds.stepper);
  await onboarding.verifyFadeIsShown(true);
  await onboarding.verifyPageDoesNotScrollSideways();
});

test("on a wide screen opening a section of the sentence brings its Done clear of the foot", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize({ width: 1024, height: 760 });
  const onboarding = await reachTopics(launcher, backendSimulator);
  await onboarding.continueFromTopics();
  await onboarding.continueFromKnowledgeBase();
  await onboarding.addContextAboutYou();
  await onboarding.verifyOnScreen("aboutYou");

  await onboarding.sentence.openSection("focus");

  await onboarding.verifyClearOfTheFoot(aboutYouSheetTestIds.done, onboardingAboutYouTestIds.continue);
  await onboarding.verifyContinueIsInView(onboardingAboutYouTestIds.continue);
});
