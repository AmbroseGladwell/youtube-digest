import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_URL, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { Routes } from "../../../src/app/Routes.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { OnboardingPageObject } from "../../pageObjects/OnboardingPageObject.testHelper.js";
import type { ExtractedArticle } from "@overview/domain";

// Onboarding around the reader's first link (docs/features/onboarding.md, designs 327a–327m).
const VIDEO_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const VIDEO_TITLE = "The Simulated Video";
const CODE = "ABCD-EFGH";
const ADA = { firstName: "Ada", email: SIMULATED_EMAIL, code: CODE };

// Asked nothing yet about analytics, so the screen is shown; answered, it is passed by.
const signedOut = { sync: true, analyticsConsent: null };
const signedOutAnswered = { sync: true };

// Nothing that costs anything runs before the account: the link is only read.
const nothingPaidYet = (backendSimulator: BackendSimulator) => {
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  expect(backendSimulator.getCallCount(EndpointKey.OUR_KEY_GENERATE)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);
  expect(backendSimulator.podcasts.transcriptAsks()).toEqual([]);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
};

// Past Your link, skipping every question there is, to the account.
const skipToAccount = async (onboarding: OnboardingPageObject) => {
  await onboarding.confirmVideo();
  await onboarding.verifyOnScreen("saving");
  await onboarding.skip();
  await onboarding.verifyOnScreen("topics");
  await onboarding.skip();
  await onboarding.verifyOnScreen("knowledgeBase");
  await onboarding.skip();
  await onboarding.verifyOnScreen("stepsForYou");
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account to get your overview.");
};

test("a new reader sees their link read back, answers the questions, creates an account, waits while it's written and opens it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("analytics", "Help shape what we build next?");
  await onboarding.verifyStepCountReads("Step 2 of 6");
  await onboarding.verifyAnalyticsDisclosure();
  await onboarding.allowAnalytics();

  await onboarding.verifyOnScreen("video", "Here’s what’s in the video you saved.");
  await onboarding.verifyStepCountReads("Step 3 of 6");
  await onboarding.verifyOffersSkip(false);
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  await onboarding.verifyPillsRead(/^Read\d+ min$/, /^Listen\d+ min$/, "Share");
  await onboarding.verifySaysSavedToLibrary();
  await onboarding.confirmVideo();

  await onboarding.verifyOnScreen("saving", "Save the content you want to come back to.");
  await onboarding.verifyStepCountReads("Step 3 of 6");
  await onboarding.verifyExtensionCantBeAddedYet();
  await onboarding.continueFromSaving();

  await onboarding.verifyOnScreen("topics", "It joins a library built around what you care about.");
  await onboarding.verifyStepCountReads("Step 4 of 6");
  await onboarding.verifySuggestsNothing();
  await onboarding.seeAllTopics();
  await onboarding.typeTopic("chess");
  await onboarding.pickTopics("Food", "Health");
  await onboarding.verifyTopicCountReads("3 picked");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("knowledgeBase", "Your own AI knowledge base.");
  await onboarding.verifyStepCountReads("Step 4 of 6");
  await onboarding.continueFromKnowledgeBase();

  await onboarding.verifyOnScreen("stepsForYou", "Steps that fit your life.");
  await onboarding.verifyStepCountReads("Step 4 of 6");
  await onboarding.addContextAboutYou();

  await onboarding.verifyOnScreen("aboutYou", "Make it yours.");
  await onboarding.verifyStepCountReads("Step 5 of 6");
  await onboarding.sentence.verifySentenceReads(
    "I'm a few things at once, I spend my time on all sorts, and right now I'm focusing on getting better at something.",
  );
  await onboarding.sentence.verifySectionName("who", "Who you are: empty. Fill in.");
  await onboarding.sentence.openSection("who");
  await onboarding.sentence.verifySheetHasFocus("Who you are");
  await onboarding.sentence.pick("dad", "husband");
  await onboarding.sentence.done();
  await onboarding.sentence.verifySectionHasFocus("who");
  await onboarding.sentence.verifySectionName("who", "Who you are: a dad and a husband. Edit.");
  await onboarding.sentence.openSection("focus");
  await onboarding.sentence.verifyGroups("From Health", "From Food", "Life");
  await onboarding.sentence.pick("new recipes");
  await onboarding.sentence.addOwn("Life", "a half marathon");
  await onboarding.sentence.verifyInSection("new recipes", "a half marathon");
  await onboarding.sentence.done();
  await onboarding.sentence.verifySentenceReads(
    "I'm a dad and a husband, I spend my time on all sorts, and right now I'm focusing on new recipes and a half marathon.",
  );
  await onboarding.continueFromAboutYou();

  await onboarding.verifyOnScreen("account", "Create your free account to get your overview.");
  await onboarding.verifyStepCountReads("Step 6 of 6");
  await onboarding.verifyAccountCard({ title: VIDEO_TITLE, answers: ["chess", "Food", "Health", "Personalised"] });
  await onboarding.accountForm.verifySavedOverviewsNoteReads("No card needed. Free includes 5 overviews a month.");
  nothingPaidYet(backendSimulator);
  expect(backendSimulator.videos.reads()).toEqual([IWFT_VIDEO_ID]);
  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyHasNoStepper();
  await onboarding.verifyWaitStageCount(2);
  await onboarding.verifyWaitStage(0, { state: "done", text: /^Transcript fetched · [\d,]+ words?/ });
  await onboarding.verifyWaitStage(1, { state: "done", text: /^Overview written/ });
  await onboarding.verifyWaitSays("Your overview is ready.");
  await onboarding.verifyWaitOffersSetups();
  const reader = await onboarding.openOverview();

  await reader.verifyTitle(VIDEO_TITLE);
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input.readerContext).toBe("I'm a dad and a husband, and right now I'm focusing on new recipes and a half marathon.");
  expect(made?.input.existingTopics.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "chess", description: null },
    { name: "Food", description: "Cooking, recipes and eating well." },
    { name: "Health", description: "Your body's wellbeing, including nutrition, sleep and medicine." },
  ]);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([null]);
  expect(await backendSimulator.sync.overviewsHeldIn(SIMULATED_ACCOUNT_ID)).toBe(1);
});

test("every question can be skipped, Skip on Moment 3 goes straight to the account, and the overview knows nothing of the reader", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video");
  await onboarding.confirmVideo();
  await onboarding.verifyOnScreen("saving");
  await onboarding.skip();
  await onboarding.verifyTopicCountReads("No topics yet? That's fine. New overviews will wait in Unsorted until you sort them.");
  await onboarding.skip();
  await onboarding.verifyOnScreen("knowledgeBase");
  await onboarding.skip();
  await onboarding.verifyOnScreen("stepsForYou");
  await onboarding.skip();

  await onboarding.verifyOnScreen("account");
  await onboarding.verifyAccountCard({ title: VIDEO_TITLE, answers: [] });
  nothingPaidYet(backendSimulator);
  await onboarding.createAccount(ADA);

  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input.readerContext).toBeNull();
  expect(made?.input.existingTopics).toEqual([]);
});

test("Skip on About you goes to the account with nothing kept from the sentence", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.continueFromTopics();
  await onboarding.continueFromKnowledgeBase();
  await onboarding.addContextAboutYou();
  await onboarding.verifyOnScreen("aboutYou");
  await onboarding.sentence.fill("time", "software");

  await onboarding.skip();

  await onboarding.verifyOnScreen("account");
  await onboarding.verifyAccountCard({ title: VIDEO_TITLE, answers: [] });
});

test("back goes a screen at a time, through the moments, and from Your link to Start", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.verifyOnScreen("topics");

  await onboarding.back();
  await onboarding.verifyOnScreen("saving");
  await onboarding.back();
  await onboarding.verifyOnScreen("video");
  await onboarding.back();

  await home.verifyShowsStart();
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
    .toEqual(expect.arrayContaining(["onboarding.start.linkSubmitted", "onboarding.step.shown", "analyticsConsent.prompt.accepted"]));
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
  await onboarding.verifyOnScreen("saving");

  expect(backendSimulator.analytics.eventNames()).toEqual([]);
});

test("an overview that can't be written says so on the wait, and Try again writes it on the account", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointError(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await skipToAccount(onboarding);
  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyWaitFailed();
  await onboarding.verifyCanOpenOverview(false);
  backendSimulator.simulateEndpointDefault(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.tryAgainFromWait();

  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name }) => name === "onboarding.overview.failed" || name === "onboarding.overview.retried")
        .map(({ name, props }) => ({ name, ...props })),
    )
    .toEqual([
      { name: "onboarding.overview.failed", step: "wait", afterAccount: true },
      { name: "onboarding.overview.retried", from: "account" },
    ]);
});

test("a reader with an account switches the form to signing in in place, and lands on the overview after the wait", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await skipToAccount(onboarding);

  await onboarding.signIn({ email: SIMULATED_EMAIL, code: CODE });

  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.auth.magicLinkRequests()).toEqual([{ email: SIMULATED_EMAIL, surface: "web", intent: "signIn" }]);
  expect(backendSimulator.auth.emailCodeAttempts()).toEqual([{ email: SIMULATED_EMAIL, code: CODE }]);
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.finished.revealed")?.props)
    .toEqual({ way: "signIn", from: "link" });
});

test("the account form asks for a first name and an email beside the terms, and the code comes in its place, sent with no button", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await skipToAccount(onboarding);
  const form = await onboarding.accountForm.verifyAsksForEmail("Create your free account to get your overview.");
  await launcher.accountTermsLine.verifyReadsAboveTheButton(/^https?:\/\/[^/]+/, false);

  await form.typeFirstName("Ada");
  await form.requestLink(SIMULATED_EMAIL);

  await onboarding.verifyOnScreen("account");
  await form.verifyAsksForCode(SIMULATED_EMAIL);
  await form.verifySubmitReads("Create account");
  expect(backendSimulator.auth.magicLinkRequests()).toEqual([
    { email: SIMULATED_EMAIL, surface: "web", intent: "createAccount", firstName: "Ada" },
  ]);
  nothingPaidYet(backendSimulator);

  await form.typeCode(CODE);

  await onboarding.verifyOnScreen("wait");
  expect(backendSimulator.auth.emailCodeAttempts()).toEqual([{ email: SIMULATED_EMAIL, code: CODE }]);
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

  await home.submitHeroUrl("https://www.youtube.com/playlist?list=WL");

  await home.verifyHeroValidationError("That doesn't look like a link we can read. Try the address of a video or a web page.");
  expect(backendSimulator.videos.reads()).toEqual([]);
  nothingPaidYet(backendSimulator);
});

test("a playlist link starts with its first video, and another of its videos can be chosen instead", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.playlists.seed(psychologyPlaylist());
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(PSYCHOLOGY_URL);

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video");
  await onboarding.verifyPlaylistTitle("Psychology");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  const [, second] = psychologyPlaylist().entries.filter((entry) => entry.availability === "available");
  await onboarding.chooseDifferentVideo(second!.videoId);
  await expect.poll(() => backendSimulator.videos.reads()).toEqual([IWFT_VIDEO_ID, second!.videoId]);
  nothingPaidYet(backendSimulator);
});

test("going home in the middle carries on at the same screen", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
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
  await expect.poll(() => backendSimulator.analytics.eventNames()).toEqual(expect.arrayContaining(["timeSaved.firstOverview.dismissed"]));
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

test("a section stops taking text at its limit and says why, and Escape folds the field back", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.continueFromTopics();
  await onboarding.continueFromKnowledgeBase();
  await onboarding.addContextAboutYou();

  await onboarding.sentence.openSection("focus");
  await onboarding.sentence.typeOwn("Life", "x".repeat(130));

  await onboarding.sentence.verifyOwnCountReads("120 / 120");
  await onboarding.sentence.verifyOwnCountReads("That's as long as a section gets");
  await onboarding.sentence.closeOwnWithEscape();
  await onboarding.sentence.verifyOwnChipHasFocus("Life");
  await onboarding.sentence.closeSheetWithEscape();
  await onboarding.sentence.verifySectionHasFocus("focus");
});

test("the sentence fills in as entries are picked, and Continue keeps a pick that Done never closed, through to the overview", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.continueFromTopics();
  await onboarding.continueFromKnowledgeBase();
  await onboarding.addContextAboutYou();

  await onboarding.sentence.openSection("who");
  await onboarding.sentence.pick("dad");
  await onboarding.sentence.verifySectionName("who", "Who you are: a dad. Edit.");
  await onboarding.sentence.clickAwayFromSheet();
  await onboarding.sentence.verifySheetIsClosed();
  await onboarding.sentence.verifySectionName("who", "Who you are: a dad. Edit.");

  await onboarding.sentence.openSection("focus");
  await onboarding.sentence.addOwn("Life", "building with AI");
  await onboarding.sentence.verifySentenceReads("I'm a dad, I spend my time on all sorts, and right now I'm focusing on building with AI.");
  await onboarding.continueFromAboutYou();

  await onboarding.verifyOnScreen("account");
  await onboarding.verifyAccountCard({ title: VIDEO_TITLE, answers: ["Personalised"] });
  await onboarding.createAccount(ADA);
  await onboarding.openOverview();
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I'm a dad, and right now I'm focusing on building with AI.");
});

const ARTICLE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const ARTICLE: ExtractedArticle = {
  url: ARTICLE_URL,
  title: "The town that pays its bridge bill twice",
  siteName: "The Harbour Post",
  author: "Asha Rao",
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011.", links: [] }],
  wordCount: 3220,
  recipe: null,
};

const RECIPE_ARTICLE: ExtractedArticle = {
  ...ARTICLE,
  title: "Charred leek and white bean stew",
  siteName: "Example Kitchen",
  recipe: {
    ingredients: ["2 leeks", "1 tin white beans"],
    steps: [{ text: "Char the leeks.", group: null }],
    prepMinutes: 15,
    cookMinutes: 50,
    totalMinutes: 65,
    yield: "4",
  },
};
const PASTED = "theharbourpost.example/2026/11/bridge-bill-twice";

test("an article link is read on the device's trial, shown back as an article, and written only once the account exists", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Here’s what’s in the article you saved.");
  await onboarding.verifyVideoTitle(ARTICLE.title);
  await onboarding.verifyFound({ kicker: "The Harbour Post · Article", facts: "14 min read · theharbourpost.example" });
  await onboarding.verifyYourLinkLineReads(/^A 14-minute read from The Harbour Post, /);
  await onboarding.verifyInsideReads("Premise, key points, a verdict, steps, and the things it links to.");
  await skipToAccount(onboarding);
  nothingPaidYet(backendSimulator);

  await onboarding.createAccount(ADA);

  await onboarding.verifyWaitStage(0, { state: "done", text: /^Page fetched/ });
  await onboarding.openOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("article.url", ARTICLE_URL);
  expect(backendSimulator.articles.reads()).toEqual([ARTICLE_URL]);
  expect(backendSimulator.articles.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("topics suggested from a page come pre-ticked, and one ticked off again isn't kept", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({
    status: "read",
    article: {
      ...ARTICLE,
      title: "Why your workout matters less than your sleep",
      sections: [
        {
          heading: null,
          anchor: null,
          text: "Muscle is built in recovery, not in the gym. Training hard on poor sleep undoes it.",
          links: [],
        },
      ],
    },
  });
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();

  await onboarding.verifyOnScreen("topics");
  await onboarding.verifySuggests("For this article · from its title and description", "Fitness", "Health");
  await onboarding.verifySuggestionPressed("Fitness", true);
  await onboarding.verifySuggestionPressed("Health", true);
  await onboarding.verifyTopicCountReads("2 picked");
  await onboarding.toggleSuggestion("Health");
  await onboarding.verifySuggestionPressed("Health", false);
  await onboarding.continueFromTopics();
  await onboarding.verifyOnScreen("knowledgeBase");
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 1, typed: 0, suggested: 2, pickedSuggested: 1, suggestedBy: "code-failed" });
  expect((await backendSimulator.overviewStore.listTopics()).map(({ name }) => name)).toEqual(["Fitness"]);
});

test("Popular offers eight topics beside the suggestions, and See all opens all 27 with a field for another", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();

  await onboarding.verifyTopicsOffered("Popular topics", ["Business", "Tech", "Travel", "Finance", "Science", "Design", "Food", "Career"]);
  await onboarding.verifyCanTypeTopic(false);
  await onboarding.seeAllTopics();

  await onboarding.verifyTopicCountIn("All topics", 27);
  await onboarding.verifyCanTypeTopic(true);
  await onboarding.typeTopic("Sourdough");
  await onboarding.verifyTopicPressed("Sourdough", true);
  await onboarding.verifyTopicCountIn("All topics", 28);
});

test("suggestions matched in code while the model's answer is still on its way are counted as such", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.holdsTopicSuggestions();
  backendSimulator.articles.answerWith({
    status: "read",
    article: { ...ARTICLE, title: "Why your workout matters less than your sleep" },
  });
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();
  await onboarding.verifySuggests("For this article · from its title and description", "Health", "Fitness");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("knowledgeBase");
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 2, typed: 0, suggested: 2, pickedSuggested: 2, suggestedBy: "code-pending" });
});

test("the model's suggestions, asked on the trial as soon as the video is read, can name one new topic, made with no description", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.suggestsTopics({ starter: ["Food"], newTopic: "Knife skills" });
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await onboarding.confirmVideo();
  await onboarding.continueFromSaving();

  await onboarding.verifyOnScreen("topics");
  await onboarding.verifySuggests("For this video · from its title and description", "Food", "Knife skillsNew");
  await onboarding.verifySuggestionIsNew("Knife skills");
  await onboarding.verifySuggestionPressed("Knife skills", true);
  await onboarding.continueFromTopics();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account");
  const [asked] = backendSimulator.ourKey.topicSuggestionsAsked();
  expect(asked?.input).toEqual({ title: VIDEO_TITLE, kind: "video", text: expect.any(String) });
  expect(asked?.trialToken).toMatch(/^simulated-trial-/);
  await onboarding.createAccount(ADA);
  await onboarding.openOverview();

  expect(backendSimulator.ourKey.generations()[0]?.input.existingTopics.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "Food", description: "Cooking, recipes and eating well." },
    { name: "Knife skills", description: null },
  ]);
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 1, typed: 1, suggested: 2, pickedSuggested: 2, suggestedBy: "model" });
});

test("a recipe page is shown back as a recipe, with the page's own times and Cook first", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: RECIPE_ARTICLE });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyOnScreen("video", "Here’s the recipe you saved.");
  await onboarding.verifyFound({
    kicker: "Example Kitchen · Recipe",
    facts: "1 hr 5 min · Serves 4 · theharbourpost.example",
  });
  await onboarding.verifyPillsRead("Cook cooking mode", "Read", "Share");
});

test("a paywalled page says so where the read lands, keeps the link, and takes another in its place", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "paywalled", shownWords: 180 });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "That article is behind a paywall", link: PASTED });
  await onboarding.verifyOffersTryAgain(false);
  nothingPaidYet(backendSimulator);

  await onboarding.tryAnotherLink("not a link");
  await onboarding.verifyAnotherLinkAsks("Paste a link to a video or a page");
  await onboarding.tryAnotherLink(VIDEO_URL);
  await onboarding.verifyOnScreen("video", "Here’s what’s in the video you saved.");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
});

test("a site that turns us away asks for another link rather than sending a new reader to the extension", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "blocked", siteName: "The Harbour Post" });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "The Harbour Post didn't let us in", link: PASTED });
  await onboarding.verifyTellsOfExtension(true);
});

test("a site that doesn't respond can be tried again, which reads it once more", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "no-answer" });
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyReadFailure({ title: "theharbourpost.example didn't respond", link: PASTED });

  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  await onboarding.tryReadingAgain();

  await onboarding.verifyOnScreen("video", "Here’s what’s in the article you saved.");
  expect(backendSimulator.articles.reads()).toEqual([ARTICLE_URL, ARTICLE_URL]);
});

test("a video YouTube can't find says so where the read lands, and spends nothing", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.videos.answerWith({ status: "failed", reason: "not-found" });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "We couldn't find that video", link: `youtube.com/watch?v=${IWFT_VIDEO_ID}` });
  await onboarding.verifyOffersTryAgain(false);
  expect(backendSimulator.videos.reads()).toEqual([IWFT_VIDEO_ID]);
  nothingPaidYet(backendSimulator);
});

test("a device out of trial reads says to sign in or try tomorrow", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.trialReadsSpent("trial-reads");
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "You've tried 5 links on this device", link: PASTED });
  await onboarding.verifyOffersTryAgain(false);
});

test("a network out of trial reads for the day says to try tomorrow", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.trialReadsSpent("trial-reads-address");
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "We've read a lot of links from your network today", link: PASTED });
});

const toAccount = async (launcher: Launcher) => {
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await skipToAccount(onboarding);
  return onboarding;
};

test("signed out, the link is only read: writing starts once the account exists, and the overview arrives in it, counted once", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  await launcher.onboardingPage.allowAnalytics();
  const onboarding = await toAccount(launcher);
  nothingPaidYet(backendSimulator);

  await onboarding.createAccount(ADA);

  await onboarding.verifyOnScreen("wait", "Pulling out the good bits…");
  await onboarding.verifyWaitStage(1, { state: "running", text: "Creating overview" });
  await onboarding.verifyAsksToKeepTheTab(true);
  await onboarding.verifyCanOpenOverview(false);
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.OUR_KEY_GENERATE)).toBe(1);
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);

  await onboarding.verifyWaitSays("Your overview is ready.");
  await onboarding.verifyAsksToKeepTheTab(false);
  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([null]);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
  expect(await backendSimulator.sync.overviewsHeldIn(SIMULATED_ACCOUNT_ID)).toBe(1);
  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name }) => name === "onboarding.account.landed" || name === "onboarding.overview.arrived")
        .map(({ name, props }) => ({ name, ...props })),
    )
    .toEqual([
      { name: "onboarding.account.landed", way: "createAccount", overview: "writing" },
      { name: "onboarding.overview.arrived", seconds: expect.any(Number), step: "wait" },
    ]);
});

test("the sign-in link finishing in another tab leaves the run where it is, and the overview is written once there", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await toAccount(launcher);
  const form = await onboarding.accountForm.verifyAsksForEmail("Create your free account to get your overview.");
  await form.typeFirstName("Ada");
  await form.requestLink(SIMULATED_EMAIL);
  nothingPaidYet(backendSimulator);

  await launcher.signInFromAnotherTab();

  await onboarding.verifyOnScreen("wait");
  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
});

test("a tab that isn't running the overview mirrors the tab that is, and takes the run over once that tab has gone", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();

  await launcher.anotherTabHoldsOnboardingRun(VIDEO_URL, "writing");
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.createAccount(ADA);
  await onboarding.verifyOnScreen("wait");
  await onboarding.verifyCanOpenOverview(false);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await launcher.anotherTabCloses();

  const reader = await onboarding.openOverview();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
});
