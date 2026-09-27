import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL, SIMULATED_LINK_CODE } from "../../network/BackendSimulator.testHelper.js";

const SERVER = "https://sync.test";
const SIGNED_IN_BY_COOKIE = { apiUrl: SERVER, token: null, email: SIMULATED_EMAIL };

// On the web the API is this page's own origin, so the form asks for an email and
// nothing else (docs/features/sign-in.md).
test("asking for a link on the web says to check your email, and sends the address once", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ sync: true });
  const settings = await launcher.appShell.openSettings();

  await settings.syncPanel.requestLink(SIMULATED_EMAIL);

  await settings.syncPanel.verifyLinkSentReads(/Check your email.*signs this browser in/);
  test.expect(backendSimulator.auth.magicLinkRequests()).toEqual([{ email: SIMULATED_EMAIL, surface: "web" }]);
});

test("an address the server could not read is said in place", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.AUTH_MAGIC_LINK);
  await launcher.launch({ sync: true });
  const settings = await launcher.appShell.openSettings();

  await settings.syncPanel.requestLink("reader@example");

  await settings.syncPanel.verifyFormErrorReads(/email address/);
});

test("opening a web link signs this browser in, and settings says who", async ({ launcher, backendSimulator }) => {
  await launcher.launch({ sync: true });

  await launcher.openSignInLink("the-token-from-the-email");

  const settings = await launcher.settingsPage.verifyIsShown();
  await settings.syncPanel.verifySignedInAs(SIMULATED_EMAIL);
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
  const settings = await launcher.appShell.openSettings();
  await settings.syncPanel.verifyAsksToSignIn();
});

test("a spent link says so and offers the way back to settings", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointError(EndpointKey.AUTH_SIGN_IN);
  await launcher.launch({ sync: true });

  await launcher.openSignInLink("a-link-already-used");

  const error = await launcher.errorState.verifyIsShown();
  await error.verifyTitleReads("That link didn't sign you in");
  await error.verifyOffersAction("Go to Settings");
  await error.takeAction();
  await launcher.settingsPage.verifyIsShown();
});

test("the sign-in page with no token in it does not pretend to have one", async ({ launcher, backendSimulator }) => {
  await launcher.launch({ sync: true });

  await launcher.openSignInLink(null);

  const error = await launcher.errorState.verifyIsShown();
  await error.verifyTitleReads("There's no sign-in link here");
  test.expect(backendSimulator.getCallCount(EndpointKey.AUTH_SIGN_IN)).toBe(0);
});

test("on the web, signing out ends the cookie's session and asks to sign in again", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ sync: true, syncConnection: SIGNED_IN_BY_COOKIE });
  const settings = await launcher.appShell.openSettings();
  await settings.syncPanel.verifySignedInAs(SIMULATED_EMAIL);

  await settings.syncPanel.clickSignOut();

  await settings.syncPanel.verifyAsksToSignIn();
  test.expect(backendSimulator.getCallCount(EndpointKey.SESSION_DELETE)).toBe(1);
});

test("in the extension, a wrong code is said in place and the panel stays signed out", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.AUTH_LINK_CODE);
  await launcher.launch({ sync: true, surface: "extension" });
  const settings = await launcher.appShell.openSettings();
  await settings.syncPanel.setServerAddress(SERVER);

  await settings.syncPanel.enterCode("WRONG-CODE");

  await settings.syncPanel.verifyFormErrorReads(/wrong, has expired, or was already used/);
  await settings.syncPanel.verifyAsksToSignIn();
});
