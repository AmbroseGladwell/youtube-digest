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
    video: { ...makeOverview().video, title: "Grid batteries" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(grid);
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Sourdough" } }));
  return grid;
};

test("filtering names a topic by its id and a verdict by its value, and says where it was changed", async ({
  launcher,
  backendSimulator,
}) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.filterPanel.clickTopicChip(ENERGY.id);
  await library.filterPanel.clickNoveltyChip("common_knowledge");

  await expect
    .poll(() => libraryEvents(backendSimulator))
    .toEqual([
      { name: "library.filters.topicChosen", props: { topicId: ENERGY.id, from: "panel" } },
      { name: "library.filters.moreShown", props: { shown: true } },
      { name: "library.filters.noveltyChosen", props: { novelty: "common_knowledge", from: "panel" } },
    ]);
});

test("searching the library is counted once the reader stops typing, with how many it found and never the words", async ({
  launcher,
  backendSimulator,
}) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.search("sourdough");
  await expect.poll(() => libraryEvents(backendSimulator)).toEqual([
    { name: "library.search.searched", props: { results: 1 } },
  ]);
  await library.clearTheSearch();

  await expect.poll(() => libraryEvents(backendSimulator).at(-1)).toEqual({ name: "library.search.cleared", props: {} });
  expect(JSON.stringify(backendSimulator.analytics.batches())).not.toContain("sourdough");
});

test("a row's read and favourite are counted with the state chosen and the overview's id, and so is opening it", async ({
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
      { name: "library.overviewCard.readSwitched", props: { overviewId, read: true } },
      { name: "library.overviewCard.favouriteSwitched", props: { overviewId, favourite: true } },
      { name: "library.overviewCard.opened", props: { overviewId, from: "title" } },
    ]);
});

test("picking an order is counted by the order's own name", async ({ launcher, backendSimulator }) => {
  seed(backendSimulator);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.sortPill.sortBy("title");

  await expect
    .poll(() => libraryEvents(backendSimulator))
    .toEqual([
      { name: "library.sortPill.opened", props: {} },
      { name: "library.sortPill.orderChosen", props: { sort: "title" } },
    ]);
});
