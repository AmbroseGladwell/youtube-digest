import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_URL, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { Routes } from "../../../src/app/Routes.js";

// Onboarding inside the first overview (docs/features/onboarding.md, designs 46a–46k).
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const VIDEO_TITLE = "The Simulated Video";

// Asked nothing yet about analytics, so the screen is shown; answered, it is passed by.
const signedOut = { sync: true, analyticsConsent: null };
const signedOutAnswered = { sync: true };

test("a new reader answers the questions while the overview is made, creates an account and lands on it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics", "Help us improve The Overview?");
  await onboarding.verifyAnalyticsDisclosure();
  await onboarding.allowAnalytics();

  await onboarding.verifyOnScreen("video", "Is this the right video?");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  await onboarding.confirmVideo();

  await onboarding.verifyOnScreen("topics", "What are you curious about?");
  await onboarding.typeTopic("chess");
  await onboarding.pickTopics("Food", "Health");
  await onboarding.verifyTopicCountReads("3 picked");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("library", "A library that sorts itself");
  await onboarding.next();

  await onboarding.verifyOnScreen("aboutYou", "How should we write your overviews?");
  await onboarding.verifyProgressReads("Writing starts once you've told us about you");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.pickRole("Healthcare");
  await onboarding.pickGoal("Cooking");
  await onboarding.verifyAboutYouLineReads("Works in healthcare, learning about cooking.");
  await onboarding.continueFromAboutYou();

  await onboarding.verifyOnScreen("voice", "Who should read your overviews?");
  await onboarding.continueFromVoice();
  await onboarding.verifyOnScreen("askYourAi");
  await onboarding.next();
  await onboarding.verifyOnScreen("moreSources");
  await onboarding.next();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaser({ title: VIDEO_TITLE, premise: "Made on our key." });
  await onboarding.verifyPageHasNoText("Key points:");
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.verifyPlusIsComingSoon();
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  await launcher.onboardingNextSteps.verifyOffers(["extension", "ai"]);
  await launcher.onboardingNextSteps.verifyExtensionCantBeAddedYet();
  await launcher.onboardingNextSteps.dismiss("extension");
  await launcher.onboardingNextSteps.verifyOffers(["ai"]);

  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input.readerContext).toBe("Works in healthcare, learning about cooking.");
  expect(made?.input.existingTopics.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "chess", description: null },
    { name: "Food", description: "Cooking, recipes and eating well." },
    { name: "Health", description: "Your body's wellbeing, including nutrition, sleep and medicine." },
  ]);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("every question can be skipped, and writing starts once About you is skipped, with nothing about the reader", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video");
  await onboarding.confirmVideo();
  await onboarding.verifyTopicCountReads("No topics yet? That's fine. New overviews will wait in Unsorted until you sort them.");
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.skip();

  await onboarding.verifyOnScreen("voice");
  await onboarding.verifyCanSeeOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input.readerContext).toBeNull();
  expect(made?.input.existingTopics).toEqual([]);
});

test("See your overview leaves the questions for the account as soon as the overview is ready", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.seeOverview();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaser({ title: VIDEO_TITLE, premise: "Made on our key." });
});

test("what happens before the analytics answer is sent once the reader allows it", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics");

  await onboarding.allowAnalytics();
  await onboarding.verifyOnScreen("video");

  await expect
    .poll(() => backendSimulator.analytics.eventNames())
    .toEqual(
      expect.arrayContaining([
        "onboarding.start.linkSubmitted",
        "onboarding.step.shown",
        "analyticsConsent.prompt.accepted",
      ]),
    );
  expect(backendSimulator.analytics.events().find(({ name }) => name === "analyticsConsent.prompt.accepted")?.props).toEqual({
    asked: "onboarding",
  });
});

test("No thanks sends nothing of what happened before it", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.declineAnalytics();
  await onboarding.verifyOnScreen("video");
  await onboarding.confirmVideo();
  await onboarding.verifyOnScreen("topics");

  expect(backendSimulator.analytics.eventNames()).toEqual([]);
});

test("an overview that can't be made says so on the screen the reader is on, and can be tried again", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointError(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.verifyOnScreen("voice");
  await onboarding.verifySaysItFailed();
  await onboarding.continueFromVoice();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account");

  backendSimulator.simulateEndpointDefault(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.tryAgain();

  await onboarding.verifyTeaser({ title: VIDEO_TITLE, premise: "Made on our key." });
});

test("a reader with an account signs in from the account screen and lands on the overview, with no plan to pick", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.seeOverview();

  const signIn = await onboarding.signIn();
  await signIn.requestLink(SIMULATED_EMAIL);
  await signIn.chooseCodeFromEmail();
  await signIn.enterCode("ABCD-EFGH");

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
});

test("Use a different link goes back to Start", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyVideoTitle(VIDEO_TITLE);

  await onboarding.useDifferentLink();

  await home.verifyShowsStart();
});

test("Start refuses a link it can't make an overview from, and starts nothing", async ({ launcher, backendSimulator }) => {
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl("https://example.com/recipes/onion");

  await home.verifyHeroValidationError("We can't make an overview from that link yet. Try a YouTube video or playlist link.");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("a playlist link starts with its first video", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.playlists.seed(psychologyPlaylist());
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(PSYCHOLOGY_URL);

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right playlist?");
  await onboarding.verifyPlaylistTitle("Psychology");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
});

test("going home in the middle carries on at the same screen", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.verifyOnScreen("topics");

  await launcher.openPage(Routes.home());

  await onboarding.verifyOnScreen("topics");
});

test("the library marks the first overview with a milestone, which × hides", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  await launcher.launchExpectingLibrary({
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  });

  await launcher.firstOverviewMilestone.verifyIsShown();
  await launcher.firstOverviewMilestone.dismiss();

  await launcher.firstOverviewMilestone.verifyIsAbsent();
  await expect
    .poll(() => backendSimulator.analytics.eventNames())
    .toEqual(expect.arrayContaining(["timeSaved.firstOverview.dismissed"]));
});

test("the next steps show only under the overview onboarding ended on", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed(overview);
  await launcher.launchExpectingLibrary({
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
  });

  await launcher.openPage(Routes.overview(overview.id));

  await launcher.readerPage.verifyIsShown();
  await launcher.onboardingNextSteps.verifyIsAbsent();
});
