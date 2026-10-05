import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import {
  ANONYMOUS_ID,
  makeAnalyticsConsent,
} from "../../../src/features/analyticsConsent/types/AnalyticsConsentFactory.testHelper.js";

const SAID_YES = { analyticsConsent: makeAnalyticsConsent({ answer: "share" }) };
const SAID_NO = { analyticsConsent: makeAnalyticsConsent({ answer: "dontShare" }) };

// Design 62j: creating an account is agreeing to the terms, said directly above the button
// (docs/features/analytics-consent.md, "Creating an account").
test.describe("the create-account page", () => {
  test("says what creating an account agrees to, above the button, with no checkbox", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await launcher.accountTermsLine.verifyReadsAboveTheButton(/^https?:\/\/[^/]+/, false);
  });

  test("on a phone the line sits with the button", async ({ launcher, page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await launcher.launch({ sync: true });

    await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await launcher.accountTermsLine.verifyReadsAboveTheButton(/^https?:\/\/[^/]+/, false);
  });

  test("in the extension the links open the web app's pages in a tab of their own", async ({ launcher }) => {
    await launcher.launchPanel({ sync: true, defaultApiUrl: "https://sync.test" });

    await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await launcher.accountTermsLine.verifyReadsAboveTheButton(/^https:\/\/sync\.test/, true);
  });

  test("signing in carries no terms line", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await launcher.accountTermsLine.verifyIsAbsent();
  });
});

test.describe("linking what was shared", () => {
  test("a reader who said yes sends their anonymous id with the request to create an account", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch({ sync: true, ...SAID_YES });
    const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);

    await createAccount.verifyChecksEmail(SIMULATED_EMAIL);
    test.expect(backendSimulator.auth.magicLinkRequests().map(({ anonymousId }) => anonymousId)).toEqual([ANONYMOUS_ID]);
  });

  test("a reader who said no, or was never asked, sends none", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true, ...SAID_NO });
    const createAccount = await (await launcher.appShell.accountMenu.open()).chooseCreateAccount();

    await createAccount.typeFirstName("Ada");
    await createAccount.requestLink(SIMULATED_EMAIL);

    await createAccount.verifyChecksEmail(SIMULATED_EMAIL);
    test.expect(backendSimulator.auth.magicLinkRequests().map(({ anonymousId }) => anonymousId)).toEqual([undefined]);
  });

  test("signing in to an account that exists sends none, even after a yes", async ({ launcher, backendSimulator }) => {
    await launcher.launch({ sync: true, ...SAID_YES });
    const signIn = await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await signIn.requestLink(SIMULATED_EMAIL);

    await signIn.verifyChecksEmail(SIMULATED_EMAIL);
    test.expect(backendSimulator.auth.magicLinkRequests().map(({ anonymousId }) => anonymousId)).toEqual([undefined]);
  });
});
