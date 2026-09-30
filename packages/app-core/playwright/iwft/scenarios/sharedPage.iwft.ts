import { ShareToken, shareSnapshot, type Overview, type SharePayload } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { test } from "../../support/fixtures.testHelper.js";
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
