import { DEFAULT_NARRATION_VOICE, ShareToken, shareSnapshot, spokenScript, type Overview, type SharePayload } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview, makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const TOKEN = ShareToken.parse("k7Qm2x9RfTabcdef");
const TITLE = "The Quiet Return of Nuclear Baseload";
const REASON = "Read before the Thursday review.";
const SERVER = "https://sync.test";

const shared = (): Overview =>
  makeOverview({
    savedAt: "2026-09-20T00:00:00.000Z",
    captureReason: REASON,
    tags: ["energy-policy", "nuclear", "grids"],
    watchAnyway: {
      answer: "partial",
      reason: "Worth it for the grid-load animations.",
      range: { startMs: 365_000, endMs: 500_000 },
    },
    source: {
      ...makeOverview().source,
      title: TITLE,
      channel: "Practical Engineering",
      durationMs: 842_000,
      publishedAt: "2026-09-04T00:00:00.000Z",
    },
  });

const signedIn = () => ({
  apiUrl: SERVER,
  token: null,
  accountId: SIMULATED_ACCOUNT_ID,
  email: SIMULATED_EMAIL,
  firstName: "Ada",
});

const sharedPayload = (overview = shared()): SharePayload => ({
  state: "shared",
  token: TOKEN,
  sharedAt: "2026-09-30T11:00:00.000Z",
  snapshot: shareSnapshot({
    overview,
    narration: null,
  }),
});

test("someone without an account reads the shared overview, and is offered one of their own", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));

  const page = await launcher.sharedOverviewPage.verifyIsShown();
  await page.verifyTitleReads(TITLE);
  await page.verifyMetaReads("1 min read · 1 min listen · 14:02 video · published 4 Sept 2026 · shared 30 Sept");
  await page.verifyShowsNoOwnerControls();
  await page.verifyOffersTheWayIn();
});

test("a shared copy's tags are words under a Tags label, with nothing related, since there is no library behind it", async ({
  launcher,
}) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));

  const page = await launcher.sharedOverviewPage.verifyIsShown();
  await page.relatedByTag.verifyHeadingReads("Tags");
  await page.relatedByTag.verifyTagsRead(["#energy-policy", "#nuclear", "#grids"]);
  await page.relatedByTag.verifyNoTagLinks();
  await page.relatedByTag.verifyNoRelated();
});

test("the sharer's own reason is nowhere on the page", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.verifyDoesNotMention(REASON);
});

test("a shared link carries no transcript: its tab offers the visitor their own copy instead", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickTab("Transcript");

  await page.verifyTranscriptOffersOwnCopy("Save to my overviews");
});

test("a link the sharer turned off says so, and says nothing about what was there", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({ state: "revoked" });
  await launcher.openPage(Routes.sharedOverview(TOKEN));

  await launcher.sharedOverviewPage.verifySaysNoLongerShared();
  await launcher.sharedOverviewPage.verifyDoesNotMention(TITLE);
});

test("a document with no copy in it is a link that goes nowhere, not a broken page", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.openPage(Routes.sharedOverview(TOKEN));

  await launcher.sharedOverviewPage.verifySaysLinkGoesNowhere();
});

// A visitor who saves the copy is onboarded around it: the questions, then the account and
// the plan, and the copy is their first overview (docs/features/onboarding.md, "From a shared page").
test("saving starts onboarding around the copy, which is the reveal once the account is made", async ({ launcher, backendSimulator }) => {
  const overview = shared();
  await launcher.launch({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload(overview));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickSave();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("topics", "What are you curious about?");
  await onboarding.pickTopics("Food");
  await onboarding.continueFromTopics();
  await onboarding.verifyOnScreen("library");
  await onboarding.skip();
  await onboarding.verifyOnScreen("aboutYou");
  await onboarding.skip();
  await onboarding.verifyOnScreen("stepsForYou");
  await onboarding.skip();
  await onboarding.verifyOnScreen("voice");
  await onboarding.skip();
  await onboarding.verifyOnScreen("askYourAi");
  await onboarding.skip();
  await onboarding.verifyOnScreen("moreSources");
  await onboarding.skip();

  await onboarding.verifyOnScreen("account", "Create your free account");
  await onboarding.verifyTeaser({ title: TITLE, premise: overview.inOneLine });
  await onboarding.verifyPageHasNoText("Worth it for the grid-load animations.");
  const createAccount = await onboarding.continueWithEmail();
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await createAccount.chooseCodeFromEmail();
  await createAccount.enterCode("ABCD-EFGH");

  await onboarding.verifyOnScreen("plan", "Choose your plan");
  await onboarding.continueWithFree();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(TITLE);
  // The copy is now this reader's own overview, and carries none of the sharer's reason.
  await reader.verifyHasNoReason();
  expect(backendSimulator.ourKey.generations()).toEqual([]);
  expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: overview.id, shareToken: TOKEN }]);
});

test("a visitor with an account can leave the questions, sign in, and land on the copy with no plan to pick", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = shared();
  await launcher.launch({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload(overview));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();
  await page.clickSave();

  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyCanSeeOverview();
  await onboarding.seeOverview();
  const signIn = await onboarding.signIn();
  await signIn.requestLink(SIMULATED_EMAIL);
  await signIn.chooseCodeFromEmail();
  await signIn.enterCode("ABCD-EFGH");

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(TITLE);
  expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: overview.id, shareToken: TOKEN }]);
});

test("a link pasted beside the copy starts onboarding with it, and one it can't use is refused in place", async ({ launcher }) => {
  await launcher.launch({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.pasteLinkAndMakeOverview("https://www.youtube.com/playlist?list=WL");
  await page.verifyRefusesLink();

  await page.pasteLinkAndMakeOverview(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  const onboarding = await launcher.onboardingPage.verifyIsShown();
  await onboarding.verifyOnScreen("video", "Is this the right video?");
});

// A reader who is already signed in has a library behind them, so the page offers the way
// back to it rather than the way to an account (docs/features/sharing.md, "A reader who is
// signed in").
test("a reader who is signed in is recognised: the head leads to their overviews, and nothing offers them an account", async ({
  launcher,
}) => {
  await launcher.launch({ sync: true, syncConnection: signedIn(), defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.verifyRecognisesTheReader();
  await page.clickYourOverviewsInHeader();

  await launcher.homePage.verifyIsShown();
});

test("signed in, saving puts the copy among their overviews at once, with no questions asked", async ({ launcher, backendSimulator }) => {
  const overview = shared();
  await launcher.launch({ sync: true, syncConnection: signedIn(), defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload(overview));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();
  await page.verifySaveActionReads("Save to my overviews");

  await page.clickSave();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(TITLE);
  await reader.verifyHasNoReason();
  expect(backendSimulator.ourKey.generations()).toEqual([]);
  expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: overview.id, shareToken: TOKEN }]);
  await expect
    .poll(() => backendSimulator.analytics.sharedPage.events().map(({ name }) => name))
    .toEqual(["sharedPage.page.opened", "sharedPage.actions.saveChosen"]);
});

test("a shared overview the account already holds opens from the page rather than being saved again", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = shared();
  await launcher.launch({ sync: true, syncConnection: signedIn(), defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload(overview));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await (await launcher.sharedOverviewPage.verifyIsShown()).clickSave();
  await launcher.readerPage.verifyIsShown();

  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();
  await page.verifySaveActionReads("Open in my overviews");
  await page.clickSave();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(TITLE);
  expect(backendSimulator.ourKey.reservations()).toEqual([{ overviewId: overview.id, shareToken: TOKEN }]);
});

test("making an overview from the page's head goes to Start", async ({ launcher }) => {
  await launcher.launch({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickMakeAnOverviewInHeader();

  await launcher.homePage.verifyShowsStart();
});

// The page is the reader's layout, so the chrome that holds it together has to behave the
// same way: the strip belongs to its text, and the head does not let the note past it.
test("the tab strip lines up with the note, and the head stays above it", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.verifyTabsAlignWithTheNote();
  await page.verifyHeaderStaysAboveTheTabs();
});

// Nothing on this page can move a video, so the stretch worth watching is a link to it
// rather than a skip (docs/features/following-playback.md).
test("the stretch worth watching offers a way into the video at that moment", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.openLineTime("6:05–8:20");
  await page.verifyOffersToWatchFrom("Watch from 6:05", "https://www.youtube.com/watch?v=example&t=365");
});

test("what a visitor with no account does is counted against the share, under a view id made for the visit", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickTab("Transcript");

  await expect
    .poll(() => backendSimulator.analytics.sharedPage.events())
    .toEqual([
      { name: "sharedPage.page.opened", props: { stopped: false } },
      { name: "sharedPage.tabs.switched", props: { tab: "transcript" } },
    ]);
  const { token, batch } = backendSimulator.analytics.sharedPage.batches()[0]!;
  expect(token).toBe(TOKEN);
  expect(batch.viewId).toMatch(/^[0-9a-f-]{36}$/);
  expect(backendSimulator.analytics.events()).toEqual([]);
});

test("a stopped link's visit is counted as one, and so is the visitor making their own", async ({ launcher, backendSimulator }) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({ state: "revoked" });
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifySaysNoLongerShared();

  await launcher.sharedOverviewPage.clickMakeYourOwnFromGone();

  await expect
    .poll(() => backendSimulator.analytics.sharedPage.events())
    .toEqual([
      { name: "sharedPage.page.opened", props: { stopped: true } },
      { name: "sharedPage.gone.makeChosen", props: {} },
    ]);
});

const sharedRecipe = async (launcher: Launcher, overview: ReturnType<typeof makeRecipeOverview>) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({
    state: "shared",
    token: TOKEN,
    sharedAt: "2026-11-03T11:00:00.000Z",
    snapshot: shareSnapshot({ overview, narration: null }),
  });
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();
};

test("a shared recipe carries the whole method, opens as written, and can be cooked step by step", async ({
  launcher,
  page,
  backendSimulator,
}) => {
  await sharedRecipe(launcher, makeRecipeOverview());

  await expect(page.getByText("An overview of a recipe from Example Kitchen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingredients · 8" })).toBeVisible();
  await expect(page.getByTestId("RecipeIngredients.units.asWritten")).toBeChecked();
  await expect(page.getByRole("heading", { name: "Method · 4 steps" })).toBeVisible();
  await expect(page.getByTestId("RecipeMethod.step")).toHaveCount(4);
  await expect(page.getByTestId("RecipeMethod.onThePage")).toHaveCount(0);

  await expect(page.getByTestId("RecipeCookButton.root")).toHaveText("Cook step by step");
  await page.getByTestId("RecipeMethod.cook").click();
  await expect(page.getByTestId("CookingMode.root")).toBeVisible();
  await expect(page.getByTestId("CookingMode.place")).toHaveText(/^Step 1/);
  await page.getByTestId("CookingMode.forward").click();
  await expect(page.getByTestId("CookingMode.back")).toBeEnabled();
  await page.getByTestId("CookingMode.done").click();
  await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  await expect(page.getByTestId("RecipeMethod.carryOn")).toBeVisible();

  await expect
    .poll(() => backendSimulator.analytics.sharedPage.events().map(({ name }) => name))
    .toEqual(expect.arrayContaining(["sharedPage.cooking.started", "sharedPage.cooking.left"]));
});

const sharedRecipeNarrated = (overview: ReturnType<typeof makeRecipeOverview>): SharePayload => {
  const lines = spokenScript(overview);
  return {
    state: "shared",
    token: TOKEN,
    sharedAt: "2026-11-03T11:00:00.000Z",
    snapshot: shareSnapshot({
      overview,
      narration: {
        key: "a".repeat(64),
        voice: DEFAULT_NARRATION_VOICE,
        durationSeconds: lines.length * 2,
        lineStartsSeconds: lines.map((_, index) => index * 2),
      },
    }),
  };
};

test("a visitor adjusts a shared recipe as on their own copy, and is told an account reads it aloud adjusted", async ({
  launcher,
  page,
}) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedRecipeNarrated(makeRecipeOverview()));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();

  await expect(page.getByTestId("ReaderPlayerBar.pacerTag")).toBeHidden();
  await expect(page.getByTestId("SharedOverviewPage.adjustedVoice")).toHaveCount(0);

  for (let step = 0; step < 4; step += 1) {
    await page.getByTestId("RecipeIngredients.more").click();
  }
  await page.getByTestId("RecipeIngredients.units.us").check();
  await expect(page.getByTestId("RecipeIngredients.servings")).toHaveText("8 servings");
  await expect(page.getByTestId("RecipeIngredients.line").nth(3)).toHaveText("4¼ cups vegetable stock");
  await expect(page.getByTestId("RecipeMethod.step").first()).toContainText("Heat the oven to 425°F (400°F fan)");
  await expect(page.getByTestId("SharedOverviewPage.adjustedVoice")).toHaveText(
    "Read aloud plays the recipe as it was shared. To hear it read aloud as adjusted, create an account.",
  );
  await expect(page.getByTestId("ReaderPlayerBar.pacerTag")).toBeVisible();

  await page.getByTestId("RecipeIngredients.backToWritten").click();
  await expect(page.getByTestId("RecipeIngredients.servings")).toHaveText("4 servings");
  await expect(page.getByTestId("SharedOverviewPage.adjustedVoice")).toHaveCount(0);
  await expect(page.getByTestId("ReaderPlayerBar.pacerTag")).toBeHidden();

  await page.getByTestId("RecipeIngredients.more").click();
  await page.getByTestId("SharedOverviewPage.adjustedVoiceAccount").click();
  await launcher.onboardingPage.verifyIsShown();
});

test("signed in, an adjusted shared recipe is narrated afresh on the visitor's own account", async ({
  launcher,
  page,
  backendSimulator,
}) => {
  await launcher.launch({ sync: true, syncConnection: signedIn(), defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedRecipeNarrated(makeRecipeOverview()));
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();

  await page.getByTestId("RecipeIngredients.more").click();
  await expect(page.getByTestId("RecipeIngredients.servings")).toHaveText("5 servings");
  await expect(page.getByTestId("SharedOverviewPage.adjustedVoice")).toHaveCount(0);
  await page.getByTestId("ReaderPlayerBar.playButton").click();
  await expect.poll(() => backendSimulator.narration.requestCount()).toBeGreaterThan(0);
});

test("a recipe shared before the method travelled with it sends the visitor to the page, with nothing to cook", async ({
  launcher,
  page,
}) => {
  const base = makeRecipeOverview();
  await sharedRecipe(launcher, makeRecipeOverview({ recipe: { ...base.recipe!, steps: [] } }));

  await expect(page.getByRole("heading", { name: "Method · 4 steps" })).toBeVisible();
  await expect(page.getByText("The method is in Maya Okafor’s own words, so it stays on Example Kitchen.")).toBeVisible();
  await expect(page.getByTestId("RecipeMethod.onThePage")).toHaveAttribute(
    "href",
    "https://examplekitchen.example/recipes/charred-leek-white-bean-stew",
  );
  await expect(page.getByTestId("RecipeMethod.step")).toHaveCount(0);
  await expect(page.getByTestId("RecipeMethod.cook")).toHaveCount(0);
});
