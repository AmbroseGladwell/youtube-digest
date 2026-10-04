import { consentPath, type ConnectionRequest } from "@overview/domain";
import { expect, test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ASSISTANT_CALLBACK, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const REQUEST_ID = "0b8f5f7e-3c1d-4a8e-9b2a-6f1e2d3c4b5a";
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PHONE = { width: 390, height: 844 };
const MINUTE_MS = 60 * 1000;

const request = (overrides: Partial<ConnectionRequest> = {}): ConnectionRequest => ({
  id: REQUEST_ID,
  clientName: "Claude",
  redirectHost: "claude.ai",
  expiresAt: new Date(Date.now() + 26 * MINUTE_MS - 30_000).toISOString(),
  ...overrides,
});

test.describe("answering an assistant's request", () => {
  test("says who is asking, as a claim, and where approving sends the reader", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);

    await launcher.openConsent(REQUEST_ID);

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyHeadingReads("“Claude” wants to read your overviews");
    await consent.verifySubReads(/we can’t check it/);
    await consent.verifySendsBackTo("claude.ai");
    await consent.verifySignedInAs(SIMULATED_EMAIL);
    await consent.verifyListsPermissions([
      "Read your overviews and their transcripts",
      "Change nothing. Access is read-only",
      "Not see your API keys. They stay on your device",
    ]);
    await consent.verifyHeadingHasFocus();
  });

  test("an assistant that gave no name is not given one", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seedRequest(request({ clientName: null }));
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);

    await launcher.openConsent(REQUEST_ID);

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyHeadingReads("An assistant wants to read your overviews");
    await consent.verifySubReads(/It didn’t give a name/);
  });

  test("a long name is shortened on screen and read whole", async ({ launcher, backendSimulator }) => {
    const name = `Claude ${"x".repeat(80)}`;
    backendSimulator.connections.seedRequest(request({ clientName: name }));
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);

    await launcher.openConsent(REQUEST_ID);

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyHeadingIsNamed(`“${name}” wants to read your overviews`);
  });

  test("approving says where it is going, then sends the reader back with a code", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();
    backendSimulator.simulateEndpointStalled(EndpointKey.CONNECTION_DECISION);

    await consent.approve();

    await consent.verifyIsSendingBack("Sending you back to claude.ai…");
    await backendSimulator.releaseEndpoint(EndpointKey.CONNECTION_DECISION);
    await expect(page).toHaveURL(`${SIMULATED_ASSISTANT_CALLBACK}?code=simulated-code&state=s`);
    expect(backendSimulator.connections.decisions()).toEqual([{ requestId: REQUEST_ID, approve: true }]);
    await expect.poll(() => backendSimulator.analytics.eventNames()).toEqual(["mcp.consentScreen.shown", "mcp.consentScreen.approved"]);
    expect(backendSimulator.analytics.batches()[0]!.context).toMatchObject({ surface: "web", layout: "full" });
  });

  test("declining sends the reader back with a refusal", async ({ launcher, backendSimulator, page }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);

    await (await launcher.consentPage.verifyIsShown()).decline();

    await expect(page).toHaveURL(`${SIMULATED_ASSISTANT_CALLBACK}?error=access_denied&state=s`);
    expect(backendSimulator.connections.decisions()).toEqual([{ requestId: REQUEST_ID, approve: false }]);
    await expect
      .poll(() => backendSimulator.analytics.events())
      .toEqual([
        { name: "mcp.consentScreen.shown", props: {} },
        { name: "mcp.consentScreen.declined", props: { plan: "plus" } },
      ]);
  });

  test("an answer the server did not take can be given again", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    backendSimulator.simulateEndpointError(EndpointKey.CONNECTION_DECISION);
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();

    await consent.approve();

    await consent.verifyDecisionErrorShown();
    await consent.verifyOffersApprove(true);
  });

  test("a free reader is shown what Plus would do, with no Approve, and can still decline", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    test.skip(true, "every account can connect an assistant until billing exists (OV-18)");
    backendSimulator.connections.seedRequest(request());
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();

    await consent.verifyOffersPlus(
      "This request stays open for 26 more minutes. Get Plus and you’ll come back here to approve it.",
    );
    await consent.verifyOffersApprove(false);

    await consent.declineOnFree();
    await expect(page).toHaveURL(`${SIMULATED_ASSISTANT_CALLBACK}?error=access_denied&state=s`);
    await expect
      .poll(() => backendSimulator.analytics.events())
      .toEqual([
        { name: "mcp.consentScreen.shown", props: {} },
        { name: "mcp.consentScreen.plusRequired", props: {} },
        { name: "mcp.consentScreen.declined", props: { plan: "free" } },
      ]);
  });

  test("a free reader can approve while every account can connect", async ({ launcher, backendSimulator, page }) => {
    backendSimulator.connections.seedRequest(request());
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);

    await (await launcher.consentPage.verifyIsShown()).approve();

    await expect(page).toHaveURL(`${SIMULATED_ASSISTANT_CALLBACK}?code=simulated-code&state=s`);
    expect(backendSimulator.connections.decisions()).toEqual([{ requestId: REQUEST_ID, approve: true }]);
  });

  test("an account that couldn't be checked says so and can be asked again, rather than waiting forever", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    backendSimulator.simulateEndpointError(EndpointKey.SESSION_READ);
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();

    await consent.verifySessionErrorShown();
    backendSimulator.simulateEndpointDefault(EndpointKey.SESSION_READ);
    await consent.retrySession();

    await consent.verifyOffersApprove(true);
  });

  test("an answer refused because the session has since ended asks for an email again", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyOffersApprove(true);
    backendSimulator.auth.sessionHasLapsed();

    await consent.approve();

    await consent.verifyAsksToSignIn();
  });

  test("a session the server no longer knows asks for an email", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.sessionHasLapsed();
    await launcher.launch(SIGNED_IN);

    await launcher.openConsent(REQUEST_ID);

    await (await launcher.consentPage.verifyIsShown()).verifyAsksToSignIn();
  });

  test("an expired or answered request says to start again from the assistant", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);

    await launcher.openConsent(REQUEST_ID);

    await launcher.errorState.verifyIsShown();
    await launcher.errorState.verifyTitleReads("This request has expired");
    await launcher.errorState.verifyOffersNoAction();
    await launcher.errorState.verifyOffersWayBack();
  });
});

test.describe("answering while signed out", () => {
  test("shows the request and asks for an email, with the permissions held back", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seedRequest(request());
    await launcher.launch({ sync: true });

    await launcher.openConsent(REQUEST_ID);

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyHeadingReads("“Claude” wants to read your overviews");
    await consent.verifySendsBackTo("claude.ai");
    await consent.verifyAsksToSignIn();
  });

  test("the link it sends comes back to this request, and the wait says to open it here", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seedRequest(request());
    await launcher.launch({ sync: true });
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();

    await consent.requestLink(SIMULATED_EMAIL);

    await consent.verifyChecksEmail(SIMULATED_EMAIL, "Open for 26 more minutes");
    await consent.verifyNoteReads("Open the link on this computer");
    expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "web", intent: "signIn", returnTo: consentPath(REQUEST_ID) },
    ]);
  });

  test("on a phone, the wait says to open the link on this phone", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize(PHONE);
    backendSimulator.connections.seedRequest(request());
    await launcher.launch({ sync: true });
    await launcher.openConsent(REQUEST_ID);

    await (await launcher.consentPage.verifyIsShown()).requestLink(SIMULATED_EMAIL);

    await launcher.consentPage.verifyNoteReads("Open the link on this phone");
  });

  test("opening the link in the same browser lands back on the request, ready to answer", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch({ sync: true });
    await launcher.openConsent(REQUEST_ID);
    const asking = await launcher.consentPage.verifyIsShown();
    await asking.requestLink(SIMULATED_EMAIL);
    await asking.verifyChecksEmail(SIMULATED_EMAIL, "Open for 26 more minutes");

    await launcher.openSignInLink("a-token", consentPath(REQUEST_ID));

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyOffersApprove(true);
    await consent.verifyNoteReads(null);

    await consent.approve();
    await expect(page).toHaveURL(`${SIMULATED_ASSISTANT_CALLBACK}?code=simulated-code&state=s`);
    await expect
      .poll(() => backendSimulator.analytics.eventNames(), { message: "the view while signed out is never sent" })
      .toEqual(["mcp.consentScreen.shown", "mcp.consentScreen.approved"]);
  });

  test("a link opened on another device says this device is the one sent back", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch({ sync: true });

    await launcher.openSignInLink("a-token", consentPath(REQUEST_ID));

    const consent = await launcher.consentPage.verifyIsShown();
    await consent.verifyNoteReads("Started on another device?");
    await consent.verifyOffersApprove(true);
  });

  test("a link whose return is not a consent screen goes to the library as before", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await launcher.openSignInLink("a-token", "/settings");

    await launcher.homePage.verifyIsShown();
  });

  test("an expired link asks for a new one that still comes back to the request", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.simulateEndpointError(EndpointKey.AUTH_SIGN_IN);
    await launcher.launch({ sync: true });
    await launcher.openSignInLink("a-link-already-used", consentPath(REQUEST_ID));
    const signIn = await launcher.signInPage.verifyAsksForEmail("That link has expired");

    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
    expect(backendSimulator.auth.magicLinkRequests()).toEqual([
      { email: SIMULATED_EMAIL, surface: "web", intent: "signIn", returnTo: consentPath(REQUEST_ID) },
    ]);
  });

  test("Not you? signs out and asks for an email", async ({ launcher, backendSimulator }) => {
    backendSimulator.connections.seedRequest(request());
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch(SIGNED_IN);
    await launcher.openConsent(REQUEST_ID);
    const consent = await launcher.consentPage.verifyIsShown();

    await consent.notYou();

    await consent.verifyAsksToSignIn();
  });
});
