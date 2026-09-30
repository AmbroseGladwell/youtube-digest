import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SERVER = "https://sync.test";
const SIGNED_IN_BY_COOKIE = { apiUrl: SERVER, token: null, email: SIMULATED_EMAIL, firstName: "Ada" };
const PHONE = { width: 390, height: 844 };
const waitingForCode = () => ({
  apiUrl: SERVER,
  email: SIMULATED_EMAIL,
  intent: "signIn" as const,
  firstName: null,
  sentAt: Date.now(),
});

test.describe("the account menu", () => {
  test("signed out, it offers signing in, creating an account and Settings", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    const menu = await launcher.appShell.accountMenu.open();

    await menu.verifyItemsRead(["Sign in", "Create account", "Settings"]);
  });

  test("opens from the keyboard onto its first item, moves with the arrows, and closes back to its button", async ({
    launcher,
  }) => {
    await launcher.launch({ sync: true });

    const menu = await launcher.appShell.accountMenu.openFromKeyboard();
    await menu.verifyFocusedItemReads("Sign in");
    await menu.pressKey("ArrowDown");
    await menu.verifyFocusedItemReads("Create account");
    await menu.pressKey("ArrowUp");
    await menu.pressKey("ArrowUp");
    await menu.verifyFocusedItemReads("Settings");
    await menu.pressKey("Escape");

    await menu.verifyIsClosedWithFocusOnTrigger();
  });

  test("signed in, it says who by name and offers connecting the extension, Settings and signing out", async ({
    launcher,
  }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });

    const menu = await launcher.appShell.accountMenu.open();

    await menu.verifySignedInAs("Ada", SIMULATED_EMAIL);
    await menu.verifyItemsRead(["Connect the extension", "Settings", "Sign out"]);
    await menu.verifySyncStatusShown(false);
  });

  test("an account with no name is shown by its address alone", async ({ launcher }) => {
    await launcher.launch({ sync: true, syncConnection: { ...SIGNED_IN_BY_COOKIE, firstName: null } });

    const menu = await launcher.appShell.accountMenu.open();

    await menu.verifySignedInAs(null, SIMULATED_EMAIL);
  });

  test("signing out from it ends the session and offers signing in again", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });
    const menu = await launcher.appShell.accountMenu.open();

    await menu.chooseSignOut();

    await launcher.appShell.accountMenu.open();
    await menu.verifyItemsRead(["Sign in", "Create account", "Settings"]);
    test.expect(backendSimulator.getCallCount(EndpointKey.SESSION_DELETE)).toBe(1);
  });

  // A control that cannot work is worse than no control (CLAUDE.md).
  test("in a shell that cannot sync, it holds only Settings and says why", async ({ launcher }) => {
    await launcher.launch({ sync: false });

    const menu = await launcher.appShell.accountMenu.open();

    await menu.verifyItemsRead(["Settings"]);
    await menu.verifySaysAccountsNeedAnotherShell();
  });

  test("marks its button while an account page is showing", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    await launcher.appShell.accountMenu.verifyTriggerMarksAccountPage(false);

    const menu = await launcher.appShell.accountMenu.open();
    await menu.chooseSignIn();
    await menu.pressKey("Escape");

    await launcher.appShell.accountMenu.verifyTriggerMarksAccountPage(true);
  });
});

test.describe("signing in on the web", () => {
  test("asking for a link says to check your email, and sends the address once", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
    await signIn.verifyHeadingHasFocus();
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "web", intent: "signIn" },
    ]);
  });

  test("says how many overviews in this browser will join the account", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(makeOverview());
    backendSimulator.overviews.seed(makeOverview());
    await launcher.launch({ sync: true });

    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.verifySavedOverviewsNoteReads(
      "Signing in adds the 2 overviews saved in this browser to your account, so they're there on your phone, in the extension and on any other device.",
    );
  });

  test("says nothing about joining the account when this browser holds no overviews", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.verifySavedOverviewsNoteReads(null);
  });

  test("an address that isn't a whole one is said in place, and nothing is sent", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.requestLink("reader@example");

    await signIn.verifyFieldErrorReads("That doesn't look like a full email address.");
    test.expect(backendSimulator.getCallCount(EndpointKey.AUTH_MAGIC_LINK)).toBe(0);
  });

  test("an address the server could not read is said in the same place", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointError(EndpointKey.AUTH_MAGIC_LINK);
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.verifyFieldErrorReads("That doesn't look like a full email address.");
  });

  test("using a different email goes back to the form with the address still in it", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.useDifferentEmail();

    await signIn.verifyAsksForEmail("Sign in");
    await signIn.requestLink(SIMULATED_EMAIL);
    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
  });

  // The server sends nothing inside its one-a-minute cooldown (docs/features/sign-in.md).
  test("another link can be sent once the server's minute is up, and not before", async ({
    page,
    launcher,
    backendSimulator,
  }) => {
    await page.clock.install();
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await signIn.requestLink(SIMULATED_EMAIL);
    await signIn.verifyResendWaitReads("Send another in 1:00");

    await page.clock.runFor(12_000);
    await signIn.verifyResendWaitReads("Send another in 0:48");
    await page.clock.runFor(48_000);
    await signIn.resend();

    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
    await signIn.verifyResendWaitReads("Send another in 1:00");
    test.expect(backendSimulator.auth.magicLinkRequests()).toHaveLength(2);
  });

  test("opening a web link signs this browser in, goes to the library, and the menu says who", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch({ sync: true });

    await launcher.openSignInLink("the-token-from-the-email");

    await launcher.homePage.verifyIsShown();
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifySignedInAs("Ada", SIMULATED_EMAIL);
    const settings = await menu.chooseSettings();
    await settings.syncPanel.verifySignedInAs(`Ada (${SIMULATED_EMAIL})`);
    await settings.syncPanel.verifyStatusReads(/Synced|Connected/);
    test.expect(backendSimulator.auth.signInAttempts()).toEqual(["the-token-from-the-email"]);
  });

  // The tab the link opened in is the messenger, not the shell that asked: it shows the
  // code and stays signed out (docs/features/sign-in.md).
  test("a link asked for from the extension shows a code on the web and signs nothing in here", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.linkWasAskedForFrom("extension");
    await launcher.launch({ sync: true });

    await launcher.openSignInLink("the-token-from-the-email");

    await launcher.signInPage.verifyShowsCode(SIMULATED_LINK_CODE);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyItemsRead(["Sign in", "Create account", "Settings"]);
  });

  test("a spent link says so and asks for the address again right there", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointError(EndpointKey.AUTH_SIGN_IN);
    await launcher.launch({ sync: true });

    await launcher.openSignInLink("a-link-already-used");

    const signIn = await launcher.signInPage.verifyAsksForEmail("That link has expired");
    await signIn.requestLink(SIMULATED_EMAIL);
    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "web", intent: "signIn" },
    ]);
  });

  test("the sign-in page with no token in it asks for an email and spends nothing", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true });

    await launcher.openSignInLink(null);

    await launcher.signInPage.verifyAsksForEmail("Sign in");
    test.expect(backendSimulator.getCallCount(EndpointKey.AUTH_SIGN_IN)).toBe(0);
  });

  test("a signed-in browser sent to the sign-in page goes to the library instead", async ({ launcher }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });

    await launcher.openSignInLink(null);

    await launcher.homePage.verifyIsShown();
  });

  test("settings, signed out, points at the sign-in and create-account pages", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const settings = await launcher.appShell.openSettings();
    await settings.syncPanel.verifyAsksToSignIn();

    await settings.syncPanel.clickCreateAccount();
  });

  test("on a phone, the sign-in page's one way out is Not now", async ({ page, launcher }) => {
    await page.setViewportSize(PHONE);
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await launcher.appShell.verifyOffersNotNow(true);
    await signIn.verifyLeadReads(/Open it on this phone/);

    await launcher.appShell.clickNotNow();

    await launcher.appShell.verifyOffersNotNow(false);
  });

  test("wider than a phone, the bar keeps its actions on the sign-in page", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await launcher.appShell.verifyOffersNotNow(false);
  });
});

test.describe("creating an account on the web", () => {
  test("asks for a first name, sends it with the link, and thanks the reader by it", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true });
    const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);

    await createAccount.verifyKickerReads("Thanks, Ada.");
    await createAccount.verifyChecksEmail(SIMULATED_EMAIL);
    await createAccount.verifyLeadReads(/to finish creating your account/);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "web", intent: "createAccount", firstName: "Ada" },
    ]);
  });

  test("a missing first name is said in place, and nothing is sent", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true });
    const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await createAccount.requestLink(SIMULATED_EMAIL);

    await createAccount.verifyFieldErrorReads("Tell us what to call you.");
    test.expect(backendSimulator.getCallCount(EndpointKey.AUTH_MAGIC_LINK)).toBe(0);
  });

  test("the two pages lead to each other", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await (await signIn.switchToOtherPage()).verifyAsksForEmail("Create your account");
    await (await signIn.switchToOtherPage()).verifyAsksForEmail("Sign in");
  });
});

test.describe("signing in from the extension", () => {
  test("asks for an email, then the code, and greets the reader by name once it works", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await signIn.verifyAsksForServer(false);
    await signIn.requestLink(SIMULATED_EMAIL);
    await signIn.verifyAsksForCode(SIMULATED_EMAIL);

    await signIn.enterCode(SIMULATED_LINK_CODE);

    await signIn.verifyWelcomes("You're in, Ada", /sync to your account/);
    await signIn.clickDone();
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifySignedInAs("Ada", SIMULATED_EMAIL);
    await menu.verifySyncStatusShown(true);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "extension", intent: "signIn" },
    ]);
    test.expect(backendSimulator.getCallCount(EndpointKey.SYNC_HANDSHAKE)).toBeGreaterThan(0);
  });

  // The popup is closed the moment the reader goes to their mail (docs/features/sign-in.md).
  test("reopened while a code is awaited, the menu says so and leads straight to the code", async ({ launcher }) => {
    await launcher.launch({ sync: true, surface: "extension", pendingSignIn: waitingForCode() });

    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyWaitingForCode(SIMULATED_EMAIL);
    await menu.verifyItemsRead(["Enter code", "Settings"]);
    const signIn = await menu.chooseEnterCode();

    await signIn.verifyAsksForCode(SIMULATED_EMAIL);
  });

  test("a wrong code is said in place and the panel keeps waiting", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointError(EndpointKey.AUTH_LINK_CODE);
    await launcher.launch({ sync: true, surface: "extension", pendingSignIn: waitingForCode() });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseEnterCode();

    await signIn.enterCode("WRONG-CODE");

    await signIn.verifyCodeErrorReads(/wrong, has expired, or was already used/);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyWaitingForCode(SIMULATED_EMAIL);
  });

  test("creating an account from the extension sends the name and waits for the code", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);

    await createAccount.verifyAsksForCode(SIMULATED_EMAIL);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "extension", intent: "createAccount", firstName: "Ada" },
    ]);
  });

  test("an extension built without a server asks for one", async ({ launcher }) => {
    await launcher.launch({ sync: true, surface: "extension" });

    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.verifyAsksForServer(true);
  });

  test("an extension built for a server can still be pointed at another", async ({ launcher }) => {
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.chooseOtherServer("https://staging.sync.test");
    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.verifyAsksForCode(SIMULATED_EMAIL);
  });
});

// The web app already signed in mints the code itself, so the extension beside it signs
// in without a second email (docs/features/sign-in.md).
test.describe("connecting the extension from the web app", () => {
  test("the menu leads to a code for the extension, and no email is sent", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });

    const page = await (await launcher.appShell.accountMenu.open()).chooseConnectExtension();

    await page.verifyShowsCodeForExtension(SIMULATED_LINK_CODE);
    test.expect(backendSimulator.getCallCount(EndpointKey.SESSION_LINK_CODE)).toBe(1);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([]);
  });

  test("settings, signed in, leads to the same code", async ({ launcher }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });
    const settings = await launcher.appShell.openSettings();

    const page = await settings.syncPanel.clickConnectExtension();

    await page.verifyShowsCodeForExtension(SIMULATED_LINK_CODE);
  });

  test("a new code can be asked for once the first has lapsed", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });
    const page = await (await launcher.appShell.accountMenu.open()).chooseConnectExtension();
    await page.verifyShowsCodeForExtension(SIMULATED_LINK_CODE);

    await page.askForNewCode();

    await test.expect.poll(() => backendSimulator.getCallCount(EndpointKey.SESSION_LINK_CODE)).toBe(2);
  });

  test("a code the server would not make says so, and tries again on request", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_LINK_CODE);
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });

    await (await launcher.appShell.accountMenu.open()).chooseConnectExtension();

    const error = await launcher.errorState.verifyIsShown();
    await error.verifyTitleReads("Couldn't make a code for the extension");
    await error.takeAction();
    await test.expect.poll(() => backendSimulator.getCallCount(EndpointKey.SESSION_LINK_CODE)).toBe(2);
  });

  // A web app is still connected once its session has ended, so sending it to /sign-in
  // would only bounce it home. It signs out first, as the menu's Sign in again does.
  test("a session that has ended says so, and signing in again leads to the email form", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.sessionHasEnded();
    await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });

    await (await launcher.appShell.accountMenu.open()).chooseConnectExtension();

    const error = await launcher.errorState.verifyIsShown();
    await error.verifyTitleReads("This browser's session has ended");
    await error.takeAction();
    await launcher.signInPage.verifyAsksForEmail("Sign in");
    test.expect(backendSimulator.getCallCount(EndpointKey.SESSION_DELETE)).toBe(1);
  });

  test("signed out, settings offers no code to make", async ({ launcher }) => {
    await launcher.launch({ sync: true });
    const settings = await launcher.appShell.openSettings();

    await settings.syncPanel.verifyOffersConnectingExtension(false);
  });

  test("the extension takes the web app's code with no email, and greets the reader by name", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.auth.accountIsNamed("Ada");
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.chooseCodeFromWebApp();
    await signIn.enterCode(SIMULATED_LINK_CODE);

    await signIn.verifyWelcomes("You're in, Ada", /sync to your account/);
    test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([]);
    test.expect(backendSimulator.getCallCount(EndpointKey.AUTH_LINK_CODE)).toBe(1);
  });

  test("in the extension, a wrong code from the web app is said in place", async ({ launcher, backendSimulator }) => {
    backendSimulator.simulateEndpointError(EndpointKey.AUTH_LINK_CODE);
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await signIn.chooseCodeFromWebApp();

    await signIn.enterCode("WRONG-CODE");

    await signIn.verifyCodeErrorReads(/wrong, has expired, or was already used/);
  });

  test("in the extension, choosing to be emailed instead goes back to the form", async ({ launcher }) => {
    await launcher.launch({ sync: true, surface: "extension", defaultApiUrl: SERVER });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();
    await signIn.chooseCodeFromWebApp();

    await signIn.chooseEmailInstead();

    await signIn.verifyAsksForEmail("Sign in");
  });

  test("an extension that doesn't yet know its server offers no web-app code", async ({ launcher }) => {
    await launcher.launch({ sync: true, surface: "extension" });

    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.verifyOffersCodeFromWebApp(false);
  });

  test("the web app's own sign-in page offers no code to type", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.verifyOffersCodeFromWebApp(false);
  });
});
