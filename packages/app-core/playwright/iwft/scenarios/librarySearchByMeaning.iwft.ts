import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const titled = (title: string, coreClaim: string) => makeOverview({ source: { ...makeOverview().source, title }, coreClaim });

const seed = (backendSimulator: BackendSimulator) => {
  const founders = titled("Why founders stay too long", "Founders clinging to control cause stagnation.");
  const bread = titled("Sourdough at home", "A sourdough loaf needs a slow overnight proving.");
  backendSimulator.overviews.seed(founders);
  backendSimulator.overviews.seed(bread);
  return { founders, bread };
};

// Word matches first, then the closest few by meaning (docs/features/search-by-meaning.md).
test.describe("searching the library by meaning", () => {
  test("an overview that uses none of the words is listed as close in meaning", async ({ launcher, backendSimulator }) => {
    const { founders } = seed(backendSimulator);
    backendSimulator.meaning.seed("leaders who overstay", [founders.id]);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("leaders who overstay");

    await library.verifyCloseInMeaningShows(["Why founders stay too long"]);
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "library.search.meaningMatched"))
      .toEqual([{ name: "library.search.meaningMatched", props: { meaningOnly: 1, available: true } }]);
  });

  test("an overview the words already found is not listed again", async ({ launcher, backendSimulator }) => {
    const { founders, bread } = seed(backendSimulator);
    backendSimulator.meaning.seed("sourdough", [bread.id, founders.id]);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("sourdough");

    await library.verifyCloseInMeaningShows(["Why founders stay too long"]);
    await library.expectCardCountToBe(2);
  });

  test("when meaning can't be searched, the library says it is showing word matches only", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    backendSimulator.simulateEndpointError(EndpointKey.MEANING_SEARCH);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("leaders who overstay");

    await library.verifyMeaningUnavailable();
    await library.verifyNoCloseInMeaning();
  });

  test("the search is sent once typing settles, not once per key", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.search("l");
    await library.search("le");
    await library.search("leaders");

    await expect.poll(() => backendSimulator.getCallCount(EndpointKey.MEANING_SEARCH)).toBe(1);
  });
});
