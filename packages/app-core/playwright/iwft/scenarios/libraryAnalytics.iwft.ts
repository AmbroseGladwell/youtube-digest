import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const ENERGY = makeTopic({ name: "energy" });

const libraryEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("library."));

const seed = (backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seedTopic(ENERGY);
  const grid = makeOverview({
    topicIds: [ENERGY.id],
    source: { ...makeOverview().source, title: "Grid batteries" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(grid);
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Sourdough" } }));
  return grid;
};

test("filtering names a topic by its id and a verdict by its value, and says where it was changed", async ({
  launcher,
  backendSimulator,
}) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.filterMenu.clickTopicChip(ENERGY.id);
  await library.filterMenu.clickNoveltyChip("common_knowledge");

  await expect
    .poll(() => libraryEvents(backendSimulator))
    .toEqual([
      { name: "library.filterSheet.opened", props: {} },
      { name: "library.filters.topicChosen", props: { topicId: ENERGY.id, from: "panel" } },
      { name: "library.filters.noveltySwitched", props: { novelty: "common_knowledge", on: true, from: "panel" } },
    ]);
});

test("searching the library is counted once the reader stops typing, with how many it found and never the words", async ({
  launcher,
  backendSimulator,
}) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.search("sourdough");
  await expect.poll(() => libraryEvents(backendSimulator)).toEqual([{ name: "library.search.searched", props: { results: 1 } }]);
  await library.clearTheSearch();

  await expect.poll(() => libraryEvents(backendSimulator).at(-1)).toEqual({ name: "library.search.cleared", props: {} });
  expect(JSON.stringify(backendSimulator.analytics.batches())).not.toContain("sourdough");
});

test("a row's read and favourite are counted with the state chosen, the overview's id, its layout and plan, and so is opening it", async ({
  launcher,
  backendSimulator,
}) => {
  const grid = seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const card = library.cardWithTitle("Grid batteries");

  await card.clickMarkRead();
  await card.clickFavourite();
  await card.openReaderFromTitle();

  const overviewId = grid.id;
  await expect
    .poll(() => libraryEvents(backendSimulator))
    .toEqual([
      { name: "library.overviewCard.readSwitched", props: { overviewId, read: true, layout: "row", plan: "free" } },
      { name: "library.overviewCard.favouriteSwitched", props: { overviewId, favourite: true, layout: "row", plan: "free" } },
      { name: "library.overviewCard.opened", props: { overviewId, from: "title", layout: "row", plan: "free" } },
    ]);
});

test("picking an order is counted by the order's own name", async ({ launcher, backendSimulator }) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.sortMenu.sortBy("title");

  await expect
    .poll(() => libraryEvents(backendSimulator))
    .toEqual([
      { name: "library.sortPill.opened", props: {} },
      { name: "library.sortPill.orderChosen", props: { field: "title", direction: "asc", group: "none" } },
    ]);
});

test("on a phone the row's events say it was the banner", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const grid = seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.cardWithTitle("Grid batteries").clickListen();

  await expect
    .poll(() => libraryEvents(backendSimulator).filter(({ name }) => name === "library.overviewCard.listenPressed"))
    .toEqual([
      { name: "library.overviewCard.listenPressed", props: { overviewId: grid.id, listening: true, layout: "banner", plan: "free" } },
    ]);
});

test("a row whose image fails is counted once by its kind, however often it is drawn again", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.route("https://cdn.example/**", (route) => route.abort());
  const broken = makeOverview({
    source: { ...makeOverview().source, title: "Broken picture", thumbnailUrl: "https://cdn.example/missing.jpg" },
  });
  backendSimulator.overviews.seed(broken);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.cardWithTitle("Broken picture").verifyHasNoThumbnail();
  const reader = await library.cardWithTitle("Broken picture").openReaderFromTitle();
  const back = await reader.clickBackToLibrary();
  await back.cardWithTitle("Broken picture").verifyHasNoThumbnail();

  await expect
    .poll(() => libraryEvents(backendSimulator).filter(({ name }) => name === "library.overviewCard.imageFailed"))
    .toEqual([{ name: "library.overviewCard.imageFailed", props: { kind: "youtube", layout: "row", plan: "free" } }]);
});
