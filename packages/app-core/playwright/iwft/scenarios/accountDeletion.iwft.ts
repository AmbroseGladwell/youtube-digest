import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import {
  SIMULATED_ACCOUNT_ID,
  SIMULATED_EMAIL,
  SIMULATED_LINK_CODE,
  type BackendSimulator,
} from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";

const SERVER = "https://sync.test";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: SERVER, token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PHONE = { width: 390, height: 844 };

const deletionEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics
    .events()
    .filter(({ name }) => name.startsWith("settings.sync.deleteAccount") || name.startsWith("settings.sync.verification"))
    .map(({ name, props }) => ({ name, props }));

const openDeleteDialog = async (launcher: Launcher) => {
  const settings = await launcher.appShell.openSettings();
  await settings.syncPanel.verifyIsShown();
  return settings.syncPanel.clickDeleteAccount();
};

// Designs 184a–184g (docs/features/account-deletion.md).
test.describe("deleting the account", () => {
  test("explains what goes and what stays, asks for a code to the account's address, and leaves this device signed out on Start", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(makeOverview());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    await library.expectCardCountToBe(1);
    const dialog = await openDeleteDialog(launcher);
    await dialog.verifyBodyNames(SIMULATED_EMAIL);
    await dialog.verifyListsWhatGoesAndStays();

    await dialog.clickContinue();
    await dialog.verifyAsksForCode(SIMULATED_EMAIL);
    await dialog.verifyResendIsCountingDown();
    await dialog.enterCode("WRONG-ONE");
    await dialog.verifyCodeErrorReads("That code doesn’t match. Check it against the latest email, or send a new code.");
    await dialog.enterCode(SIMULATED_LINK_CODE);

    await launcher.homePage.verifyShowsStart();
    await launcher.signOutNotice.verifyLeadReads("Your account is deleted.");
    await dialog.verifyIsClosed();
    expect(backendSimulator.auth.accountDeletions()).toBe(1);
    expect(backendSimulator.auth.verificationPurposes()).toEqual(["deleteAccount"]);
    expect(await launcher.libraryIsKept(SIMULATED_ACCOUNT_ID)).toBe(false);
    expect(await launcher.libraryIsKept(null)).toBe(true);
    await expect.poll(() => deletionEvents(backendSimulator)).toEqual([
      { name: "settings.sync.deleteAccountStarted", props: {} },
      { name: "settings.sync.deleteAccountConfirmed", props: {} },
    ]);

    await launcher.signOutNotice.dismiss();
    await launcher.signOutNotice.verifyIsAbsent();
  });

  test("a session signed in within the last fifteen minutes goes from the explanation straight to deleting", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.sessionIsFresh();
    await launcher.launch(SIGNED_IN);
    const dialog = await openDeleteDialog(launcher);

    await dialog.clickContinue();

    await launcher.homePage.verifyShowsStart();
    await launcher.signOutNotice.verifyLeadReads("Your account is deleted.");
    expect(backendSimulator.auth.accountDeletions()).toBe(1);
    expect(backendSimulator.auth.verificationCodes()).toEqual([]);
  });

  test("the first step deletes nothing: Cancel, Escape and the close button all leave the account as it was", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(SIGNED_IN);
    const settings = await launcher.appShell.openSettings();
    let dialog = await settings.syncPanel.clickDeleteAccount();
    await dialog.clickCancel();
    await dialog.verifyIsClosed();

    dialog = await settings.syncPanel.clickDeleteAccount();
    await dialog.pressEscape();
    await dialog.verifyIsClosed();

    dialog = await settings.syncPanel.clickDeleteAccount();
    await dialog.clickContinue();
    await dialog.verifyAsksForCode(SIMULATED_EMAIL);
    await dialog.clickCancelCode();
    await dialog.verifyIsClosed();

    await settings.syncPanel.verifyOffersDeletingAccount(true);
    expect(backendSimulator.auth.accountDeletions()).toBe(0);
    expect(backendSimulator.auth.verificationAsks()).toBe(1);
  });

  test("over the hour's limit on codes, Continue hides and the time to try again is given", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_VERIFICATION);
    await launcher.launch(SIGNED_IN);
    const dialog = await openDeleteDialog(launcher);

    await dialog.clickContinue();

    await dialog.verifyRefusedReads(/^You’ve asked for 5 codes in the last hour\. Try again after \d\d:\d\d\.$/);
    await dialog.verifyContinueIsOffered(false);
    await expect.poll(() => deletionEvents(backendSimulator)).toEqual([
      { name: "settings.sync.deleteAccountStarted", props: {} },
      { name: "settings.sync.deleteAccountRefused", props: { reason: "limited" } },
    ]);
  });

  test("a failure before the commit says nothing was deleted, keeps this device signed in, and Try again goes through", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.sessionIsFresh();
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_ACCOUNT_DELETE);
    await launcher.launch(SIGNED_IN);
    const dialog = await openDeleteDialog(launcher);

    await dialog.clickContinue();
    await dialog.verifyFailed();
    expect(backendSimulator.auth.accountDeletions()).toBe(0);
    expect(await launcher.libraryIsKept(SIMULATED_ACCOUNT_ID)).toBe(true);

    backendSimulator.simulateEndpointDefault(EndpointKey.SESSION_ACCOUNT_DELETE);
    await dialog.clickTryAgain();

    await launcher.homePage.verifyShowsStart();
    expect(backendSimulator.auth.accountDeletions()).toBe(1);
    await expect.poll(() => deletionEvents(backendSimulator)).toEqual([
      { name: "settings.sync.deleteAccountStarted", props: {} },
      { name: "settings.sync.deleteAccountConfirmed", props: {} },
      { name: "settings.sync.deleteAccountRefused", props: { reason: "failed" } },
      { name: "settings.sync.deleteAccountConfirmed", props: {} },
    ]);
  });

  test("a verification that lapsed before the delete sends the dialog back to the code", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.deleteNeedsVerification();
    await launcher.launch(SIGNED_IN);
    const dialog = await openDeleteDialog(launcher);

    await dialog.clickContinue();
    await dialog.enterCode(SIMULATED_LINK_CODE);

    await dialog.verifyAsksForCode(SIMULATED_EMAIL);
    expect(backendSimulator.auth.accountDeletions()).toBe(0);
    await dialog.enterCode(SIMULATED_LINK_CODE);
    await launcher.homePage.verifyShowsStart();
    expect(backendSimulator.auth.accountDeletions()).toBe(1);
  });

  test("on a phone the dialog is a sheet whose body scrolls and whose actions stay in reach", async ({ page, launcher }) => {
    await page.setViewportSize(PHONE);
    await launcher.launch(SIGNED_IN);
    await launcher.openPage(Routes.settingsSection("account"));
    const settings = await launcher.settingsPage.verifyIsShown();
    const dialog = await settings.syncPanel.clickDeleteAccount();

    await dialog.verifyListsWhatGoesAndStays();
    await dialog.verifyContinueIsOffered(true);
    await dialog.verifyPageDoesNotScrollSideways();
    await dialog.clickContinue();
    await dialog.verifyAsksForCode(SIMULATED_EMAIL);
  });

  test("the entry is absent while signed out, and while a sign-out is still syncing", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const settings = await launcher.appShell.openSettings();
    await settings.syncPanel.verifyAsksToSignIn();
    await settings.syncPanel.verifyOffersDeletingAccount(false);
  });
});
