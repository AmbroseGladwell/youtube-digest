import { ShareToken, shareSnapshot, type Overview, type SharePayload } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
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

const sharedPayload = (overview = shared()): SharePayload => ({
  state: "shared",
  token: TOKEN,
  sharedAt: "2026-09-30T11:00:00.000Z",
  snapshot: shareSnapshot({
    overview,
    transcript: makeStoredTranscript({ videoId: overview.source.id! }),
    narration: null,
  }),
});

test("someone without an account reads the shared overview, and is offered one of their own", async ({
  launcher,
}) => {
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

test("the transcript that travelled with the copy reads without a store to hold it", async ({
  launcher,
}) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickTab("Transcript");

  await page.verifyTranscriptReads("Here is the one claim this video makes.");
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
test("saving starts onboarding around the copy, which is the reveal once the account is made", async ({
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

test("a link pasted beside the copy starts onboarding with it, and one it can't use is refused in place", async ({
  launcher,
}) => {
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

test("a stopped link's visit is counted as one, and so is the visitor making their own", async ({
  launcher,
  backendSimulator,
}) => {
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

const sharedRecipe = async (
  launcher: Launcher,
  overview: ReturnType<typeof makeRecipeOverview>,
) => {
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({
    state: "shared",
    token: TOKEN,
    sharedAt: "2026-11-03T11:00:00.000Z",
    snapshot: shareSnapshot({ overview, transcript: null, narration: null }),
  });
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();
};

test("a shared recipe carries the whole method, and can be cooked step by step", async ({ launcher, page, backendSimulator }) => {
  await sharedRecipe(launcher, makeRecipeOverview());

  await expect(page.getByText("An overview of a recipe from Example Kitchen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingredients · 8" })).toBeVisible();
  await expect(page.getByTestId("RecipeIngredients.units.asWritten")).toHaveCount(0);
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

test("a recipe shared before the method travelled with it sends the visitor to the page, with nothing to cook", async ({ launcher, page }) => {
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
