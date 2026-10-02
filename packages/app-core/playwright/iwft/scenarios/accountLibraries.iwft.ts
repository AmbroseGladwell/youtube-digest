import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const signedInAs = (accountId: string) => ({
  apiUrl: "https://sync.test",
  token: null,
  accountId,
  email: SIMULATED_EMAIL,
  firstName: "Ada",
});

const titled = (title: string) => makeOverview({ video: { ...makeOverview().video, title } });

// Each account's library is its own, and stays on the device when it signs out
// (docs/features/account-libraries.md).
test("signing out leaves the account's overviews behind, and signing back in brings them back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(titled("Kept In The Account"));
  const library = await launcher.launchExpectingLibrary({ sync: true, syncConnection: signedInAs(SIMULATED_ACCOUNT_ID) });
  await library.expectCardCountToBe(1);

  const menu = await launcher.appShell.accountMenu.open();
  await menu.chooseSignOut();
  await launcher.homePage.verifyShowsFirstRunHero();

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

  await launcher.openSignInLink("the-token-from-the-email");

  await launcher.homePage.verifyShowsFirstRunHero();
  await launcher.appShell.accountMenu.open();
  await menu.verifySignedInAs("Bea", SIMULATED_EMAIL);
});
