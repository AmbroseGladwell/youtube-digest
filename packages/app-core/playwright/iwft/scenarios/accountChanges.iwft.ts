import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import {
  SIMULATED_ACCOUNT_ID,
  SIMULATED_EMAIL,
  SIMULATED_LINK_CODE,
  type BackendSimulator,
} from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";

const SERVER = "https://sync.test";
const NEW_EMAIL = "ada.ward@example.org";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: SERVER, token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const UNNAMED = { ...SIGNED_IN, syncConnection: { ...SIGNED_IN.syncConnection, firstName: null } };
const PHONE = { width: 390, height: 844 };

const accountEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.sync.") || name.startsWith("account.revertPage."));

const openAccountTile = async (launcher: Launcher) => {
  const settings = await launcher.appShell.openSettings();
  const tile = await settings.accountTile.verifyIsShown();
  return { settings, tile };
};

test.describe("the name", () => {
  test("is changed in place, saved at once, and shown everywhere this device shows it", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch(SIGNED_IN);
    const { settings, tile } = await openAccountTile(launcher);
    await tile.verifyNameReads("Ada");
    await tile.verifyEmailReads(SIMULATED_EMAIL);
    await settings.syncPanel.verifySyncNowIsPrimary(true);

    await tile.clickChangeName();
    await tile.verifyNameFieldHasFocusAndSelection("Ada");
    await settings.syncPanel.verifySyncNowIsPrimary(false);
    await tile.typeName("Amby");
    await tile.clickSaveName();

    await tile.verifyNameReads("Amby");
    await tile.verifyNameStatusReads(/^Saved\. Your other devices show it the next time they check in\.$/);
    await settings.syncPanel.verifySyncNowIsPrimary(true);
    await settings.verifyRowReads("account", /^Amby ·/);
    expect(backendSimulator.auth.namesSaved()).toEqual(["Amby"]);
    await expect.poll(() => accountEvents(backendSimulator)).toEqual([{ name: "settings.sync.nameSaved", props: { cleared: false } }]);
  });

  test("saved empty, it is removed and the address shows in its place", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch(SIGNED_IN);
    const { settings, tile } = await openAccountTile(launcher);

    await tile.clickChangeName();
    await tile.typeName("");
    await tile.verifyNameHintReads("Saving it empty removes your name. Your email shows in its place.");
    await tile.clickSaveName();

    await tile.verifyNameReads("Not set");
    await tile.verifyChangeNameReads("Add name");
    await settings.verifyRowReads("account", new RegExp(`^${SIMULATED_EMAIL} ·`));
    expect(backendSimulator.auth.namesSaved()).toEqual([null]);
  });

  test("an account with no name offers adding one, and a name too long is refused before it is sent", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(UNNAMED);
    const { tile } = await openAccountTile(launcher);
    await tile.verifyNameReads("Not set");
    await tile.verifyChangeNameReads("Add name");

    await tile.clickChangeName();
    await tile.typeName("A".repeat(81));
    await tile.clickSaveName();

    await tile.verifyNameErrorReads("Use 80 characters or fewer.");
    expect(backendSimulator.auth.namesSaved()).toEqual([]);
    await tile.clickCancelName();
    await tile.verifyNameReads("Not set");
  });
});

test.describe("the email", () => {
  test("asks for a code at the current address first, then the new address, then its code, and keeps this device signed in", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch(SIGNED_IN);
    const { settings, tile } = await openAccountTile(launcher);

    await tile.clickChangeEmail();
    await tile.verifyCodeStepReads("Confirm it’s you");
    await tile.verifyOffersChangingEmail(false);
    await tile.verifyResendIsCountingDown();
    await tile.enterCode("WRONG-ONE");
    await tile.verifyCodeErrorReads("That code doesn’t match. Check it against the latest email, or send a new code.");
    await tile.enterCode(SIMULATED_LINK_CODE);

    await tile.verifyAsksForNewEmail();
    await tile.requestCode(SIMULATED_EMAIL.toUpperCase());
    await tile.verifyNewEmailErrorReads("That’s already your email.");
    await tile.requestCode("not-an-address");
    await tile.verifyNewEmailErrorReads("That doesn’t look like a full email address.");
    await tile.requestCode(NEW_EMAIL);

    await tile.verifyCodeStepReads("Enter the code");
    await tile.verifyResendIsCountingDown();
    await tile.enterCode("NOPE-NOPE");
    await tile.verifyCodeErrorReads("That code doesn’t match. Check it against the latest email, or send a new code.");
    await tile.enterCode(SIMULATED_LINK_CODE);

    await tile.verifyFlowIsClosed();
    await tile.verifyEmailReads(NEW_EMAIL);
    await tile.verifyEmailStatusReads(
      new RegExp(`^Your email is now ${NEW_EMAIL}\\. Use it to sign in from now on\\. We’ve told ${SIMULATED_EMAIL} about the change\\.`),
    );
    await settings.syncPanel.verifyStatusReads(/Synced|Connected|in step/);
    expect(backendSimulator.auth.verificationAsks()).toBe(1);
    expect(backendSimulator.auth.emailChangeAsks()).toEqual([NEW_EMAIL]);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifySignedInAs("Ada", NEW_EMAIL);
    await expect.poll(() => accountEvents(backendSimulator).map(({ name }) => name)).toEqual([
      "settings.sync.verificationAsked",
      "settings.sync.verificationRefused",
      "settings.sync.verificationConfirmed",
      "settings.sync.emailChangeRefused",
      "settings.sync.emailChangeAsked",
      "settings.sync.emailChangeRefused",
      "settings.sync.emailChangeConfirmed",
    ]);
  });

  test("a session signed in within the last fifteen minutes goes straight to the new address", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.sessionIsFresh();
    await launcher.launch(SIGNED_IN);
    const { tile } = await openAccountTile(launcher);

    await tile.clickChangeEmail();

    await tile.verifyAsksForNewEmail();
    await tile.verifyCodeStepIsAbsent();
    await tile.clickCancelNewEmail();
    await tile.verifyFlowIsClosed();
    await tile.verifyOffersChangingEmail(true);
  });

  test("an address taken between the ask and the code leaves only the way out", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.sessionIsFresh();
    backendSimulator.auth.newAddressIsTaken();
    await launcher.launch(SIGNED_IN);
    const { tile } = await openAccountTile(launcher);

    await tile.clickChangeEmail();
    await tile.requestCode(NEW_EMAIL);
    await tile.enterCode(SIMULATED_LINK_CODE);

    await tile.verifyTakenReads(`${NEW_EMAIL} belongs to another account now, so it can’t move to yours. Your email hasn’t changed.`);
    await tile.verifyCodeStepIsAbsent();
    await tile.verifyEmailReads(SIMULATED_EMAIL);
    await tile.clickUseDifferentAddress();
    await tile.verifyAsksForNewEmail();
  });

  test("over the hour's limit, Send code hides and the time to try again is given", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.sessionIsFresh();
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_EMAIL_CHANGE);
    await launcher.launch(SIGNED_IN);
    const { tile } = await openAccountTile(launcher);

    await tile.clickChangeEmail();
    await tile.requestCode(NEW_EMAIL);

    await tile.verifyNewEmailErrorReads(/^You’ve asked for 5 codes in the last hour\. Try again after \d\d:\d\d\.$/);
    await tile.verifySendCodeIsOffered(false);
  });

  test("a code step can send another after the minute, and says so", async ({ launcher, backendSimulator, page }) => {
    await page.clock.install({ time: new Date("2026-09-26T09:00:00.000Z") });
    await launcher.launch(SIGNED_IN);
    const { tile } = await openAccountTile(launcher);

    await tile.clickChangeEmail();
    await tile.verifyCodeStepReads("Confirm it’s you");
    await tile.verifyResendIsCountingDown();
    await page.clock.runFor(61_000);
    await tile.verifyResendIsOffered(true);
    await tile.clickResend();

    await tile.verifyCodeStatusReads(`Sent a new code to ${SIMULATED_EMAIL}.`);
    expect(backendSimulator.auth.verificationAsks()).toBe(2);
  });

  test("a change made on another device shows here once the server is asked who is signed in", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.accountEmailIs(NEW_EMAIL);
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch(SIGNED_IN);

    const { tile } = await openAccountTile(launcher);

    await tile.verifyEmailReads(NEW_EMAIL);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifySignedInAs("Ada", NEW_EMAIL);
  });

  test("on a phone the rows and the code step fit the section's own page", async ({ page, launcher }) => {
    await page.setViewportSize(PHONE);
    await launcher.launch(SIGNED_IN);
    await launcher.openPage(Routes.settingsSection("account"));
    const settings = await launcher.settingsPage.verifyIsShown();
    const tile = await settings.accountTile.verifyIsShown();

    await tile.clickChangeEmail();
    await tile.verifyCodeStepReads("Confirm it’s you");

    await tile.verifyPageDoesNotScrollSideways();
    await tile.verifyFieldFontSizes((sizes) => sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(16)));
    await tile.verifyFieldsIdentifyThemselves();
  });
});

test.describe("moving the account back", () => {
  test("the link from the old address's mail moves it back and offers signing in", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true });
    await launcher.openPage(`${Routes.revertEmail()}#token=revert-token`);

    await launcher.revertEmailPage.verifyIsDone(SIMULATED_EMAIL);
    expect(backendSimulator.auth.revertTokens()).toEqual(["revert-token"]);
    await launcher.revertEmailPage.clickSignIn();
  });

  test("a browser still signed in to that account is signed out before it goes to sign in", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(SIGNED_IN);
    await launcher.openPage(`${Routes.revertEmail()}#token=revert-token`);

    await launcher.revertEmailPage.verifyIsDone(SIMULATED_EMAIL);
    await launcher.revertEmailPage.clickSignIn();

    expect(backendSimulator.getCallCount(EndpointKey.SESSION_DELETE)).toBe(1);
    await expect.poll(() => accountEvents(backendSimulator)).toEqual([{ name: "account.revertPage.used", props: {} }]);
  });

  test("a link that has lapsed, been used, or whose address is taken says which, with no button", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(SIGNED_IN);

    backendSimulator.auth.revertIsRefused({ reason: "expired" });
    await launcher.openPage(`${Routes.revertEmail()}#token=late`);
    await launcher.revertEmailPage.verifyIsRefused("It was valid for seven days after the change, and those seven days have passed.");

    backendSimulator.auth.revertIsRefused({ reason: "taken", email: SIMULATED_EMAIL });
    await launcher.openPage(`${Routes.revertEmail()}#token=taken`);
    await launcher.revertEmailPage.verifyIsRefused(`${SIMULATED_EMAIL} now belongs to another account, so this one can’t move back to it.`);

    await launcher.openPage(Routes.revertEmail());
    await launcher.revertEmailPage.verifyIsRefused("It has already been used, or the account’s email has changed again since.");
    await expect.poll(() => accountEvents(backendSimulator)).toEqual([
      { name: "account.revertPage.refused", props: { reason: "expired" } },
      { name: "account.revertPage.refused", props: { reason: "taken" } },
    ]);
  });
});
