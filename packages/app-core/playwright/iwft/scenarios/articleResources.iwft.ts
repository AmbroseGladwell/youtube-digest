import { DEFAULT_SECTIONS_ENABLED, ShareToken, shareSnapshot, type ArticleResource, type Overview } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeArticleOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const ARTICLE = "https://theharbourpost.example/2026/11/bridge-bill-twice";

const resource = (text: string, href: string, why: string, chapter: number, quote: string): ArticleResource => ({
  text,
  href,
  why,
  place: { anchor: null, quote },
  chapter,
});

const RESOURCES = [
  resource(
    "County repair fund rules",
    "https://county.example.gov/repair-fund",
    "The rules the county's offer rests on, which Rao says cap its share at half.",
    1,
    "The county offered half",
  ),
  resource(
    "Bridge survey 2011",
    "https://data.example.org/survey-2011",
    "The survey the estimate reused without a new inspection.",
    0,
    "The bridge",
  ),
  resource(
    "Council tax explainer",
    "https://www.gov.example/council-tax",
    "Where Rao sends readers to see how the levy is set.",
    1,
    "Half the bill",
  ),
];

const withResources = (resources: ArticleResource[]): Overview => {
  const overview = makeArticleOverview();
  return { ...overview, article: { ...overview.article!, resources } };
};

test("an article's resources sit last in the note, closed, naming the first two", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withResources(RESOURCES));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.resources.verifyIsClosed("Resources it points to · 3", "County repair fund rules, Bridge survey 2011 and 1 more");
});

test("opening them shows each name, site, why and the chapter it was shared in, each linking where it says", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withResources(RESOURCES));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.resources.clickToggle();

  await reader.resources.verifyIsOpen();
  await reader.resources.verifyNamesRead(["County repair fund rules", "Bridge survey 2011", "Council tax explainer"]);
  await reader.resources.verifyWhysRead(RESOURCES.map(({ why }) => why));
  await reader.resources.verifyNameLinksTo(
    "Council tax explainer, on gov.example, opens in a new tab",
    "https://www.gov.example/council-tax",
  );
  await reader.resources.verifyFromLinksTo(
    "From Who pays: opens the article at the place it was shared",
    `${ARTICLE}#:~:text=The%20county%20offered%20half`,
  );
});

test("one resource is headed as one", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withResources(RESOURCES.slice(0, 1)));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.resources.verifyIsClosed("A resource it points to · 1", "County repair fund rules");
});

test("an article with one chapter says where the article shares it, in place of the chapter", async ({ launcher, backendSimulator }) => {
  const overview = makeArticleOverview();
  const [first] = overview.article!.chapters;
  backendSimulator.overviews.seed({
    ...overview,
    article: { ...overview.article!, chapters: [first!], keyPointChapters: [0, 0, 0], readAnyway: null, resources: [{ ...RESOURCES[1]! }] },
  });
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.resources.clickToggle();

  await reader.resources.verifyFromLinksTo(
    "Where the article shares it: opens the article at that place",
    `${ARTICLE}#:~:text=The%20bridge`,
  );
});

test("an article without resources shows no block", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.resources.verifyIsNotShown();
});

test("switched off in Settings, resources are hidden, and the switch says they're still kept", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withResources(RESOURCES));
  const library = await launcher.launchExpectingLibrary({
    ...SIGNED_IN,
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, resources: false },
  });
  const reader = await library.nthCard(0).openReader();

  await reader.resources.verifyIsNotShown();

  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifySwitchIs("Resources it points to", false);
  await settings.personalisation.verifyResourcesOffNoteIsShown(true);
});

test("a shared article carries its resources, closed to start", async ({ launcher }) => {
  const token = ShareToken.parse("r3sOurc3sT0k3nab");
  const overview = withResources(RESOURCES);
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({
    state: "shared",
    token,
    sharedAt: "2026-11-12T11:00:00.000Z",
    snapshot: shareSnapshot({ overview, narration: null }),
  });
  await launcher.openPage(Routes.sharedOverview(token));

  const shared = await launcher.sharedOverviewPage.verifyIsShown();
  await shared.resources.verifyIsClosed("Resources it points to · 3", "County repair fund rules, Bridge survey 2011 and 1 more");
  await shared.resources.clickToggle();
  await shared.resources.verifyFromLinksTo(
    "From How the survey went wrong: opens the article at the place it was shared",
    `${ARTICLE}#:~:text=The%20bridge`,
  );
});
