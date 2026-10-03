import type { OutboxEntry } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const SIGNED_OUT_HERE = { signedOutHere: true };

const signedInAs = (accountId: string) => ({
  apiUrl: "https://sync.test",
  token: null,
  accountId,
  email: SIMULATED_EMAIL,
  firstName: "Ada",
});

const titled = (title: string) => makeOverview({ video: { ...makeOverview().video, title } });

const readMark = (key: number, overviewId: string): OutboxEntry => ({
  key,
  kind: "overviewState",
  id: overviewId,
  updatedAt: "2026-10-03T08:00:00.000Z",
  change: { op: "state", patch: { read: true } },
  stuck: null,
});

// Each account's library is its own, and stays on the device when it signs out
// (docs/features/account-libraries.md).
test.describe("each account's library", () => {
  test("signing out leaves the account's overviews behind, and signing back in brings them back", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(titled("Kept In The Account"));
    const library = await launcher.launchExpectingLibrary({ sync: true, syncConnection: signedInAs(SIMULATED_ACCOUNT_ID) });
    await library.expectCardCountToBe(1);

    const menu = await launcher.appShell.accountMenu.open();
    await menu.chooseSignOut();
    await launcher.signedOutLibrary.verifyIsShown();

    await launcher.openSignInLink("the-token-from-the-email");
    const signedInAgain = await launcher.homePage.verifyShowsLibrary();
    await signedInAgain.expectCardCountToBe(1);
  });

  test("a second account signing in on this device never sees the first account's overviews", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(titled("The First Account's"));
    backendSimulator.auth.accountIsNamed("Bea");
    const library = await launcher.launchExpectingLibrary({ sync: true, syncConnection: signedInAs("the-first-account") });
    await library.expectCardCountToBe(1);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.chooseSignOut();
    await launcher.signedOutLibrary.verifyIsShown();

    await launcher.openSignInLink("the-token-from-the-email");

    await launcher.homePage.verifyShowsFirstRunHero();
    await launcher.appShell.accountMenu.open();
    await menu.verifySignedInAs("Bea", SIMULATED_EMAIL);
  });

  test("signing in never syncs the library being left", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Made Before Signing In"));
    await launcher.launchExpectingLibrary({ sync: true });

    await launcher.openSignInLink("the-token-from-the-email");

    await launcher.homePage.verifyShowsFirstRunHero();
    test.expect(await backendSimulator.sync.enrolled(SIMULATED_ACCOUNT_ID)).toBe(true);
    test.expect(await backendSimulator.sync.enrolled(null)).toBe(false);
  });
});

test.describe("signed out after having an account", () => {
  // Design 47a.
  test("the library says it is signed out, and that what it holds is in this browser", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(titled("Made Since Signing Out"));
    const library = await launcher.launchExpectingLibrary({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });

    await launcher.accountStrip.verifySaysSignedOut();
    await library.verifyCountReads("1 overview in this browser · 1 unread");
    await launcher.appShell.accountMenu.verifyTriggerLabel("Account, signed out");
  });

  test("the strip's Sign in goes to signing in", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Made Since Signing Out"));
    await launcher.launchExpectingLibrary({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });

    await launcher.accountStrip.chooseAction();

    await launcher.signInPage.verifyAsksForEmail("Sign in");
  });

  // Design 47b: not a route, the library at / when it is empty.
  test("an empty library says the account's overviews are safe, and still takes a link", async ({ launcher }) => {
    await launcher.launch({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE, apiKeys: API_KEYS });

    await launcher.signedOutLibrary.verifyIsShown();
    await launcher.signedOutLibrary.verifyOffersAVideo(true);
    await launcher.accountStrip.verifyIsAbsent();
  });

  test("without keys the empty library offers no link it couldn't use", async ({ launcher }) => {
    await launcher.launch({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });

    await launcher.signedOutLibrary.verifyIsShown();
    await launcher.signedOutLibrary.verifyOffersAVideo(false);
  });

  // Design 47g.
  test("Settings says where the overviews are saved and offers both ways in", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("One"));
    backendSimulator.overviews.seed(titled("Two"));
    await launcher.launch({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });
    const settings = await launcher.appShell.openSettings();

    await settings.verifyRowReads("account", "Signed out · saved in this browser");
    await settings.openSection("account");
    await settings.syncPanel.verifyHintReads(
      /^2 Overviews are only saved in this browser\. Sign in or create an account to sync them/,
    );
  });

  test("the panel carries the strip above its offer", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Made Since Signing Out"));
    await launcher.launchPanel({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });

    await launcher.accountStrip.verifySaysSignedOut();
  });
});

// Design 47c: a reader who never had an account is offered one, and can turn it down.
test.describe("never signed in", () => {
  test("the library offers an account, and turning it down keeps it gone", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seed(titled("Mine"));
    const library = await launcher.launchExpectingLibrary({ sync: true });
    await launcher.accountStrip.verifyOffersAnAccount();
    await library.verifyCountReads("1 overview · 1 unread");

    await launcher.accountStrip.dismiss();

    await launcher.accountStrip.verifyIsAbsent();
    test
      .expect(await page.evaluate(() => localStorage.getItem("overview.deviceAccountHistory.v1")))
      .toContain('"offerDismissed":true');
  });

  test("a shell that cannot sync offers no account", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Mine"));
    await launcher.launchExpectingLibrary();

    await launcher.accountStrip.verifyIsAbsent();
  });
});

// Designs 47d: sign-out syncs first, never blocks, and says afterwards what it couldn't send.
test.describe("signing out", () => {
  test("says it is syncing first, in place, with the menu still open", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointStalled(EndpointKey.SYNC_HANDSHAKE);
    await launcher.launch({ sync: true, syncConnection: signedInAs(SIMULATED_ACCOUNT_ID) });
    const menu = await launcher.appShell.accountMenu.open();

    await menu.chooseSignOut();

    await menu.verifySigningOut();
  });

  test("with nothing waiting, there is nothing to say", async ({ launcher }) => {
    await launcher.launch({ sync: true, syncConnection: signedInAs(SIMULATED_ACCOUNT_ID) });
    const menu = await launcher.appShell.accountMenu.open();

    await menu.chooseSignOut();

    await launcher.signedOutLibrary.verifyIsShown();
    await launcher.signOutNotice.verifyIsAbsent();
  });

  test("offline, it goes anyway and says what will sync on the next sign-in here", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const overview = titled("Read Offline");
    backendSimulator.overviews.seed(overview);
    await page.route("**/api/overviews/**", (route) => route.abort("internetdisconnected"));
    await launcher.launchExpectingLibrary({ sync: true, syncConnection: signedInAs(SIMULATED_ACCOUNT_ID) });
    await backendSimulator.sync.queueLocalWrites([readMark(1, overview.id)]);
    const menu = await launcher.appShell.accountMenu.open();

    await menu.chooseSignOut();

    await launcher.signOutNotice.verifyLeadReads("Signed out while offline. 1 change hasn’t synced to your account yet.");
    await launcher.signOutNotice.dismiss();
    await launcher.signOutNotice.verifyIsAbsent();
  });
});

// Design 47f: after a sign-in, until the account's first cycle is done.
test("signing in opens the account's library behind its skeleton", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.SYNC_CHANGES);
  await launcher.launch({ sync: true, deviceAccountHistory: SIGNED_OUT_HERE });

  await launcher.openSignInLink("the-token-from-the-email");

  await launcher.openingLibrary.verifyIsShown();
});
