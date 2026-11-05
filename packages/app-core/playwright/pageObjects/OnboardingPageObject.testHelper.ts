import { expect } from "@playwright/experimental-ct-react";
import type { OnboardingStep } from "@overview/domain";
import { onboardingAboutYouTestIds } from "../../src/features/onboarding/components/OnboardingAboutYou/OnboardingAboutYouTestIds.js";
import { onboardingAccountTestIds } from "../../src/features/onboarding/components/OnboardingAccount/OnboardingAccountTestIds.js";
import { onboardingAnalyticsTestIds } from "../../src/features/onboarding/components/OnboardingAnalytics/OnboardingAnalyticsTestIds.js";
import { onboardingPlanTestIds } from "../../src/features/onboarding/components/OnboardingPlan/OnboardingPlanTestIds.js";
import { onboardingPreviewTestIds } from "../../src/features/onboarding/components/OnboardingPreview/OnboardingPreviewTestIds.js";
import { onboardingPreviewStepsTestIds } from "../../src/features/onboarding/components/OnboardingPreviewSteps/OnboardingPreviewStepsTestIds.js";
import { onboardingProgressBarTestIds } from "../../src/features/onboarding/components/OnboardingProgressBar/OnboardingProgressBarTestIds.js";
import { onboardingReadFailureTestIds } from "../../src/features/onboarding/components/OnboardingReadFailure/OnboardingReadFailureTestIds.js";
import { onboardingSourceCardTestIds } from "../../src/features/onboarding/components/OnboardingSourceCard/OnboardingSourceCardTestIds.js";
import { onboardingTeaserTestIds } from "../../src/features/onboarding/components/OnboardingTeaser/OnboardingTeaserTestIds.js";
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

  // On a wide screen the preview says it in a sentence; narrower, the line above the screen does.
  verifyPreviewSays = (status: string) =>
    this.step(`verifyPreviewSays ${status}`, () => expect(this.get(onboardingPreviewTestIds.status)).toHaveText(status));

  verifyReadyLineReads = (line: string) =>
    this.step(`verifyReadyLineReads ${line}`, () =>
      expect(this.#progress(onboardingProgressBarTestIds.status)).toHaveText(line),
    );

  verifyHasNoProgressBar = () =>
    this.step("verifyHasNoProgressBar", () => expect(this.get(onboardingProgressBarTestIds.root)).toHaveCount(0));

  verifyWritingHasStarted = () =>
    this.step("verifyWritingHasStarted", () => expect(this.#progress(onboardingProgressBarTestIds.root)).toBeVisible());

  verifyPreviewMarksNow = (step: "source" | "topics" | "you" | null) =>
    this.step(`verifyPreviewMarksNow ${step}`, async () => {
      for (const row of ["source", "topics", "you"] as const) {
        const marked = this.get(onboardingPreviewStepsTestIds.row(row));
        if (row === step) await expect(marked).toHaveAttribute("aria-current", "step");
        else await expect(marked).not.toHaveAttribute("aria-current");
      }
    });

  verifyPreviewStepReads = (step: "source" | "topics" | "you", value: string) =>
    this.step(`verifyPreviewStepReads ${step} ${value}`, () =>
      expect(this.get(onboardingPreviewStepsTestIds.value(step))).toHaveText(value),
    );

  verifyPreviewMadeWith = (...pills: string[]) =>
    this.step(`verifyPreviewMadeWith ${pills.join(", ")}`, () =>
      expect(this.get(onboardingPreviewTestIds.madeWith).locator("span")).toHaveText(pills),
    );

  verifyCanSeeOverview = () =>
    this.step("verifyCanSeeOverview", () => expect(this.#progress(onboardingProgressBarTestIds.seeOverview)).toBeVisible());

  verifySaysItFailed = () =>
    this.step("verifySaysItFailed", () =>
      expect(
        this.#progress(onboardingProgressBarTestIds.failed).or(
          this.get(onboardingPreviewTestIds.status).filter({ visible: true, hasText: "Couldn't make your overview" }),
        ),
      ).toBeVisible(),
    );

  verifyPreviewOffersTryAgain = () =>
    this.step("verifyPreviewOffersTryAgain", () => expect(this.get(onboardingPreviewTestIds.tryAgain)).toBeVisible());

  seeOverview = () => this.step("seeOverview", () => this.#progress(onboardingProgressBarTestIds.seeOverview).click());

  skip = () => this.step("skip", () => this.click(onboardingPageTestIds.skip));

  back = () => this.step("back", () => this.click(onboardingPageTestIds.back));

  allowAnalytics = () => this.step("allowAnalytics", () => this.click(onboardingAnalyticsTestIds.allow));

  // A sample has no overview being made, so there's no See your overview: the way to the account
  // is through the screens, answering analytics if it's asked and skipping the rest.
  skipToAccount = () =>
    this.step("skipToAccount", async () => {
      await expect(this.get(onboardingAnalyticsTestIds.root).or(this.get(onboardingTopicsTestIds.root))).toBeVisible();
      if (await this.get(onboardingAnalyticsTestIds.root).isVisible()) await this.declineAnalytics();
      for (const step of ["topics", "library", "aboutYou", "stepsForYou", "voice", "askYourAi", "moreSources"] as const) {
        await this.verifyOnScreen(step);
        await this.skip();
      }
      await this.verifyOnScreen("account");
    });

  declineAnalytics = () => this.step("declineAnalytics", () => this.click(onboardingAnalyticsTestIds.noThanks));

  verifyAnalyticsDisclosure = () =>
    this.step("verifyAnalyticsDisclosure", async () => {
      await expect(this.get(onboardingAnalyticsTestIds.shared)).toContainText(
        "Which features you use, never what you read, watch or type. Errors are reported either way",
      );
      await expect(this.get(onboardingAnalyticsTestIds.shared)).toContainText("Change it any time in Settings › Privacy.");
      await expect(this.get(onboardingAnalyticsTestIds.policyLink)).toHaveAttribute("href", /\/privacy$/);
      await expect(this.get(onboardingAnalyticsTestIds.policyLink)).toHaveAttribute("target", "_blank");
    });

  verifyVideoTitle = (title: string) =>
    this.step(`verifyVideoTitle ${title}`, () => expect(this.#confirm(onboardingSourceCardTestIds.title)).toHaveText(title));

  verifyFound = ({ kicker, facts }: { kicker?: string; facts: string | RegExp }) =>
    this.step(`verifyFound ${facts}`, async () => {
      if (kicker !== undefined) await expect(this.#confirm(onboardingSourceCardTestIds.kicker)).toHaveText(kicker);
      await expect(this.#confirm(onboardingSourceCardTestIds.facts)).toHaveText(facts);
    });

  #confirm = (testId: string) => this.get(onboardingVideoTestIds.root).getByTestId(testId);

  verifyReadFailure = ({ title, link }: { title: string; link: string }) =>
    this.step(`verifyReadFailure ${title}`, async () => {
      await expect(this.page.getByRole("heading", { level: 1, name: title })).toBeFocused();
      await expect(this.get(onboardingReadFailureTestIds.link)).toHaveText(link);
      await expect(this.get(onboardingReadFailureTestIds.root)).toContainText("Your free overview hasn't been used.");
    });

  verifyOffersTryAgain = (offered: boolean) =>
    this.step(`verifyOffersTryAgain ${offered}`, () =>
      expect(this.get(onboardingReadFailureTestIds.tryAgain)).toHaveCount(offered ? 1 : 0),
    );

  verifyTellsOfExtension = (told: boolean) =>
    this.step(`verifyTellsOfExtension ${told}`, () =>
      expect(this.get(onboardingReadFailureTestIds.extension)).toHaveCount(told ? 1 : 0),
    );

  verifyAnotherLinkAsks = (placeholder: string) =>
    this.step(`verifyAnotherLinkAsks ${placeholder}`, () =>
      expect(this.get(onboardingReadFailureTestIds.linkField)).toHaveAttribute("placeholder", placeholder),
    );

  tryAnotherLink = (link: string) =>
    this.step(`tryAnotherLink ${link}`, async () => {
      await this.get(onboardingReadFailureTestIds.linkField).fill(link);
      await this.get(onboardingReadFailureTestIds.linkField).press("Enter");
    });

  verifyFindingReads = (text: string) =>
    this.step(`verifyFindingReads ${text}`, () => expect(this.get(onboardingVideoTestIds.finding)).toHaveText(text));

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

  verifySuggests = (heading: string, ...names: string[]) =>
    this.step(`verifySuggests ${names.join(", ")}`, async () => {
      await expect(this.page.getByRole("group", { name: heading })).toBeVisible();
      await expect(this.get(onboardingTopicsTestIds.suggested).getByRole("button")).toHaveText(names);
    });

  verifySuggestsNothing = () =>
    this.step("verifySuggestsNothing", async () => {
      await this.expectToBeVisible(onboardingTopicsTestIds.root);
      await expect(this.get(onboardingTopicsTestIds.suggested)).toHaveCount(0);
    });

  verifySuggestionIsNew = (name: string) =>
    this.step(`verifySuggestionIsNew ${name}`, () =>
      expect(this.get(onboardingTopicsTestIds.suggestion(name))).toHaveAccessibleName(`${name}, new topic`),
    );

  pickSuggestion = (name: string) => this.step(`pickSuggestion ${name}`, () => this.click(onboardingTopicsTestIds.suggestion(name)));

  verifyLibrarySlide = ({ lead, scene }: { lead: string; scene: string[] }) =>
    this.step("verifyLibrarySlide", async () => {
      await expect(this.get(onboardingSlideTestIds.lead)).toHaveText(lead);
      for (const text of scene) await expect(this.get(onboardingSlideTestIds.scene)).toContainText(text);
      await expect(this.get(onboardingSlideTestIds.scene)).not.toContainText("arriving");
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
      await expect(this.get(onboardingTeaserTestIds.title)).toHaveText(title);
      await expect(this.get(onboardingTeaserTestIds.first)).toHaveText(premise);
    });

  verifyTeaserSaysSample = () =>
    this.step("verifyTeaserSaysSample", () =>
      expect(this.get(onboardingTeaserTestIds.root).filter({ visible: true }).first()).toContainText("Your sample overview is ready"),
    );

  // A sample is already made, so the overview's progress isn't shown anywhere (155f).
  verifyHasNoOverviewProgress = () =>
    this.step("verifyHasNoOverviewProgress", async () => {
      await expect(this.get(onboardingProgressBarTestIds.root)).toHaveCount(0);
      await expect(this.get(onboardingProgressBarTestIds.seeOverview)).toHaveCount(0);
    });

  verifyPreviewSaysWrittenForAnyone = () =>
    this.step("verifyPreviewSaysWrittenForAnyone", () =>
      expect(this.get(onboardingPreviewTestIds.forAnyone)).toHaveText("Written for anyone. The overviews you make are written for you."),
    );

  verifyPlanCountsRead = (text: string) =>
    this.step(`verifyPlanCountsRead ${text}`, () => expect(this.get(onboardingPlanTestIds.counts)).toHaveText(text));

  verifyTeaserReads = ({ byline, locked }: { byline: string; locked: string }) =>
    this.step(`verifyTeaserReads ${byline}`, async () => {
      await expect(this.get(onboardingTeaserTestIds.byline)).toHaveText(byline);
      await expect(this.get(onboardingTeaserTestIds.locked)).toHaveText(locked);
    });

  verifyPageHasNoText = (text: string) =>
    this.step(`verifyPageHasNoText ${text}`, () => expect(this.get(onboardingPageTestIds.root)).not.toContainText(text));

  tryAgain = () => this.step("tryAgain", () => this.click(onboardingAccountTestIds.tryAgain));

  tryReadingAgain = () => this.step("tryReadingAgain", () => this.click(onboardingReadFailureTestIds.tryAgain));

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
