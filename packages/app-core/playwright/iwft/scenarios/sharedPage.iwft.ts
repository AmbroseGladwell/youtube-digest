import { ShareToken, shareSnapshot, type Overview, type SharePayload } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

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
    video: {
      ...makeOverview().video,
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
    transcript: makeStoredTranscript({ videoId: overview.video.id! }),
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

// Design 30l: the account is asked for, and confirming it finishes what was started.
test("saving names the overview on the way to an account, and lands on it once confirmed", async ({
  launcher,
}) => {
  await launcher.launchExpectingFirstRun({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(sharedPayload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  const page = await launcher.sharedOverviewPage.verifyIsShown();

  await page.clickSave();

  const createAccount = await launcher.signInPage.verifyAsksForEmail("Create your account");
  await createAccount.verifyIsSavingFromShare(TITLE);
  await createAccount.typeFirstName("Ada");
  await createAccount.requestLink(SIMULATED_EMAIL);
  await launcher.openSignInLink("a-magic-token");

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle(TITLE);
  // The copy is now this reader's own overview, and carries none of the sharer's reason.
  await reader.verifyHasNoReason();
});

test("creating an account any other way promises nothing about a share", async ({ launcher }) => {
  await launcher.launchExpectingFirstRun({ sync: true, defaultApiUrl: SERVER });

  await launcher.openPage(Routes.createAccount());

  const createAccount = await launcher.signInPage.verifyAsksForEmail("Create your account");
  await createAccount.verifyPromisesNothingFromAShare();
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
