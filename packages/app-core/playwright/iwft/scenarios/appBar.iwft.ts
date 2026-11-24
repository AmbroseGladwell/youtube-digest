import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

for (const width of [320, 360, 375]) {
  test.describe(`App bar on a ${width}px phone (OV-380)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
    });

    test("on the library, every page icon and button fits, each a full touch target or the design's 40px below 340px", async ({
      launcher,
      backendSimulator,
    }) => {
      backendSimulator.overviews.seedSynced(makeOverview());
      await launcher.launchExpectingLibrary(SIGNED_IN);

      await launcher.appShell.verifyBarFitsTheScreen();
      await launcher.appShell.verifyNameIsTheHeading();
    });

    test("in a reader, the back link's label, every button and every tab label fit", async ({ launcher, backendSimulator }) => {
      backendSimulator.overviews.seedSynced(makeOverview());
      const library = await launcher.launchExpectingLibrary(SIGNED_IN);
      const reader = await library.nthCard(0).openReader();
      await launcher.appShell.scrollUntilTheBarHoldsTheWayBack();

      await launcher.appShell.verifyBackLabelShownWhole("All overviews");
      await launcher.appShell.verifyBarFitsTheScreen();
      await reader.verifyTabLabelsShownWhole();
    });
  });
}
