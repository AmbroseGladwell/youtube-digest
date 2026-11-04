import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE, SIMULATED_SAMPLE_TITLE } from "../../network/BackendSimulator.testHelper.js";
import {
  makeArticleOverview,
  makeOverview,
  makeRecipeOverview,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeAnalyticsConsent } from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

// Start offers samples, so a new reader can begin onboarding without leaving to find a link,
// and every Create account goes through onboarding (docs/features/onboarding.md, "Try a sample").
const VIDEO = makeOverview({
  source: { ...makeOverview().source, title: "Why Sleep Debt Is Real", channel: "Sleep Lab", durationMs: 754_000 },
  inOneLine: "A sleep researcher on what a week of short nights does.",
});
const ARTICLE = makeArticleOverview();
const RECIPE = makeRecipeOverview();

const signedOut = { sync: true, analyticsConsent: makeAnalyticsConsent({ answer: "share" }) };

test("Start offers each sample by its title, kind and length, beside the link field", async ({ launcher, backendSimulator }) => {
  backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
  const home = await launcher.launch(signedOut);

  await home.verifyShowsStart();
  await launcher.onboardingSamples.verifyOffers(
    "Why Sleep Debt Is Real Sleep Lab · 12:34",
    "The town that pays its bridge bill twice The Harbour Post · Article · 14 min read",
    "Charred leek and white bean stew Example Kitchen · Recipe · 1 hr 5 min",
  );
});

for (const sample of [VIDEO, ARTICLE, RECIPE]) {
  test(`a sample (${sample.source.title}) goes through the questions, the account and the plan to its reveal, made by nobody`, async ({
    launcher,
    backendSimulator,
  }) => {
    const [, , token] = backendSimulator.startSamples.offer(...[VIDEO, ARTICLE, RECIPE].filter((other) => other !== sample), sample);
    await launcher.launch(signedOut);

    await launcher.onboardingSamples.choose(sample.source.title);

    const onboarding = await launcher.onboardingPage.verifyIsShown();
    await onboarding.verifyOnScreen("topics", "What are you curious about?");
    await onboarding.verifyCanSeeOverview();
    await onboarding.seeOverview();
    await onboarding.verifyOnScreen("account", "Create your free account");
    await onboarding.verifyTeaser({ title: sample.source.title, premise: sample.recipe?.summary ?? sample.inOneLine });
    const createAccount = await onboarding.continueWithEmail();
    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);
    await createAccount.chooseCodeFromEmail();
    await createAccount.enterCode("ABCD-EFGH");
    await onboarding.verifyOnScreen("plan", "Choose your plan");
    await onboarding.continueWithFree();

    const reader = await launcher.readerPage.verifyIsShown();
    await reader.verifyTitle(sample.source.title);
    expect(backendSimulator.ourKey.generations()).toEqual([]);
    expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: sample.id, shareToken: token }]);
  });
}

test("choosing a sample and finishing on it is counted by where it sat and its kind, never its title", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.startSamples.offer(VIDEO, RECIPE);
  await launcher.launch(signedOut);

  await launcher.onboardingSamples.choose(RECIPE.source.title);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.seeOverview();
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.continueWithFree();
  await launcher.readerPage.verifyIsShown();

  const props = (name: string) => backendSimulator.analytics.events().find((event) => event.name === name)?.props;
  await expect.poll(() => props("onboarding.finished.revealed")).toEqual({ way: "createAccount", from: "sample" });
  expect(props("onboarding.start.sampleChosen")).toEqual({ sample: 1, kind: "recipe" });
});

test("back from a sample's first screen returns to Start, not to a shared page", async ({ launcher }) => {
  const home = await launcher.launch(signedOut);
  await launcher.onboardingSamples.choose(SIMULATED_SAMPLE_TITLE);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("topics");

  await onboarding.back();

  await home.verifyShowsStart();
});

test("with no samples to offer, Start keeps its field alone", async ({ launcher, backendSimulator }) => {
  backendSimulator.startSamples.offer();
  const home = await launcher.launch(signedOut);

  await home.verifyShowsStart();
  await launcher.onboardingSamples.verifyOffersNone();
});

test("a sample that can't be opened says so, and Start stays where it was", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.SAMPLE);
  const home = await launcher.launch(signedOut);

  await launcher.onboardingSamples.choose(SIMULATED_SAMPLE_TITLE);

  await launcher.onboardingSamples.verifySaysItCouldntOpen();
  await home.verifyShowsStart();
});

test("Create account with onboarding under way carries on at the same screen", async ({ launcher }) => {
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video");

  await launcher.openPage(Routes.createAccount());

  await onboarding.verifyOnScreen("video");
});

test.describe("in the panel", () => {
  const signedOutPanel = { ...signedOut, defaultApiUrl: "https://sync.test", youTubeFetch: true };

  test("Start offers the samples beneath the way to make one of the tab", async ({ launcher, backendSimulator }) => {
    backendSimulator.startSamples.offer(VIDEO, ARTICLE, RECIPE);
    await launcher.launchPanel({ ...signedOutPanel, activeVideoUrl: `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}` });

    await launcher.panelStart.verifyIsShown();
    await launcher.onboardingSamples.verifyOffers(/^Why Sleep Debt Is Real/, /^The town that pays/, /^Charred leek/);
  });

  test("once the device has had an account, Create account shows the panel's Start, and a sample takes it to an account", async ({
    launcher,
  }) => {
    await launcher.launchPanel({ ...signedOutPanel, accountSeen: true });
    await launcher.signedOutGate.verifyIsShown();

    await launcher.signedOutGate.chooseCreateAccount();

    await launcher.panelStart.verifyIsShown();
    const createAccount = await launcher.onboardingSamples.createAccountThroughFirst();
    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);
    await createAccount.enterCode(SIMULATED_LINK_CODE);
    await launcher.onboardingPage.verifyOnScreen("plan");
  });
});
