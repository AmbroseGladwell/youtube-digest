import { expect } from "@playwright/experimental-ct-react";
import { CHROME_EXTENSION_URL } from "../../src/util/chromeExtensionUrl.js";
import type { OnboardingStep } from "@overview/domain";
import { authScreenTestIds } from "../../src/features/auth/components/AuthScreen/AuthScreenTestIds.js";
import { onboardingAboutYouTestIds } from "../../src/features/onboarding/components/OnboardingAboutYou/OnboardingAboutYouTestIds.js";
import { onboardingAccountTestIds } from "../../src/features/onboarding/components/OnboardingAccount/OnboardingAccountTestIds.js";
import { onboardingAnalyticsTestIds } from "../../src/features/onboarding/components/OnboardingAnalytics/OnboardingAnalyticsTestIds.js";
import { onboardingKnowledgeMomentTestIds } from "../../src/features/onboarding/components/OnboardingKnowledgeMoment/OnboardingKnowledgeMomentTestIds.js";
import { onboardingPillsTestIds } from "../../src/features/onboarding/components/OnboardingPills/OnboardingPillsTestIds.js";
import { onboardingProjectsCardTestIds } from "../../src/features/onboarding/components/OnboardingProjectsCard/OnboardingProjectsCardTestIds.js";
import { onboardingReadFailureTestIds } from "../../src/features/onboarding/components/OnboardingReadFailure/OnboardingReadFailureTestIds.js";
import { onboardingSavingMomentTestIds } from "../../src/features/onboarding/components/OnboardingSavingMoment/OnboardingSavingMomentTestIds.js";
import { onboardingSetupsTestIds } from "../../src/features/onboarding/components/OnboardingSetups/OnboardingSetupsTestIds.js";
import { onboardingSourceCardTestIds } from "../../src/features/onboarding/components/OnboardingSourceCard/OnboardingSourceCardTestIds.js";
import { onboardingStepsMomentTestIds } from "../../src/features/onboarding/components/OnboardingStepsMoment/OnboardingStepsMomentTestIds.js";
import { onboardingTopicsTestIds } from "../../src/features/onboarding/components/OnboardingTopics/OnboardingTopicsTestIds.js";
import { onboardingWaitTestIds } from "../../src/features/onboarding/components/OnboardingWait/OnboardingWaitTestIds.js";
import { onboardingYourLinkTestIds } from "../../src/features/onboarding/components/OnboardingYourLink/OnboardingYourLinkTestIds.js";
import { onboardingPageTestIds } from "../../src/features/onboarding/OnboardingPage/OnboardingPageTestIds.js";
import { AboutYouSentencePageObject } from "./AboutYouSentencePageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ReaderPageObject } from "./ReaderPageObject.testHelper.js";
import { SignInPageObject } from "./SignInPageObject.testHelper.js";

const SCREEN_ROOT: Record<OnboardingStep, string> = {
  analytics: onboardingAnalyticsTestIds.root,
  video: onboardingYourLinkTestIds.root,
  saving: onboardingSavingMomentTestIds.root,
  topics: onboardingTopicsTestIds.root,
  knowledgeBase: onboardingKnowledgeMomentTestIds.root,
  stepsForYou: onboardingStepsMomentTestIds.root,
  aboutYou: onboardingAboutYouTestIds.root,
  account: onboardingAccountTestIds.root,
  wait: onboardingWaitTestIds.root,
};

const CREATE_ACCOUNT_TITLE = "Create your free account to get your overview.";

export class OnboardingPageObject extends PageObject {
  verifyIsShown = (): Promise<OnboardingPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(onboardingPageTestIds.root);
      return this;
    });

  verifyOnScreen = (step: OnboardingStep, heading?: string) =>
    this.step(`verifyOnScreen ${step}`, async () => {
      await this.expectToBeVisible(SCREEN_ROOT[step]);
      if (heading === undefined) {
        return;
      }
      // The account step's heading is the sign-in form's own (327l).
      const focused = step === "account" ? this.get(authScreenTestIds.title) : this.page.getByRole("heading", { level: 1 });
      await expect(focused).toHaveText(heading);
      await expect(focused).toBeFocused();
    });

  verifyStepCountReads = (text: string) =>
    this.step(`verifyStepCountReads ${text}`, () => expect(this.get(onboardingPageTestIds.stepCount)).toHaveText(text));

  verifyHasNoStepper = () => this.step("verifyHasNoStepper", () => this.expectToHaveCount(onboardingPageTestIds.stepper, 0));

  verifyOffersSkip = (offered: boolean) =>
    this.step(`verifyOffersSkip ${offered}`, () => this.expectToHaveCount(onboardingPageTestIds.skip, offered ? 1 : 0));

  skip = () => this.step("skip", () => this.click(onboardingPageTestIds.skip));

  back = () => this.step("back", () => this.click(onboardingPageTestIds.back));

  allowAnalytics = () => this.step("allowAnalytics", () => this.click(onboardingAnalyticsTestIds.allow));

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

  // From wherever the questions start (analytics if it's asked, Your link for a link, topics for a
  // shared copy or sample), on through every screen to the account, skipping what can be skipped.
  skipToAccount = () =>
    this.step("skipToAccount", async () => {
      const first = this.get(onboardingAnalyticsTestIds.root)
        .or(this.get(onboardingYourLinkTestIds.root))
        .or(this.get(onboardingSavingMomentTestIds.root))
        .or(this.get(onboardingTopicsTestIds.root));
      await expect(first).toBeVisible();
      if (await this.get(onboardingAnalyticsTestIds.root).isVisible()) {
        await this.declineAnalytics();
      }
      if (await this.get(onboardingYourLinkTestIds.root).isVisible()) {
        await this.confirmVideo();
      }
      await expect(this.get(onboardingSavingMomentTestIds.root).or(this.get(onboardingTopicsTestIds.root))).toBeVisible();
      if (await this.get(onboardingSavingMomentTestIds.root).isVisible()) {
        await this.skip();
      }
      for (const step of ["topics", "knowledgeBase", "stepsForYou"] as const) {
        await this.verifyOnScreen(step);
        await this.skip();
      }
      await this.verifyOnScreen("account", CREATE_ACCOUNT_TITLE);
    });

  // Your link (327c): the reader's own link read back to them before anything is written.
  #yourLink = (testId: string) => this.get(onboardingYourLinkTestIds.root).getByTestId(testId);

  verifyVideoTitle = (title: string) =>
    this.step(`verifyVideoTitle ${title}`, () => expect(this.#yourLink(onboardingSourceCardTestIds.title)).toHaveText(title));

  verifyFound = ({ kicker, facts }: { kicker?: string; facts: string | RegExp }) =>
    this.step(`verifyFound ${facts}`, async () => {
      if (kicker !== undefined) {
        await expect(this.#yourLink(onboardingSourceCardTestIds.kicker)).toHaveText(kicker);
      }
      await expect(this.#yourLink(onboardingSourceCardTestIds.facts)).toHaveText(facts);
    });

  verifyYourLinkLineReads = (line: string | RegExp) =>
    this.step(`verifyYourLinkLineReads ${line}`, () => expect(this.get(onboardingYourLinkTestIds.line)).toHaveText(line));

  verifyPillsRead = (...pills: (string | RegExp)[]) =>
    this.step(`verifyPillsRead ${pills.join(", ")}`, () =>
      expect(this.#yourLink(onboardingPillsTestIds.root).getByRole("listitem")).toHaveText(pills),
    );

  verifyInsideReads = (text: string) =>
    this.step(`verifyInsideReads ${text}`, () => expect(this.get(onboardingYourLinkTestIds.inside)).toHaveText(text));

  verifySaysSavedToLibrary = () =>
    this.step("verifySaysSavedToLibrary", () =>
      expect(this.get(onboardingYourLinkTestIds.root)).toContainText("Saved to your library, ready for you and your AI."),
    );

  verifyNoticeReads = (text: string | null) =>
    this.step(`verifyNoticeReads ${text}`, () =>
      text === null
        ? this.expectToHaveCount(onboardingYourLinkTestIds.notice, 0)
        : expect(this.get(onboardingYourLinkTestIds.notice)).toHaveText(text),
    );

  verifyStopReads = (text: string | RegExp) =>
    this.step(`verifyStopReads ${text}`, async () => {
      await expect(this.get(onboardingYourLinkTestIds.stop)).toHaveText(text);
      await this.expectToHaveCount(onboardingYourLinkTestIds.looksRight, 0);
      await this.expectToHaveCount(onboardingPillsTestIds.root, 0);
    });

  verifyFindingReads = (text: string) =>
    this.step(`verifyFindingReads ${text}`, () => expect(this.get(onboardingYourLinkTestIds.finding)).toHaveText(text));

  verifyPlaylistTitle = (title: string) =>
    this.step(`verifyPlaylistTitle ${title}`, () => expect(this.get(onboardingYourLinkTestIds.playlistTitle)).toHaveText(title));

  confirmVideo = () => this.step("confirmVideo", () => this.click(onboardingYourLinkTestIds.looksRight));

  useDifferentLink = () => this.step("useDifferentLink", () => this.click(onboardingYourLinkTestIds.differentLink));

  chooseDifferentVideo = (videoId: string) =>
    this.step(`chooseDifferentVideo ${videoId}`, async () => {
      await this.click(onboardingYourLinkTestIds.chooseDifferent);
      await this.click(onboardingYourLinkTestIds.entry(videoId));
    });

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
    this.step(`verifyTellsOfExtension ${told}`, () => expect(this.get(onboardingReadFailureTestIds.extension)).toHaveCount(told ? 1 : 0));

  verifyAnotherLinkAsks = (placeholder: string) =>
    this.step(`verifyAnotherLinkAsks ${placeholder}`, () =>
      expect(this.get(onboardingReadFailureTestIds.linkField)).toHaveAttribute("placeholder", placeholder),
    );

  tryAnotherLink = (link: string) =>
    this.step(`tryAnotherLink ${link}`, async () => {
      await this.get(onboardingReadFailureTestIds.linkField).fill(link);
      await this.get(onboardingReadFailureTestIds.linkField).press("Enter");
    });

  tryReadingAgain = () => this.step("tryReadingAgain", () => this.click(onboardingReadFailureTestIds.tryAgain));

  verifyOffersTranscribing = (offered: boolean) =>
    this.step(`verifyOffersTranscribing ${offered}`, () =>
      this.expectToHaveCount(onboardingReadFailureTestIds.transcribe, offered ? 1 : 0),
    );

  transcribe = () => this.step("transcribe", () => this.click(onboardingReadFailureTestIds.transcribe));

  // The moments (327d, 327g, 327h): one screen each, with nothing to answer.
  continueFromSaving = () => this.step("continueFromSaving", () => this.click(onboardingSavingMomentTestIds.next));

  verifyOffersTheExtension = (offered: boolean) =>
    this.step(`verifyOffersTheExtension ${offered}`, async () => {
      if (!offered) {
        return this.expectToHaveCount(onboardingSavingMomentTestIds.addToChrome, 0);
      }
      const link = this.get(onboardingSavingMomentTestIds.addToChrome);
      await expect(link).toHaveAttribute("href", CHROME_EXTENSION_URL);
      await expect(link).toHaveAttribute("target", "_blank");
    });

  continueFromKnowledgeBase = () => this.step("continueFromKnowledgeBase", () => this.click(onboardingKnowledgeMomentTestIds.next));

  verifyStepsMomentLeadReads = (text: string) =>
    this.step(`verifyStepsMomentLeadReads ${text}`, () => expect(this.get(onboardingStepsMomentTestIds.lead)).toHaveText(text));

  addContextAboutYou = () => this.step("addContextAboutYou", () => this.click(onboardingStepsMomentTestIds.addContext));

  // Topics (327e).
  pickTopics = (...names: string[]) =>
    this.step(`pickTopics ${names.join(", ")}`, async () => {
      for (const name of names) {
        await this.click(onboardingTopicsTestIds.chip(name));
      }
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

  verifySuggestionPressed = (name: string, pressed: boolean) =>
    this.step(`verifySuggestionPressed ${name} ${pressed}`, () =>
      expect(this.get(onboardingTopicsTestIds.suggestion(name))).toHaveAttribute("aria-pressed", String(pressed)),
    );

  toggleSuggestion = (name: string) => this.step(`toggleSuggestion ${name}`, () => this.click(onboardingTopicsTestIds.suggestion(name)));

  verifyTopicsOffered = (group: "Popular topics" | "All topics", names: string[]) =>
    this.step(`verifyTopicsOffered ${group}`, () =>
      expect(this.page.getByRole("group", { name: group }).locator(`[data-testid^="onboarding-topics-chip-"]`)).toHaveText(names),
    );

  verifyTopicCountIn = (group: "Popular topics" | "All topics", count: number) =>
    this.step(`verifyTopicCountIn ${group} ${count}`, () =>
      expect(this.page.getByRole("group", { name: group }).locator(`[data-testid^="onboarding-topics-chip-"]`)).toHaveCount(count),
    );

  verifyCanTypeTopic = (can: boolean) =>
    this.step(`verifyCanTypeTopic ${can}`, () => this.expectToHaveCount(onboardingTopicsTestIds.typeField, can ? 1 : 0));

  seeAllTopics = () => this.step("seeAllTopics", () => this.click(onboardingTopicsTestIds.seeAll));

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

  verifyProjectsCardIsShown = () =>
    this.step("verifyProjectsCardIsShown", () =>
      expect(this.get(onboardingProjectsCardTestIds.root).filter({ visible: true })).toBeVisible(),
    );

  continueFromTopics = () => this.step("continueFromTopics", () => this.click(onboardingTopicsTestIds.continue));

  focusTopicField = () => this.step("focusTopicField", () => this.get(onboardingTopicsTestIds.typeField).focus());

  leaveTopicField = () => this.step("leaveTopicField", () => this.get(onboardingTopicsTestIds.typeField).blur());

  verifyTopicFieldHasFocus = () =>
    this.step("verifyTopicFieldHasFocus", () => expect(this.get(onboardingTopicsTestIds.typeField)).toBeFocused());

  // About you (327i).
  get sentence() {
    return new AboutYouSentencePageObject(this.testContext);
  }

  continueFromAboutYou = () => this.step("continueFromAboutYou", () => this.click(onboardingAboutYouTestIds.continue));

  // The account (327l): the form in place, then the code in its place.
  get accountForm(): SignInPageObject {
    return new SignInPageObject(this.testContext);
  }

  verifyAccountCard = ({ title, answers }: { title: string; answers: string[] }) =>
    this.step(`verifyAccountCard ${title}`, async () => {
      const saved = this.get(onboardingPageTestIds.root).getByRole("region", { name: "Saved with your account" });
      await expect(saved.getByTestId(onboardingSourceCardTestIds.title)).toHaveText(title);
      if (answers.length === 0) {
        await expect(saved.getByRole("list", { name: "Your answers" })).toHaveCount(0);
      } else {
        await expect(saved.getByRole("list", { name: "Your answers" }).getByRole("listitem")).toHaveText(answers);
      }
    });

  verifyAccountHasNoCard = () =>
    this.step("verifyAccountHasNoCard", () =>
      expect(this.get(onboardingPageTestIds.root).getByRole("region", { name: "Saved with your account" })).toHaveCount(0),
    );

  createAccount = ({ firstName, email, code }: { firstName: string; email: string; code: string }) =>
    this.step(`createAccount ${email}`, async () => {
      const form = await this.accountForm.verifyAsksForEmail(CREATE_ACCOUNT_TITLE);
      await form.typeFirstName(firstName);
      await form.requestLink(email);
      await form.verifyAsksForCode(email);
      await form.typeCode(code);
    });

  switchToSignIn = (): Promise<SignInPageObject> =>
    this.step("switchToSignIn", async () => {
      await this.accountForm.verifyAsksForEmail(CREATE_ACCOUNT_TITLE);
      return (await this.accountForm.switchToOtherPage()).verifyAsksForEmail("Sign in to get your overview.");
    });

  signIn = ({ email, code }: { email: string; code: string }) =>
    this.step(`signIn ${email}`, async () => {
      const form = await this.switchToSignIn();
      await form.requestLink(email);
      await form.verifyAsksForCode(email);
      await form.typeCode(code);
    });

  // The wait (327m): each stage is a real event of the run, and it ends on Open your overview.
  verifyWaitStage = (index: number, { state, text }: { state: "waiting" | "running" | "done"; text: string | RegExp }) =>
    this.step(`verifyWaitStage ${index} ${state}`, async () => {
      const stage = this.get(onboardingWaitTestIds.stage(index));
      await expect(stage).toHaveAttribute("data-state", state, { timeout: 10_000 });
      await expect(stage).toContainText(text);
    });

  verifyWaitStageCount = (count: number) =>
    this.step(`verifyWaitStageCount ${count}`, () =>
      expect(this.get(onboardingWaitTestIds.root).locator(`[data-testid^="onboarding-wait-stage-"]`)).toHaveCount(count),
    );

  verifyWaitSays = (heading: string) =>
    this.step(`verifyWaitSays ${heading}`, () =>
      expect(this.get(onboardingWaitTestIds.root).getByRole("heading", { level: 1 })).toHaveText(heading, { timeout: 10_000 }),
    );

  verifyAsksToKeepTheTab = (asked: boolean) =>
    this.step(`verifyAsksToKeepTheTab ${asked}`, () => this.expectToHaveCount(onboardingWaitTestIds.keepTab, asked ? 1 : 0));

  // Three where the extension can be added (appearance, the extension, your AI), two elsewhere.
  verifyWaitOffersSetups = (count: number) =>
    this.step(`verifyWaitOffersSetups ${count}`, async () => {
      await this.expectToBeVisible(onboardingSetupsTestIds.root);
      await expect(this.get(onboardingSetupsTestIds.count)).toHaveText(`1 of ${count}`);
    });

  verifyWaitFailed = () =>
    this.step("verifyWaitFailed", () => expect(this.get(onboardingWaitTestIds.failure)).toBeVisible({ timeout: 10_000 }));

  tryAgainFromWait = () => this.step("tryAgainFromWait", () => this.click(onboardingWaitTestIds.tryAgain));

  verifyCanOpenOverview = (can: boolean) =>
    this.step(`verifyCanOpenOverview ${can}`, () =>
      can
        ? expect(this.get(onboardingWaitTestIds.open)).toBeVisible({ timeout: 10_000 })
        : this.expectToHaveCount(onboardingWaitTestIds.open, 0),
    );

  openOverview = (): Promise<ReaderPageObject> =>
    this.step("openOverview", async () => {
      await expect(this.get(onboardingWaitTestIds.open)).toBeVisible({ timeout: 10_000 });
      await this.click(onboardingWaitTestIds.open);
      return new ReaderPageObject(this.testContext).verifyIsShown();
    });

  verifyPageHasNoText = (text: string) =>
    this.step(`verifyPageHasNoText ${text}`, () => expect(this.get(onboardingPageTestIds.root)).not.toContainText(text));

  // OV-210 (210a–210k): below the brand row one area scrolls, and each step's foot is pinned to
  // its bottom. The foot is the sticky element nearest the step's Continue.
  #scroller = () => this.get(onboardingPageTestIds.scroller);
  #foot = (continueTestId: string) =>
    this.get(continueTestId).evaluate((button) => {
      let foot: Element | null = button;
      while (foot !== null && getComputedStyle(foot).position !== "sticky") {
        foot = foot.parentElement;
      }
      const box = foot!.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, fade: Number(getComputedStyle(foot!, "::before").opacity) };
    });

  verifyContinueInReachWithoutScrolling = (continueTestId: string) =>
    this.step(`verifyContinueInReachWithoutScrolling ${continueTestId}`, async () => {
      expect(await this.#scroller().evaluate((scroller) => scroller.scrollTop)).toBe(0);
      expect(await this.page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      await this.verifyContinueIsInView(continueTestId);
    });

  verifyContinueIsInView = (continueTestId: string) =>
    this.step(`verifyContinueIsInView ${continueTestId}`, () => expect(this.get(continueTestId)).toBeInViewport({ ratio: 1 }));

  // Nothing of the step may show beneath the foot while it is pinned.
  verifyFootSitsOnTheWindowsEdge = (continueTestId: string) =>
    this.step("verifyFootSitsOnTheWindowsEdge", async () => {
      const { bottom } = await this.#foot(continueTestId);
      expect(Math.abs(bottom - (await this.page.evaluate(() => window.innerHeight)))).toBeLessThan(1);
    });

  verifyStepOverflows = (overflows: boolean) =>
    this.step(`verifyStepOverflows ${overflows}`, async () => {
      const room = await this.#scroller().evaluate((scroller) => scroller.scrollHeight - scroller.clientHeight);
      if (overflows) {
        expect(room).toBeGreaterThan(0);
      } else {
        expect(room).toBeLessThanOrEqual(0);
      }
    });

  verifyFootFadeIsShown = (continueTestId: string, shown: boolean) =>
    this.step(`verifyFootFadeIsShown ${shown}`, () =>
      expect.poll(async () => (await this.#foot(continueTestId)).fade, { timeout: 2_000 }).toBe(shown ? 1 : 0),
    );

  scrollStepToTheEnd = () =>
    this.step("scrollStepToTheEnd", () =>
      expect(async () => {
        const atTheEnd = await this.#scroller().evaluate((scroller) => {
          scroller.scrollTop = scroller.scrollHeight;
          return scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        });
        expect(atTheEnd).toBe(true);
      }).toPass({ timeout: 2_000 }),
    );

  verifyClearOfTheFoot = (testId: string, continueTestId: string) =>
    this.step(`verifyClearOfTheFoot ${testId}`, async () => {
      const bottom = await this.get(testId).evaluate((element) => element.getBoundingClientRect().bottom);
      const footTop = (await this.#foot(continueTestId)).top;
      expect(bottom).toBeLessThanOrEqual(footTop);
    });

  verifyContinueIsShown = (continueTestId: string, shown: boolean) =>
    this.step(`verifyContinueIsShown ${shown}`, () =>
      shown ? this.expectToBeVisible(continueTestId) : this.expectNotToBeVisible(continueTestId),
    );

  verifyAsideStaysPut = async (aside: string, move: () => Promise<unknown>) =>
    this.step("verifyAsideStaysPut", async () => {
      const pane = this.get(aside).filter({ visible: true });
      const before = (await pane.boundingBox())!.y;
      await move();
      expect((await pane.boundingBox())!.y).toBeCloseTo(before, 0);
    });
}
