import { SourceKey, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview, makeOverviewState } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const NOW = new Date("2026-11-24T10:00:00.000Z");
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const article = (title: string, url: string, siteName: string | null, savedAt: string): Overview =>
  makeOverview({
    savedAt,
    source: {
      kind: "web",
      id: SourceKey.parse(`web:${title.length}${savedAt}`),
      url,
      title,
      siteName,
      author: null,
      publishedAt: null,
      language: null,
      imageUrl: null,
      wordCount: 900,
    },
  } as never);

const seed = (backendSimulator: BackendSimulator) => {
  const pizza = article("Pizza at home", "https://www.seriouseats.com/pizza", "Serious Eats", "2026-11-18T09:00:00.000Z");
  const stock = article("Stock from scraps", "https://www.seriouseats.com/stock", "Serious Eats", "2026-11-10T09:00:00.000Z");
  const stew = article("A stew for the week", "https://www.bbcgoodfood.com/stew", "BBC Good Food", "2026-11-12T09:00:00.000Z");
  const video = makeOverview({ savedAt: "2026-11-20T09:00:00.000Z", source: { ...makeOverview().source, title: "How habits form" } });
  for (const overview of [pizza, stock, stew, video]) {
    backendSimulator.overviews.seed(overview);
  }
  backendSimulator.overviews.seedState(makeOverviewState(stock.id, { read: true }));
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

test("a website's name on a row opens its page: the site, its name and counts, then only its overviews", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seed(backendSimulator);
  await page.setViewportSize(DESKTOP);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.cardWithTitle("How habits form").verifySiteLinked(null);

  await library.cardWithTitle("Pizza at home").openSitePage();

  const head = await library.sourceHead.verifyIsShown();
  await head.verifyReads({ name: "Serious Eats", facts: "2 overviews · 1 unread · latest saved 18 Nov", site: "seriouseats.com" });
  await library.verifyChipsRead(["Serious Eats"]);
  await library.verifyCardOrder(["Pizza at home"]);

  await head.clickBack();
  await library.sourceHead.verifyIsNotShown();
  await library.verifyNoChips();
  await library.verifyCardOrder(["How habits form", "Pizza at home", "A stew for the week"]);

  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("library.sourcePage.")))
    .toEqual([
      { name: "library.sourcePage.rowLinkFollowed", props: {} },
      { name: "library.sourcePage.left", props: {} },
    ]);
});

test("a platform chosen in the filters gets its page with no site to open, and a second source goes back to the plain list", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  seed(backendSimulator);
  await page.setViewportSize(DESKTOP);
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.clickSource("youtube");
  await library.sourceHead.verifyReads({ name: "YouTube", facts: "1 overview · 1 unread · latest saved 20 Nov", site: null });

  await library.filterMenu.clickSource("site:seriouseats.com");
  await library.filterMenu.close();
  await library.sourceHead.verifyIsNotShown();
  await library.verifyChipsRead(["YouTube", "Serious Eats"]);
});

test("on a phone the source's page lends its way back to the bar", async ({ launcher, backendSimulator, page }) => {
  seed(backendSimulator);
  await page.setViewportSize(PHONE);
  const library = await launcher.launchExpectingLibrary();

  await library.cardWithTitle("Pizza at home").openSitePage();

  await library.sourceHead.verifyIsShown();
  await launcher.appShell.verifyBarHoldsTheBrand("All overviews");
});
