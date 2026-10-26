import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

// Signed out, 3 overviews in total on either key, then an account
// (docs/architecture/tiers.md, "Counting" and "At the limit").
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

test("signed out with no key, an overview is made on our key under a trial token the device asked for", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ sync: true });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();

  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.trialTokensIssued()).toBe(1);
  expect(backendSimulator.ourKey.trialTokensSent()).toEqual(["simulated-trial-1"]);
});

test("a device that has made 3 signed out is offered an account instead of Generate, whatever key it holds", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launch({ sync: true, apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 3, token: "simulated-trial-1" } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyOffersAccountForTrial();
  await dialog.form.clickCreateAccountForTrial();

  await launcher.signInPage.verifyAsksForEmail("Create your account");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("the 3rd overview signed out, on the reader's own key, is the last before an account", async ({ launcher }) => {
  await launcher.launch({ sync: true, apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 2, token: null } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);
  await dialog.clickReadOverview();
  await launcher.readerPage.verifyIsShown();
  const next = await launcher.appShell.openNewOverview();

  await next.form.verifyOffersAccountForTrial();
});

test("a shell that can't make an account has no trial to spend, so offers no dead end", async ({ launcher }) => {
  await launcher.launch({ apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 3, token: null } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyGenerateButtonEnabled();
});

test("signed in, a device that spent its trial makes overviews on the account's month", async ({ launcher }) => {
  await launcher.launch({ ...SIGNED_IN, apiKeys: ANTHROPIC_KEY, signedOutTrial: { made: 3, token: "simulated-trial-1" } });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.verifyGenerateButtonEnabled();
});
