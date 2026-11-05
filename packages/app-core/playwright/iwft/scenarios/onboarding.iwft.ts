import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_URL, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { Routes } from "../../../src/app/Routes.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { ExtractedArticle } from "@overview/domain";

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
  await onboarding.verifyOnScreen("analytics", "Help shape what we build next?");
  await onboarding.verifyAnalyticsDisclosure();
  await onboarding.allowAnalytics();

  await onboarding.verifyOnScreen("video", "Is this the right video?");
  await onboarding.verifyVideoTitle(VIDEO_TITLE);
  await onboarding.verifyPreviewSays("Transcript ready. Writing starts in a few taps.");
  await onboarding.verifyPreviewMarksNow("source");
  await onboarding.verifyPreviewStepReads("source", "Transcript ready. Is it the right one?");
  await onboarding.verifyHasNoProgressBar();
  await onboarding.confirmVideo();

  await onboarding.verifyOnScreen("topics", "What are you curious about?");
  await onboarding.verifyPreviewMarksNow("topics");
  await onboarding.verifyPreviewStepReads("topics", "Pick as many as you like");
  await onboarding.verifySuggestsNothing();
  await onboarding.typeTopic("chess");
  await onboarding.pickTopics("Food", "Health");
  await onboarding.verifyTopicCountReads("3 picked");
  await onboarding.verifyPreviewStepReads("topics", "chessFoodHealth");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("library", "A library that sorts itself");
  await onboarding.verifyPreviewMarksNow(null);
  await onboarding.verifyLibrarySlide({
    lead: "As each overview is written, we check it against your topics and add it to the ones it fits best, if any.",
    scene: [VIDEO_TITLE, "Your overview · not written yet", "chess", "Food", "Health"],
  });
  await onboarding.next();

  await onboarding.verifyOnScreen("aboutYou", "About you");
  await onboarding.verifyPreviewSays("Transcript ready. Writing starts when you continue.");
  await onboarding.verifyPreviewMarksNow("you");
  await onboarding.verifyPreviewStepReads("you", "Fill in as much as you like. Personalises your overviews.");
  await onboarding.verifyHasNoProgressBar();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.sentence.verifySentenceReads("I'm a few things at once, I spend my time on all sorts, and right now I'm focusing on getting better at something.");
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
  await onboarding.sentence.verifySentenceReads("I'm a dad and a husband, I spend my time on all sorts, and right now I'm focusing on new recipes and a half marathon.");
  await onboarding.continueFromAboutYou();

  await onboarding.verifyOnScreen("stepsForYou", "Steps that fit around you");
  await onboarding.verifyPreviewMadeWith("3 topics", "Personalised", "Heart voice");
  await onboarding.verifySentenceQuoted("I'm a dad and a husband, and right now I'm focusing on new recipes and a half marathon.");
  await onboarding.nextFromStepsForYou();

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
  expect(made?.input.readerContext).toBe("I'm a dad and a husband, and right now I'm focusing on new recipes and a half marathon.");
  expect(made?.input.existingTopics.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "chess", description: null },
    { name: "Food", description: "Cooking, recipes and eating well." },
    { name: "Health", description: "Your body's wellbeing, including nutrition, sleep and medicine." },
  ]);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("every question can be skipped, and writing starts once the slide after About you is passed, with nothing about the reader", async ({
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
  await onboarding.verifyLibrarySlide({
    lead: "Overviews wait in Unsorted until you add topics. Add one any time, and we'll check new overviews against it as they're written.",
    scene: ["No topics yet, so it waits in", "Unsorted"],
  });
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.skip();

  await onboarding.verifyOnScreen("stepsForYou", "Let's make your overviews personal and actionable");
  await onboarding.verifyPreviewSays("Transcript ready. Writing starts when you continue.");
  await onboarding.verifyPreviewStepReads("topics", "None picked");
  await onboarding.verifyHasNoProgressBar();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.skip();

  await onboarding.verifyOnScreen("voice");
  await onboarding.verifyCanSeeOverview();
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input.readerContext).toBeNull();
  expect(made?.input.existingTopics).toEqual([]);
});

test("the library slide shows the first five of the reader's own topics and says how many more", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.pickTopics("AI", "Tech", "Career", "Health", "Food", "Home", "Books");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("library");
  await onboarding.verifyLibrarySlide({
    lead: "As each overview is written, we check it against your topics and add it to the ones it fits best, if any.",
    scene: ["AI", "Tech", "Career", "Health", "Food", "and 2 more"],
  });
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
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.verifyOnScreen("voice");
  await onboarding.verifySaysItFailed();
  await onboarding.verifyPreviewOffersTryAgain();
  await onboarding.tryAgainFromPreview();
  await onboarding.verifySaysItFailed();
  await onboarding.continueFromVoice();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account");

  backendSimulator.simulateEndpointDefault(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.tryAgain();

  await onboarding.verifyTeaser({ title: VIDEO_TITLE, premise: "Made on our key." });
  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name }) => name === "onboarding.overview.retried")
        .map(({ props }) => props),
    )
    .toEqual([{ from: "preview" }, { from: "account" }]);
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

  await home.submitHeroUrl("https://www.youtube.com/playlist?list=WL");

  await home.verifyHeroValidationError("That doesn't look like a link we can read. Try the address of a video or a web page.");
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

test("the slide after a skipped About you goes back to the sentence, and what's added there reaches the overview", async ({
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
  await onboarding.verifyOnScreen("stepsForYou");

  await onboarding.personalise();

  await onboarding.verifyOnScreen("aboutYou");
  await onboarding.sentence.fill("time", "software");
  await onboarding.continueFromAboutYou();
  await onboarding.verifyOnScreen("stepsForYou", "Steps that fit around you");
  await onboarding.nextFromStepsForYou();
  await onboarding.verifyCanSeeOverview();
  expect(backendSimulator.ourKey.generations()[0]?.input.readerContext).toBe("I spend my time on software.");
});

test("a section stops taking text at its limit and says why, and Escape folds the field back", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();

  await onboarding.sentence.openSection("focus");
  await onboarding.sentence.typeOwn("Life", "x".repeat(130));

  await onboarding.sentence.verifyOwnCountReads("120 / 120");
  await onboarding.sentence.verifyOwnCountReads("That's as long as a section gets");
  await onboarding.sentence.closeOwnWithEscape();
  await onboarding.sentence.verifyOwnChipHasFocus("Life");
  await onboarding.sentence.closeSheetWithEscape();
  await onboarding.sentence.verifySectionHasFocus("focus");
});

test("the sentence fills in as entries are picked, and Continue keeps a pick that Done never closed", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();

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

  await onboarding.verifyOnScreen("stepsForYou");
  await onboarding.verifySentenceQuoted("I'm a dad, and right now I'm focusing on building with AI.");
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
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011." }],
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

test("an article link is read on the device's trial, confirmed as an article, and made once the questions are passed", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right article?");
  await onboarding.verifyVideoTitle(ARTICLE.title);
  await onboarding.verifyFound({ kicker: "The Harbour Post · Article", facts: "By Asha Rao · 14 min read" });
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.seeOverview();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaserReads({
    byline: "The Harbour Post · Article · 14 min read",
    locked: "Key points, How to apply and Verdict open with an account.",
  });
  const [made] = backendSimulator.ourKey.generations();
  expect(made?.input).toHaveProperty("article.url", ARTICLE_URL);
  expect(backendSimulator.articles.reads()).toEqual([ARTICLE_URL]);
  expect(backendSimulator.articles.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
});

test("topics suggested from a page's title and text come first, and picking one presses it in the full list too", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({
    status: "read",
    article: {
      ...ARTICLE,
      title: "Why your workout matters less than your sleep",
      sections: [{ heading: null, anchor: null, text: "Muscle is built in recovery, not in the gym. Training hard on poor sleep undoes it." }],
    },
  });
  const home = await launcher.launch(signedOut);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.allowAnalytics();
  await onboarding.confirmVideo();

  await onboarding.verifyOnScreen("topics");
  await onboarding.verifySuggests("For this article · suggested from what it's about", "Fitness", "Health");
  await onboarding.pickSuggestion("Health");
  await onboarding.verifyTopicPressed("Health", true);
  await onboarding.verifyTopicPressed("Fitness", false);
  await onboarding.verifyPreviewStepReads("topics", "Health");
  await onboarding.continueFromTopics();
  await onboarding.verifyOnScreen("library");
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 1, typed: 0, suggested: 2, pickedSuggested: 1, suggestedBy: "code-failed" });
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
  await onboarding.verifySuggests("For this article · suggested from what it's about", "Health", "Fitness");
  await onboarding.continueFromTopics();

  await onboarding.verifyOnScreen("library");
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 0, typed: 0, suggested: 2, pickedSuggested: 0, suggestedBy: "code-pending" });
});

test("the model's suggestions, asked on the trial as soon as the video is found, can name one new topic, made with no description", async ({
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

  await onboarding.verifyOnScreen("topics");
  await onboarding.verifySuggests("For this video · suggested from what it's about", "Food", "Knife skillsNew");
  await onboarding.verifySuggestionIsNew("Knife skills");
  await onboarding.pickSuggestion("Knife skills");
  await onboarding.continueFromTopics();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("voice");

  const [asked] = backendSimulator.ourKey.topicSuggestionsAsked();
  expect(asked?.input).toEqual({
    title: VIDEO_TITLE,
    kind: "video",
    text: expect.stringContaining("Hello and welcome to the simulated video."),
  });
  expect(asked?.trialToken).toMatch(/^simulated-trial-/);
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input.existingTopics.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "Knife skills", description: null },
  ]);
  await expect
    .poll(() => backendSimulator.analytics.events().find(({ name }) => name === "onboarding.topics.continued")?.props)
    .toEqual({ picked: 0, typed: 1, suggested: 2, pickedSuggested: 1, suggestedBy: "model" });
});

test("a recipe page is confirmed as a recipe, with the page's own times", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: RECIPE_ARTICLE });
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyOnScreen("video", "Is this the right recipe?");
  await onboarding.verifyFound({ kicker: "Example Kitchen · Recipe", facts: /Prep\s*15 min.*Cook\s*50 min.*Total\s*1 hr 5 min.*Makes\s*4/ });
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
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await onboarding.tryAnotherLink("not a link");
  await onboarding.verifyAnotherLinkAsks("Paste a link to a video or a page");
  await onboarding.tryAnotherLink(VIDEO_URL);
  await onboarding.verifyOnScreen("video", "Is this the right video?");
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

  await onboarding.verifyOnScreen("video", "Is this the right article?");
  expect(backendSimulator.articles.reads()).toEqual([ARTICLE_URL, ARTICLE_URL]);
});

test("a device out of trial reads is asked for a video link, which uses none", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.trialReadsSpent("trial-reads");
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "You've tried 5 pages on this device", link: PASTED });
  await onboarding.verifyAnotherLinkAsks("Paste a video link");
});

test("a network out of trial reads for the day says to try a page tomorrow", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.trialReadsSpent("trial-reads-address");
  const home = await launcher.launch(signedOutAnswered);

  await home.submitHeroUrl(ARTICLE_URL);
  const onboarding = await launcher.onboardingPage.verifyIsShown();

  await onboarding.verifyReadFailure({ title: "We've read a lot of pages from your network today", link: PASTED });
});

// A reader who answers quickly reaches the account screen before the overview is written, and
// isn't held up there (docs/features/onboarding.md, "The account" and "Into the account").
const quickReaderToAccount = async (launcher: Launcher) => {
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.confirmVideo();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("voice");
  await onboarding.verifyWritingHasStarted();
  await onboarding.continueFromVoice();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyNotReadyReads("Your overview is still being written. It'll be ready in your account.");
  return onboarding;
};

test("the account can be made before the overview is written, and the overview then arrives in it, counted once", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  await launcher.onboardingPage.allowAnalytics();
  const onboarding = await quickReaderToAccount(launcher);

  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.verifyArriving("writing");
  await onboarding.verifyCantContinueWithFree();
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.verifyCanContinueWithFree();
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
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
      { name: "onboarding.overview.arrived", seconds: expect.any(Number), step: "plan" },
    ]);
});

test("a reader with an account who signs in before the overview is written waits on one screen, then lands on it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await quickReaderToAccount(launcher);

  const signIn = await onboarding.signIn();
  await signIn.requestLink(SIMULATED_EMAIL);
  await signIn.chooseCodeFromEmail();
  await signIn.enterCode("ABCD-EFGH");

  await onboarding.verifyNearlyThere();
  await onboarding.verifyArriving("writing");
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
});

test("an overview that fails after the account exists says so on the plan, and Try again makes it on the account", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOut);
  await home.submitHeroUrl(VIDEO_URL);
  await launcher.onboardingPage.allowAnalytics();
  const onboarding = await quickReaderToAccount(launcher);

  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.verifyOnScreen("plan", "Choose your plan");

  backendSimulator.ourKey.refuses(503, "unavailable", {});
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.verifyArriving("failed");
  await onboarding.verifyCantContinueWithFree();

  backendSimulator.ourKey.refusesNoMore();
  await onboarding.tryAgainAfterAccount();
  await onboarding.verifyCanContinueWithFree();
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([null]);
  expect(await backendSimulator.sync.overviewsHeldIn(null)).toBe(0);
  await expect
    .poll(() =>
      backendSimulator.analytics
        .events()
        .filter(({ name }) => name === "onboarding.overview.failed" || name === "onboarding.overview.retried")
        .map(({ name, props }) => ({ name, ...props })),
    )
    .toEqual([
      { name: "onboarding.overview.failed", step: "plan", afterAccount: true },
      { name: "onboarding.overview.retried", from: "plan" },
    ]);
});

test("the sign-in link finishing in another tab leaves the run where it is, and the overview still arrives", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_GENERATE);
  const home = await launcher.launch(signedOutAnswered);
  await home.submitHeroUrl(VIDEO_URL);
  const onboarding = await quickReaderToAccount(launcher);
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);

  await launcher.signInFromAnotherTab();

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.verifyArriving("writing");
  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_GENERATE);
  await onboarding.verifyCanContinueWithFree();
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([expect.stringMatching(/^simulated-trial-/)]);
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
  await onboarding.verifyWritingHasStarted();
  await onboarding.continueFromVoice();
  await onboarding.skip();
  await onboarding.skip();
  await onboarding.verifyOnScreen("account", "Create your free account");
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");
  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.verifyArriving("writing");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await launcher.anotherTabCloses();

  await onboarding.verifyCanContinueWithFree();
  await onboarding.continueWithFree();
  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(VIDEO_TITLE);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual([null]);
});
