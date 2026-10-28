import { test, expect } from "../../support/fixtures.testHelper.js";
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

test("a new reader makes their first overview of the video the panel is beside, and lands on it signed in", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel(signedOutPanel);

  const start = await launcher.panelStart.verifyIsShown();
  await start.makeOverview();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics", "Help us improve The Overview?");
  await onboarding.verifyAnalyticsDisclosure();
  await onboarding.allowAnalytics();
  await onboarding.verifyOnScreen("video");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  await onboarding.confirmVideo();
  await onboarding.pickTopics("Food");
  await onboarding.continueFromTopics();
  await onboarding.next();
  await onboarding.pickRole("Healthcare");
  await onboarding.continueFromAboutYou();
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
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("Works in healthcare.");
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("About you in the panel shows five of each, with More for the rest", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel(signedOutPanelAnswered);
  await (await launcher.panelStart.verifyIsShown()).makeOverview();
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.verifyOnScreen("aboutYou");
  await onboarding.verifyRoleOffered("Retired", false);
  await onboarding.showMoreRoles();
  await onboarding.verifyRoleOffered("Retired", true);
});

test("with no video beside it, Start takes a pasted link instead, and refuses one it can't use", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...signedOutPanel, activeVideoUrl: null });
  const start = await launcher.panelStart.verifyIsShown();
  await start.verifyCantMakeWithoutAVideo();

  await start.pasteLink("https://example.com/recipes/onion");
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
