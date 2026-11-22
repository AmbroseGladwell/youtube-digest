import type { Overview } from "@overview/domain";
import { makeStoredTranscript } from "@overview/store-conformance";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL, firstName: "Ada" },
};

const TITLE = "The Quiet Return of Nuclear Baseload";

const titled = (title = TITLE, overrides: Partial<Overview> = {}): Overview =>
  makeOverview({
    savedAt: "2026-09-20T00:00:00.000Z",
    source: { ...makeOverview().source, title },
    captureReason: "Read before the Thursday review.",
    ...overrides,
  });

test("a reader makes a link, copies it, and stops sharing", async ({ launcher, backendSimulator, page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickShare();
  await dialog.verifyHeadingReads("Share overview");
  await dialog.verifyListsWhatIsShared("Transcript and chapters");
  await dialog.verifyListsWhatStaysPrivate("Your reason");

  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");

  const [live] = backendSimulator.shares.live();
  await dialog.verifyLinkReads(live!.url);

  await dialog.clickCopyLink();
  await dialog.verifyCopyButtonReads("Copied");
  test.expect(await dialog.readClipboard()).toBe(live!.url);

  await dialog.clickStopSharing();
  await dialog.verifyHeadingReads("Stop sharing?");
  await dialog.clickConfirmStopSharing();

  await dialog.verifyListsWhatIsShared("Transcript and chapters");
  test.expect(backendSimulator.shares.live()).toEqual([]);
});

test("the menu offers sharing only where there is an account to share under", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  await reader.verifyMenuHasNoShare();
});

test("the menu's copy item says which link it copies", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.verifyCopyLinkItemReads("Copy YouTube link");
});

test("a copy made from an earlier note says so, and offers to replace it behind the same link", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");
  await dialog.verifyDoesNotSayItWasEdited();
  const [made] = backendSimulator.shares.live();
  await dialog.clickDone();

  backendSimulator.shares.simulateCopyIsStale();

  const again = await reader.clickShare();
  await again.verifySaysItWasEdited();
  await again.clickUpdateSharedCopy();

  await again.verifyDoesNotSayItWasEdited();
  await again.verifyLinkReads(made!.url);
});

test("audio rendered after sharing is offered to the copy, and added behind the same link", async ({ launcher, backendSimulator }) => {
  const overview = titled();
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");
  await dialog.verifyDoesNotSayAudioIsMissing();
  const [made] = backendSimulator.shares.live();
  test.expect(backendSimulator.shares.snapshot(made!.token)?.narration).toBeNull();
  await dialog.clickDone();

  backendSimulator.narration.seedReady(overview);

  const again = await reader.clickShare();
  await again.verifySaysAudioIsMissing();
  await again.verifyDoesNotSayItWasEdited();
  await again.clickAddAudio();

  await again.verifyDoesNotSayAudioIsMissing();
  await again.verifyLinkReads(made!.url);
  test.expect(backendSimulator.shares.snapshot(made!.token)?.narration).not.toBeNull();
});

test("editing the reason is not an edit to the shared copy", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");
  await dialog.clickDone();

  await reader.editReason();
  await reader.fillReason("A different reason entirely.");
  await reader.clickSaveReason();

  const again = await reader.clickShare();
  await again.verifyDoesNotSayItWasEdited();
});

test("a share the server refuses says so, and nothing is claimed to have been shared", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  backendSimulator.simulateEndpointError(EndpointKey.SHARE_CREATE);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();

  await dialog.verifyFailureIsShown();
  await dialog.verifyListsWhatIsShared("Transcript and chapters");
  test.expect(backendSimulator.shares.live()).toEqual([]);
});

test("Settings lists what is shared, and stopping from there asks inline", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();
  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");
  await dialog.clickDone();

  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("shared", "1 shared");
  await settings.openSection("shared");
  const panel = await settings.sharedLinks.verifyIsShown();

  await panel.verifyRowTitles([TITLE]);
  await panel.clickStopSharing();
  await panel.verifyAsksBeforeStopping();
  await panel.clickKeepSharing();
  await panel.expectRowCountToBe(1);

  await panel.clickStopSharing();
  await panel.clickConfirmStopSharing();

  await panel.verifySaysNothingIsShared();
  test.expect(backendSimulator.shares.live()).toEqual([]);
});

test("Settings says plainly when nothing is shared", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  await launcher.launchExpectingLibrary(SIGNED_IN);
  const settings = await launcher.appShell.openSettings();

  await settings.openSection("shared");
  const panel = await settings.sharedLinks.verifyIsShown();

  await panel.verifySaysNothingIsShared();
});

test("a transcript the reader holds never travels with the copy", async ({ launcher, backendSimulator }) => {
  const overview = titled();
  backendSimulator.overviews.seed(overview);
  backendSimulator.sync.seedTranscript(makeStoredTranscript({ videoId: overview.source.id! }));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");

  const [made] = backendSimulator.shares.live();
  test.expect(backendSimulator.shares.snapshot(made!.token)?.transcript ?? null).toBeNull();
});

test("an overview whose transcript nobody holds is shared without one, rather than refused", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickShare();
  await dialog.clickCreateLink();
  await dialog.verifyStatusReads("0 views");

  const [made] = backendSimulator.shares.live();
  test.expect(backendSimulator.shares.snapshot(made!.token)?.transcript).toBeNull();
});
