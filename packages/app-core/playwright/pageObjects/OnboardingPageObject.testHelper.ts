import { expect } from "@playwright/experimental-ct-react";
import type { OnboardingStep } from "@overview/domain";
import { onboardingAboutYouTestIds } from "../../src/features/onboarding/components/OnboardingAboutYou/OnboardingAboutYouTestIds.js";
import { onboardingAccountTestIds } from "../../src/features/onboarding/components/OnboardingAccount/OnboardingAccountTestIds.js";
import { onboardingAnalyticsTestIds } from "../../src/features/onboarding/components/OnboardingAnalytics/OnboardingAnalyticsTestIds.js";
import { onboardingPlanTestIds } from "../../src/features/onboarding/components/OnboardingPlan/OnboardingPlanTestIds.js";
import { onboardingProgressBarTestIds } from "../../src/features/onboarding/components/OnboardingProgressBar/OnboardingProgressBarTestIds.js";
import { onboardingSlideTestIds } from "../../src/features/onboarding/components/OnboardingSlide/OnboardingSlideTestIds.js";
import { onboardingStepsForYouTestIds } from "../../src/features/onboarding/components/OnboardingStepsForYou/OnboardingStepsForYouTestIds.js";
import { onboardingTopicsTestIds } from "../../src/features/onboarding/components/OnboardingTopics/OnboardingTopicsTestIds.js";
import { onboardingVideoTestIds } from "../../src/features/onboarding/components/OnboardingVideo/OnboardingVideoTestIds.js";
import { onboardingVoiceTestIds } from "../../src/features/onboarding/components/OnboardingVoice/OnboardingVoiceTestIds.js";
import { onboardingPageTestIds } from "../../src/features/onboarding/OnboardingPage/OnboardingPageTestIds.js";
import { AboutYouSentencePageObject } from "./AboutYouSentencePageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SignInPageObject } from "./SignInPageObject.testHelper.js";

const SCREEN_ROOT: Record<OnboardingStep, string> = {
  analytics: onboardingAnalyticsTestIds.root,
  video: onboardingVideoTestIds.root,
  topics: onboardingTopicsTestIds.root,
  library: onboardingSlideTestIds.root,
  aboutYou: onboardingAboutYouTestIds.root,
  stepsForYou: onboardingStepsForYouTestIds.root,
  voice: onboardingVoiceTestIds.root,
  askYourAi: onboardingSlideTestIds.root,
  moreSources: onboardingSlideTestIds.root,
  account: onboardingAccountTestIds.root,
  plan: onboardingPlanTestIds.root,
};

export class OnboardingPageObject extends PageObject {
  // The overview's progress sits above the screen on a phone and in the preview beside it on a
  // wide screen; only one of the two is shown.
  #progress = (testId: string) => this.get(testId).filter({ visible: true });

  verifyIsShown = (): Promise<OnboardingPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(onboardingPageTestIds.root);
      return this;
    });

  verifyOnScreen = (step: OnboardingStep, heading?: string) =>
    this.step(`verifyOnScreen ${step}`, async () => {
      await this.expectToBeVisible(SCREEN_ROOT[step]);
      if (heading !== undefined) {
        await expect(this.page.getByRole("heading", { level: 1, name: heading })).toBeFocused();
      }
    });

  verifyProgressReads = (phase: string) =>
    this.step(`verifyProgressReads ${phase}`, () =>
      expect(this.#progress(onboardingProgressBarTestIds.phase)).toHaveText(` · ${phase}`),
    );

  verifyCanSeeOverview = () =>
    this.step("verifyCanSeeOverview", () => expect(this.#progress(onboardingProgressBarTestIds.seeOverview)).toBeVisible());

  verifySaysItFailed = () =>
    this.step("verifySaysItFailed", () => expect(this.#progress(onboardingProgressBarTestIds.failed)).toBeVisible());

  seeOverview = () => this.step("seeOverview", () => this.#progress(onboardingProgressBarTestIds.seeOverview).click());

  skip = () => this.step("skip", () => this.click(onboardingPageTestIds.skip));

  back = () => this.step("back", () => this.click(onboardingPageTestIds.back));

  allowAnalytics = () => this.step("allowAnalytics", () => this.click(onboardingAnalyticsTestIds.allow));

  declineAnalytics = () => this.step("declineAnalytics", () => this.click(onboardingAnalyticsTestIds.noThanks));

  verifyAnalyticsDisclosure = () =>
    this.step("verifyAnalyticsDisclosure", async () => {
      await expect(this.get(onboardingAnalyticsTestIds.root)).toContainText(
        "We count which features are used, never what you read or watch.",
      );
      await expect(this.get(onboardingAnalyticsTestIds.policyLink)).toHaveAttribute("href", /\/privacy$/);
      await expect(this.get(onboardingAnalyticsTestIds.policyLink)).toHaveAttribute("target", "_blank");
    });

  verifyVideoTitle = (title: string) =>
    this.step(`verifyVideoTitle ${title}`, () => expect(this.get(onboardingVideoTestIds.title)).toHaveText(title));

  verifyPlaylistTitle = (title: string) =>
    this.step(`verifyPlaylistTitle ${title}`, () => expect(this.get(onboardingVideoTestIds.playlistTitle)).toHaveText(title));

  confirmVideo = () => this.step("confirmVideo", () => this.click(onboardingVideoTestIds.looksRight));

  useDifferentLink = () => this.step("useDifferentLink", () => this.click(onboardingVideoTestIds.differentLink));

  chooseDifferentVideo = (videoId: string) =>
    this.step(`chooseDifferentVideo ${videoId}`, async () => {
      await this.click(onboardingVideoTestIds.chooseDifferent);
      await this.click(onboardingVideoTestIds.entry(videoId));
    });

  pickTopics = (...names: string[]) =>
    this.step(`pickTopics ${names.join(", ")}`, async () => {
      for (const name of names) await this.click(onboardingTopicsTestIds.chip(name));
    });

  typeTopic = (name: string) =>
    this.step(`typeTopic ${name}`, async () => {
      await this.get(onboardingTopicsTestIds.typeField).fill(name);
      await this.click(onboardingTopicsTestIds.pick);
    });

  verifyTopicPressed = (name: string, pressed: boolean) =>
    this.step(`verifyTopicPressed ${name} ${pressed}`, () =>
      expect(this.get(onboardingTopicsTestIds.chip(name))).toHaveAttribute("aria-pressed", String(pressed)),
    );

  verifyTopicCountReads = (text: string | RegExp) =>
    this.step(`verifyTopicCountReads ${text}`, () => expect(this.get(onboardingTopicsTestIds.count)).toHaveText(text));

  continueFromTopics = () => this.step("continueFromTopics", () => this.click(onboardingTopicsTestIds.continue));

  next = () => this.step("next", () => this.click(onboardingSlideTestIds.next));

  get sentence() {
    return new AboutYouSentencePageObject(this.testContext);
  }

  verifyWhatThisChangesShowsExample = (shown: boolean) =>
    this.step(`verifyWhatThisChangesShowsExample ${shown}`, () =>
      shown
        ? expect(this.get(onboardingAboutYouTestIds.why)).toContainText("For a dad who cooks after work")
        : expect(this.get(onboardingAboutYouTestIds.why)).not.toContainText("For a dad who cooks after work"),
    );

  verifySentenceQuoted = (text: string) =>
    this.step("verifySentenceQuoted", () => expect(this.get(onboardingStepsForYouTestIds.quote)).toHaveText(`"${text}"`));

  personalise = () => this.step("personalise", () => this.click(onboardingStepsForYouTestIds.personalise));

  nextFromStepsForYou = () => this.step("nextFromStepsForYou", () => this.click(onboardingStepsForYouTestIds.next));

  continueFromAboutYou = () => this.step("continueFromAboutYou", () => this.click(onboardingAboutYouTestIds.continue));

  continueFromVoice = () => this.step("continueFromVoice", () => this.click(onboardingVoiceTestIds.continue));

  verifyTeaser = ({ title, premise }: { title: string; premise: string }) =>
    this.step(`verifyTeaser ${title}`, async () => {
      await expect(this.get(onboardingAccountTestIds.teaserTitle)).toHaveText(title);
      await expect(this.get(onboardingAccountTestIds.teaserPremise)).toHaveText(premise);
    });

  verifyPageHasNoText = (text: string) =>
    this.step(`verifyPageHasNoText ${text}`, () => expect(this.get(onboardingPageTestIds.root)).not.toContainText(text));

  tryAgain = () => this.step("tryAgain", () => this.click(onboardingAccountTestIds.tryAgain));

  continueWithEmail = (): Promise<SignInPageObject> =>
    this.step("continueWithEmail", async () => {
      await this.click(onboardingAccountTestIds.continueWithEmail);
      return new SignInPageObject(this.testContext);
    });

  signIn = (): Promise<SignInPageObject> =>
    this.step("signIn", async () => {
      await this.click(onboardingAccountTestIds.signIn);
      return new SignInPageObject(this.testContext);
    });

  verifyPlusIsComingSoon = () =>
    this.step("verifyPlusIsComingSoon", async () => {
      await expect(this.get(onboardingPlanTestIds.startPlus)).toHaveText("Coming soon");
      await expect(this.get(onboardingPlanTestIds.startPlus)).toBeDisabled();
    });

  continueWithFree = () => this.step("continueWithFree", () => this.click(onboardingPlanTestIds.continueWithFree));
}
