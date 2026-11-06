import { test } from "../../support/fixtures.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: {
    apiUrl: "https://sync.test",
    token: null,
    accountId: SIMULATED_ACCOUNT_ID,
    email: SIMULATED_EMAIL,
    firstName: "Ada",
  },
} as const;

// The two public pages every policy link points at: readable by anyone, one h1, a contents
// list of the h2 sections, and the date the text last changed (docs/features/legal-pages.md).
test.describe("the privacy policy and the terms", () => {
  test("the privacy policy opens without an account, with its date and a contents list", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await launcher.openPage(Routes.privacy());

    const policy = await launcher.legalPage.verifyIsShown("Privacy policy");
    await policy.verifyHeadingHasFocus();
    await policy.verifyLastUpdated("6 November 2026");
    await policy.verifyContentsListEverySection();
  });

  test("the terms open the same way, and each page leads to the other", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await launcher.openPage(Routes.terms());

    const terms = await launcher.legalPage.verifyIsShown("Terms of service");
    await terms.verifyLastUpdated("6 November 2026");
    await terms.verifyContentsListEverySection();
    const policy = await terms.openOtherPage("Privacy policy");
    await policy.openOtherPage("Terms of service");
  });

  test("a signed-in reader sees the same pages", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);

    await launcher.openPage(Routes.privacy());

    await launcher.legalPage.verifyIsShown("Privacy policy");
  });

  test("on a phone the page fits the screen", async ({ launcher, page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await launcher.launch({ sync: true });

    await launcher.openPage(Routes.privacy());

    const policy = await launcher.legalPage.verifyIsShown("Privacy policy");
    await policy.verifyContentsListEverySection();
    await policy.verifyNoHorizontalScroll();
  });

  test("the sign-in page links to both", async ({ launcher }) => {
    await launcher.launch({ sync: true });

    await (await launcher.appShell.accountMenu.open()).chooseSignIn();

    await launcher.legalPage.verifyPolicyLinksRead(/^https?:\/\/[^/]+/);
  });
});
