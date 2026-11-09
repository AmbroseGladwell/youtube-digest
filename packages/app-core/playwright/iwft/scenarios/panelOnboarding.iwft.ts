import type { ExtractedArticle } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

// Onboarding in the extension's side panel (docs/features/onboarding.md, designs 46n–46q and
// 205g–205g-4, where Start became the web's own).
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const VIDEO_TITLE = "The Simulated Video";
const signedOutPanel = {
  sync: true,
  defaultApiUrl: "https://sync.test",
  activeVideoUrl: VIDEO_URL,
  youTubeFetch: true,
  analyticsConsent: null,
};
const { analyticsConsent: _neverAsked, ...signedOutPanelAnswered } = signedOutPanel;
const PAGE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const PAGE_TITLE = "The town that pays its bridge bill twice";
const PAGE_ARTICLE: ExtractedArticle = {
  url: PAGE_URL,
  title: PAGE_TITLE,
  siteName: "The Harbour Post",
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011." }],
  wordCount: 3220,
  recipe: null,
};

test("a new reader makes their first overview of the video the panel is beside, lands on it signed in, and is offered their AI", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.ourKey.isAvailable();
  await page.setViewportSize({ width: 400, height: 600 });
  await launcher.launchPanel(signedOutPanel);

  const start = await launcher.homePage.verifyShowsStart();
  await start.makeOverview();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics", "Help shape what we build next?");
  await onboarding.verifyAnalyticsDisclosure();
  await onboarding.allowAnalytics();
  await onboarding.verifyOnScreen("video");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  await onboarding.verifyReadyLineReads("Transcript ready · Writing starts in a few taps");
  await onboarding.confirmVideo();
  await onboarding.pickTopics("Food");
  await onboarding.continueFromTopics();
  await onboarding.next();
  await onboarding.verifyReadyLineReads("Transcript ready · Writing starts when you continue");
  await onboarding.verifyHasNoProgressBar();
  await onboarding.sentence.openSection("time");
  await onboarding.sentence.pick("healthcare");
  await onboarding.sentence.backToSentence();
  await onboarding.sentence.verifySectionHasFocus("time");
  await onboarding.verifyWhatThisChangesShowsExample(false);
  await onboarding.continueFromAboutYou();
  await onboarding.verifyOnScreen("stepsForYou");
  await onboarding.seeOverview();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaser({ title: VIDEO_TITLE, premise: "Made on our key." });
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.enterCode(SIMULATED_LINK_CODE);

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  await launcher.onboardingNextSteps.verifyOffers(["ai"]);
  await launcher.onboardingNextSteps.connectYourAi();
  await launcher.settingsPage.verifySectionIsShown("connections");
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I spend my time on healthcare.");
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("the sheet takes the panel over, and every suggestion is offered", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel(signedOutPanelAnswered);
  await (await launcher.homePage.verifyShowsStart()).makeOverview();
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.verifyOnScreen("aboutYou");
  await onboarding.sentence.openSection("who");
  await onboarding.sentence.verifySheetHasFocus("Who you are");
  await onboarding.sentence.verifyOffered("retired");
  await onboarding.sentence.pick("retired");
  await onboarding.sentence.backToSentence();

  await onboarding.sentence.verifySectionName("who", "Who you are: retired. Edit.");
});

test("with no video beside it, Start takes a pasted link instead, and refuses one it can't use", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...signedOutPanel, activeVideoUrl: null });
  const start = await launcher.homePage.verifyShowsStart();
  await start.verifyOffersNothingFromTheTab();

  await start.submitHeroUrl("https://www.youtube.com/playlist?list=WL");
  await start.verifyHeroValidationError("That doesn't look like a link we can read. Try the address of a video or a web page.");
  await start.submitHeroUrl(VIDEO_URL);

  await launcher.onboardingPage.verifyOnScreen("analytics");
});

test("signed out on a device that has had an account, the panel offers signing back in, and no overviews", async ({ launcher }) => {
  await launcher.launchPanel({ ...signedOutPanel, accountSeen: true });

  await launcher.signedOutGate.verifyIsShown();
  await launcher.signedOutGate.verifyTitle("Sign in to see your overviews");
  await launcher.homePage.verifyStartIsAbsent();
});

// Designs 205g and 205g-4: signed out, the panel is the web's Start, Sign in stands under
// Make my overview as a peer, and nothing anywhere offers to create an account instead.
test("beside a video, Start offers it with the tab's own verb, and Sign in as a peer", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel(signedOutPanelAnswered);

  const start = await launcher.homePage.verifyShowsStart();

  await start.verifyHeadlineReads("Watch Less,");
  await start.verifyStandfirstReads("Make this video your first overview. We'll set up your account as we go.");
  await start.verifyOffers({ site: "IWFT Channel · Video", title: VIDEO_TITLE });
  await start.verifyOffersSignIn();
});

test("Sign in from Start says the first overview makes the account, and the bar says where home is", async ({ launcher }) => {
  await launcher.launchPanel(signedOutPanelAnswered);
  const start = await launcher.homePage.verifyShowsStart();

  await start.signIn();

  const signIn = await launcher.signInPage.verifyAsksForEmail("Sign in");
  await signIn.verifySwitchLineSays("New here? Your first overview sets up your account.");
  await launcher.appShell.verifyBarIsTheOnlyWayBack("This video");
});

test("with nothing on the tab, the way back from Sign in is named Home", async ({ launcher }) => {
  await launcher.launchPanel({ ...signedOutPanelAnswered, activeVideoUrl: null });
  const start = await launcher.homePage.verifyShowsStart();

  await start.signIn();

  await launcher.signInPage.verifyAsksForEmail("Sign in");
  await launcher.appShell.verifyBarIsTheOnlyWayBack("Home");
});

test("the gate's Sign in keeps no way back to the gate", async ({ launcher }) => {
  await launcher.launchPanel({ ...signedOutPanelAnswered, accountSeen: true });
  await launcher.signedOutGate.verifyIsShown();

  await launcher.signedOutGate.chooseSignIn();

  await launcher.signInPage.verifyAsksForEmail("Sign in");
  await launcher.appShell.verifyBarNeverOffersTheWayBack();
});

// Beside something the offer takes the field's place, and the different link brings it back.
// A pasted link has no tab to read, so our server reads it. Seeded readable: with no answer the
// simulator says it read nothing, and the read-failure screen raced the video screen (OV-213).
test("beside a video, a different link can still be pasted", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: PAGE_ARTICLE });
  await launcher.launchPanel(signedOutPanelAnswered);
  const start = await launcher.homePage.verifyShowsStart();

  await start.pasteADifferentLink();

  await start.verifyOffersNothingFromTheTab();
  await start.submitHeroUrl(PAGE_URL);
  await launcher.onboardingPage.verifyOnScreen("video");
  await launcher.onboardingPage.verifyVideoTitle(PAGE_TITLE);
});

// Drawn tall: at 720 the panel scrolls rather than squeezing the deck (205g).
test("below 720 the panel scrolls", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.startSamples.offer(
    makeOverview({ source: { ...makeOverview().source, title: "A Sample" } }),
    makeArticleOverview(),
    makeRecipeOverview(),
  );
  await page.setViewportSize({ width: 400, height: 720 });
  await launcher.launchPanel(signedOutPanelAnswered);
  await launcher.homePage.verifyShowsStart();

  await launcher.homePage.scrollToTheFoot();

  await launcher.sampleDeck.verifyIsShown();
});

test("beside a page, the panel's Start offers it, and the page is read in the browser rather than spending a trial read", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({
    ...signedOutPanelAnswered,
    activeVideoUrl: null,
    articlePages: {
      page: { url: PAGE_URL, title: PAGE_TITLE, tabId: 7 },
      granted: true,
      read: { status: "read", article: PAGE_ARTICLE },
    },
  });

  const start = await launcher.homePage.verifyShowsStart();
  await start.verifyHeadlineReads("Learn More,");
  await start.verifyStandfirstReads("Make this page your first overview. We'll set up your account as we go.");
  await start.verifyOffers({ site: "theharbourpost.example · Article", title: PAGE_TITLE });
  await start.makeOverview();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right article?");
  await onboarding.verifyVideoTitle(PAGE_TITLE);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("on a tab with nothing to read, the panel's Start asks for a link", async ({ launcher }) => {
  await launcher.launchPanel({ ...signedOutPanelAnswered, activeVideoUrl: null });

  const start = await launcher.homePage.verifyShowsStart();

  await start.verifyOffersNothingFromTheTab();
  await start.verifyStandfirstReads(
    "Paste a link, or open a video or page you've been meaning to get to. We'll make it your first overview, to read or listen to, and set up your account as we go.",
  );
  await start.verifyHeroFieldEnabled();
});

test("in the panel, the account can be made with its code before the overview is written, and the overview arrives in it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  await page.setViewportSize({ width: 400, height: 600 });
  await launcher.launchPanel(signedOutPanelAnswered);
  await (await launcher.homePage.verifyShowsStart()).makeOverview();
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyWritingHasStarted();
  await onboarding.continueFromVoice();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account");

  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.enterCode(SIMULATED_LINK_CODE);

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.continueWithFree();
  await onboarding.verifyNearlyThere("Your plan is set. Your overview opens as soon as it's ready.");
  await onboarding.verifyArriving("writing");
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
});
