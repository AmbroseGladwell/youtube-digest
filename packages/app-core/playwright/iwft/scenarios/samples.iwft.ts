import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE } from "../../network/BackendSimulator.testHelper.js";
import {
  makeArticleOverview,
  makeOverview,
  makeRecipeOverview,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeAnalyticsConsent } from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { homePageTestIds } from "../../../src/features/home/HomePage/HomePageTestIds.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";

// Start offers samples, so a new reader can begin onboarding without leaving to find a link,
// and every Create account goes through onboarding (docs/features/onboarding.md, "Try a sample";
// designs 155a–155l).
const VIDEO = makeOverview({
  source: { ...makeOverview().source, title: "Why Sleep Debt Is Real", channel: "Sleep Lab", durationMs: 754_000 },
  inOneLine: "A sleep researcher on what a week of short nights does.",
  howToApply: { items: ["Keep a steady wake time.", "Treat a short night as a cost."] },
});
const ARTICLE = makeArticleOverview();
const RECIPE = makeRecipeOverview();
const VIDEO_NAME = "Why Sleep Debt Is Real, Video, 12:34";
const ARTICLE_NAME = "The town that pays its bridge bill twice, Article, 14 min read";
const RECIPE_NAME = "Charred leek and white bean stew, Recipe, 1 hr 5 min";
const titled = (title: string) => makeOverview({ source: { ...makeOverview().source, title } });
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

const signedOut = { sync: true, analyticsConsent: makeAnalyticsConsent({ answer: "share" }) };

const throughToPlan = async (launcher: Launcher) => {
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.skipToAccount();
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.verifyOnScreen("plan", "Choose your plan");
  return onboarding;
};

test.describe("the deck on web Start", () => {
  test.beforeEach(({ backendSimulator }) => {
    backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
  });

  test("takes the Example overview card's place, one card in front, and the headline's verb follows it", async ({ launcher }) => {
    const home = await launcher.launch(signedOut);

    await home.verifyShowsStart();
    await launcher.sampleDeck.verifyIsShown();
    await launcher.sampleDeck.verifyFront(VIDEO_NAME, "Sample 1 of 3");
    await launcher.homePage.verifyHeadlineReads("Watch Less,");
    await launcher.sampleDeck.verifyOnlyFrontIsFocusable(3);
    await launcher.homePage.verifyShowsExampleOverview(false);
  });

  test("the arrows step through it, and the verb follows the kind in front", async ({ launcher }) => {
    await launcher.launch(signedOut);

    await launcher.sampleDeck.next();
    await launcher.sampleDeck.verifyFront(ARTICLE_NAME, "Sample 2 of 3");
    await launcher.homePage.verifyHeadlineReads("Learn More,");
    await launcher.sampleDeck.next();
    await launcher.sampleDeck.verifyFront(RECIPE_NAME, "Sample 3 of 3");
    await launcher.homePage.verifyHeadlineReads("Cook More,");
    await launcher.sampleDeck.next();
    await launcher.sampleDeck.verifyFront(VIDEO_NAME, "Sample 1 of 3");
    await launcher.sampleDeck.previous();
    await launcher.sampleDeck.verifyFront(RECIPE_NAME, "Sample 3 of 3");
  });

  test("cycles on its own every six seconds, and Pause stops it", async ({ launcher, page }) => {
    await page.clock.install();
    await launcher.launch(signedOut);
    await launcher.sampleDeck.verifyFront(VIDEO_NAME, "Sample 1 of 3");

    await page.clock.runFor(6_100);
    await launcher.sampleDeck.verifyFront(ARTICLE_NAME, "Sample 2 of 3");

    await launcher.sampleDeck.playOrPause();
    await launcher.sampleDeck.verifyPlaying(false);
    await page.mouse.move(0, 0);
    await page.getByTestId(homePageTestIds.urlInput).focus();
    await page.clock.runFor(13_000);
    await launcher.sampleDeck.verifyFront(ARTICLE_NAME, "Sample 2 of 3");
  });

  test("See all lays it out in deck order, front card first, and Show one at a time folds it back", async ({ launcher }) => {
    await launcher.launch(signedOut);
    await launcher.sampleDeck.next();

    await launcher.sampleDeck.seeAll();
    await launcher.sampleDeck.verifyLaidOut([ARTICLE_NAME, RECIPE_NAME, VIDEO_NAME]);

    await launcher.sampleDeck.seeAll();
    await launcher.sampleDeck.verifyFront(ARTICLE_NAME, "Sample 2 of 3");
  });

  test("opening a card says so after a moment, then goes on to onboarding", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointStalled(EndpointKey.SAMPLE);
    await launcher.launch(signedOut);

    await launcher.sampleDeck.openFront();
    await launcher.sampleDeck.verifyOpening();

    await backendSimulator.releaseEndpoint(EndpointKey.SAMPLE);
    await launcher.onboardingPage.verifyIsShown();
  });

  test("a card that can't be opened says so, stays in front with focus, and the deck stops cycling", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.simulateEndpointError(EndpointKey.SAMPLE);
    await launcher.launch(signedOut);

    await launcher.sampleDeck.openFront();

    await launcher.sampleDeck.verifySaysItCouldntOpen();
    await launcher.sampleDeck.verifyFront(VIDEO_NAME, "Sample 1 of 3");
    await launcher.sampleDeck.verifyPlaying(false);
  });
});

test("with fewer than three samples, Start offers them as rows", async ({ launcher, backendSimulator }) => {
  backendSimulator.startSamples.offer(VIDEO, ARTICLE);
  await launcher.launch(signedOut);

  await launcher.onboardingSamples.verifyOffers(VIDEO_NAME, ARTICLE_NAME);
  await launcher.sampleDeck.verifyIsAbsent();
});

test("with no samples, Start keeps its field and the Example overview card", async ({ launcher, backendSimulator }) => {
  backendSimulator.startSamples.offer();
  const home = await launcher.launch(signedOut);

  await home.verifyShowsStart();
  await launcher.onboardingSamples.verifyOffersNone();
  await launcher.sampleDeck.verifyIsAbsent();
  await launcher.homePage.verifyShowsExampleOverview(true);
});

for (const sample of [VIDEO, ARTICLE, RECIPE]) {
  test(`a sample (${sample.source.title}) goes through the questions, the account and the plan to its reveal, made by nobody`, async ({
    launcher,
    backendSimulator,
  }) => {
    const [token] = backendSimulator.startSamples.offer(sample, ...[VIDEO, ARTICLE, RECIPE].filter((other) => other !== sample));
    await launcher.launch(signedOut);

    await launcher.sampleDeck.openFront();
    const onboarding = await launcher.onboardingPage.verifyIsShown();
    await onboarding.verifyOnScreen("topics", "What are you curious about?");
    await onboarding.verifyHasNoOverviewProgress();
    await onboarding.skipToAccount();
    await onboarding.verifyTeaser({ title: sample.source.title, premise: sample.recipe?.summary ?? sample.inOneLine });
    await onboarding.verifyTeaserSaysSample();
    const createAccount = await onboarding.continueWithEmail();
    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);
    await createAccount.chooseCodeFromEmail();
    await createAccount.enterCode("ABCD-EFGH");
    await onboarding.verifyOnScreen("plan", "Choose your plan");
    await onboarding.verifyPlanCountsRead("This sample doesn't count towards your month. The first overview you make will.");
    await onboarding.continueWithFree();

    const reader = await launcher.readerPage.verifyIsShown();
    await reader.verifyTitle(sample.source.title);
    expect(backendSimulator.ourKey.generations()).toEqual([]);
    expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: sample.id, shareToken: token }]);
  });
}

test("on a wide screen the preview says a sample is written for anyone, with no progress of its own", async ({ launcher, page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await launcher.launch(signedOut);

  await launcher.sampleDeck.openFront();
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyPreviewSaysWrittenForAnyone();
  await onboarding.verifyHasNoOverviewProgress();
});

test("the reveal of a sample says How to apply is for anyone, offers no flip, and leads with Now try your own", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await throughToPlan(launcher);
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO.source.title);
  await launcher.howToApplyFlip.verifySampleLine();
  await launcher.howToApplyFlip.verifyIsAbsent();
  await launcher.onboardingNextSteps.verifyOffers(["own", "extension", "ai"]);
  await launcher.onboardingNextSteps.dismiss("own");
  await launcher.onboardingNextSteps.verifyOffers(["extension", "ai"]);
});

test("Now try your own starts the reader's next overview from the reveal, written for them", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await throughToPlan(launcher);
  await onboarding.continueWithFree();
  await launcher.readerPage.verifyIsShown();

  await launcher.onboardingNextSteps.tryYourOwn(VIDEO_URL);

  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  const props = (name: string) => backendSimulator.analytics.events().find((event) => event.name === name)?.props;
  await expect.poll(() => props("onboarding.nextSteps.chosen")).toEqual({ step: "own" });
});

test("a sample is sorted into the topics the reader picked, where it fits, and isn't their first overview", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
  backendSimulator.ourKey.sortsSampleInto(["Health"]);
  await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("topics");
  await onboarding.pickTopics("Health", "Food");
  await onboarding.continueFromTopics();
  for (const step of ["library", "aboutYou", "stepsForYou", "voice", "askYourAi", "moreSources"] as const) {
    await onboarding.verifyOnScreen(step);
    await onboarding.skip();
  }
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyFiledUnder(["Health"]);
  expect(backendSimulator.ourKey.topicPasses().map(({ title, topics }) => [title, topics.map(({ name }) => name).sort()])).toEqual([
    [VIDEO.source.title, ["Food", "Health"]],
  ]);
  expect(backendSimulator.ourKey.generations()).toEqual([]);

  await launcher.openPage(Routes.home());
  await launcher.homePage.verifyShowsLibrary();
  await launcher.firstOverviewMilestone.verifyIsAbsent();
});

test("with no topics picked a sample is saved unsorted, with nothing asked", async ({ launcher, backendSimulator }) => {
  await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await throughToPlan(launcher);
  await onboarding.continueWithFree();

  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.topicPasses()).toEqual([]);
});

test("choosing a sample is counted on the press, by its place and kind, even when it can't be opened", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SAMPLE);
  await launcher.launch(signedOut);
  await launcher.sampleDeck.next();

  await launcher.sampleDeck.openFront();
  await launcher.sampleDeck.verifySaysItCouldntOpen();

  const props = (name: string) => backendSimulator.analytics.events().find((event) => event.name === name)?.props;
  await expect.poll(() => props("onboarding.start.sampleChosen")).toEqual({ sample: 1, kind: "article" });
});

test("finishing on a sample is counted as from a sample", async ({ launcher, backendSimulator }) => {
  await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await throughToPlan(launcher);
  await onboarding.continueWithFree();
  await launcher.readerPage.verifyIsShown();

  const props = (name: string) => backendSimulator.analytics.events().find((event) => event.name === name)?.props;
  await expect.poll(() => props("onboarding.finished.revealed")).toEqual({ way: "createAccount", from: "sample" });
});

test("back from a sample's first screen returns to Start", async ({ launcher }) => {
  const home = await launcher.launch(signedOut);
  await launcher.sampleDeck.openFront();
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("topics");

  await onboarding.back();

  await home.verifyShowsStart();
});

test("Create account lands on Start, saying new accounts start with a first overview", async ({ launcher }) => {
  await launcher.launch(signedOut);

  await launcher.openPage(Routes.createAccount());

  await launcher.homePage.verifyShowsStart();
  await launcher.homePage.verifySaysNewAccountsStartWithAnOverview();
});

test("Create account with onboarding under way carries on at the same screen", async ({ launcher }) => {
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video");

  await launcher.openPage(Routes.createAccount());

  await onboarding.verifyOnScreen("video");
});

test.describe("in the panel", () => {
  const signedOutPanel = { ...signedOut, defaultApiUrl: "https://sync.test", youTubeFetch: true, activeVideoUrl: VIDEO_URL };

  // 205g: the panel's samples are the phone's deck, under Make my overview and Sign in,
  // rather than the rows the panel used to draw.
  test("Start offers the samples as the deck, and See all lays them out", async ({ launcher, backendSimulator }) => {
    backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
    await launcher.launchPanel(signedOutPanel);
    await launcher.homePage.verifyShowsStart();

    await launcher.sampleDeck.verifyIsShown();
    await launcher.sampleDeck.verifyFront(VIDEO_NAME, "Sample 1 of 3");
    await launcher.onboardingSamples.verifyOffersNone();

    await launcher.sampleDeck.seeAll();

    await launcher.sampleDeck.verifyLaidOut([VIDEO_NAME, ARTICLE_NAME, RECIPE_NAME]);
  });

  // Beside a video the headline follows the tab and holds, so only the deck cycles (205g-2).
  test("beside a video the headline follows the tab rather than the deck", async ({ launcher, backendSimulator }) => {
    backendSimulator.startSamples.offer(ARTICLE, RECIPE, VIDEO);
    await launcher.launchPanel(signedOutPanel);
    const start = await launcher.homePage.verifyShowsStart();

    await start.verifyHeadlineReads("Watch Less,");
    await launcher.sampleDeck.verifyFront(ARTICLE_NAME, "Sample 1 of 3");

    await launcher.sampleDeck.next();

    await launcher.sampleDeck.verifyFront(RECIPE_NAME, "Sample 2 of 3");
    await start.verifyHeadlineReads("Watch Less,");
  });

  // With nothing on the tab there is no subject, so the headline goes back to following the
  // deck, exactly as on the web (155l).
  test("with nothing on the tab the headline follows the deck's front card", async ({ launcher, backendSimulator }) => {
    backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
    await launcher.launchPanel({ ...signedOutPanel, activeVideoUrl: null });
    const start = await launcher.homePage.verifyShowsStart();

    await start.verifyHeadlineReads("Watch Less,");

    await launcher.sampleDeck.next();
    await start.verifyHeadlineReads("Learn More,");

    await launcher.sampleDeck.next();
    await start.verifyHeadlineReads("Cook More,");
  });

  test("a card that can't be opened says so, and keeps focus", async ({ launcher, backendSimulator }) => {
    backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
    backendSimulator.simulateEndpointError(EndpointKey.SAMPLE);
    await launcher.launchPanel(signedOutPanel);

    await launcher.sampleDeck.openFront();

    await launcher.sampleDeck.verifySaysItCouldntOpen();
  });

  // 205g-4: the gate's Create an account opens home, which is Start, with no way back to
  // itself. The lone back chevron 205d-5 drew is retired with it.
  test("once the device has had an account, Create account opens Start, and a sample leads to an account", async ({
    launcher,
  }) => {
    await launcher.launchPanel({ ...signedOutPanel, accountSeen: true });
    await launcher.signedOutGate.verifyIsShown();

    await launcher.signedOutGate.chooseCreateAccount();

    const start = await launcher.homePage.verifyShowsStart();
    await start.verifyStandfirstReads("Make this video your first overview. We'll set up your account as we go.");
    const createAccount = await launcher.createAccountThroughSample();
    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);
    await createAccount.enterCode(SIMULATED_LINK_CODE);
    await launcher.onboardingPage.verifyOnScreen("plan");
  });
});
