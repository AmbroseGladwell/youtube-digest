import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";

// Onboarding in the extension's side panel (docs/features/onboarding.md, designs 46n–46q).
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

test("a new reader makes their first overview of the video the panel is beside, lands on it signed in, and is offered their AI", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.ourKey.isAvailable();
  await page.setViewportSize({ width: 400, height: 600 });
  await launcher.launchPanel(signedOutPanel);

  const start = await launcher.panelStart.verifyIsShown();
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
  await (await launcher.panelStart.verifyIsShown()).makeOverview();
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

test("with no video beside it, Start takes a pasted link instead, and refuses one it can't use", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...signedOutPanel, activeVideoUrl: null });
  const start = await launcher.panelStart.verifyIsShown();
  await start.verifyCantMakeWithoutAVideo();

  await start.pasteLink("https://www.youtube.com/playlist?list=WL");
  await start.verifyRefused();
  await start.pasteLink(VIDEO_URL);

  await launcher.onboardingPage.verifyOnScreen("analytics");
});

test("signed out on a device that has had an account, the panel offers signing back in, and no overviews", async ({
  launcher,
}) => {
  await launcher.launchPanel({ ...signedOutPanel, accountSeen: true });

  await launcher.signedOutGate.verifyIsShown();
  await launcher.signedOutGate.verifyTitle("Sign in to see your overviews");
  await launcher.panelStart.verifyIsAbsent();
});

const PAGE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const PAGE_TITLE = "The town that pays its bridge bill twice";

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
      read: {
        status: "read",
        article: {
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
        },
      },
    },
  });

  const start = await launcher.panelStart.verifyIsShown();
  await start.verifyHeading("Make an overview of this page");
  await start.makeOverview();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right article?");
  await onboarding.verifyVideoTitle(PAGE_TITLE);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

test("on a tab with nothing to read, the panel's Start asks for a link", async ({ launcher }) => {
  await launcher.launchPanel({ ...signedOutPanelAnswered, activeVideoUrl: null });

  const start = await launcher.panelStart.verifyIsShown();

  await start.verifyHeading("Paste a link to start");
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
  await (await launcher.panelStart.verifyIsShown()).makeOverview();
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
