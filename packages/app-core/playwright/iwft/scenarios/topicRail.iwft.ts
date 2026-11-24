import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const NAMES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
const TOPICS = NAMES.map((name) => makeTopic({ name }));
const FIRST_SEVEN = NAMES.slice(0, 7);

const seedTopics = (backendSimulator: BackendSimulator, count: number) => {
  for (const topic of TOPICS.slice(0, count)) {
    backendSimulator.overviews.seedTopic(topic);
  }
  backendSimulator.overviews.seed(makeOverview({ topicIds: [TOPICS[0]!.id] }));
};

test("a handful of topics are all listed, with nothing held back", async ({ launcher, backendSimulator }) => {
  seedTopics(backendSimulator, 4);

  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.verifyListsTopics(NAMES.slice(0, 4));
  await library.filterMenu.verifyOffersNoShowAll();
});

test("a long list stops at seven, and says how many there are in total", async ({ launcher, backendSimulator }) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.verifyListsTopics(FIRST_SEVEN);
  await library.filterMenu.verifyShowAllReads("Show all 8 topics");
});

test("showing all reveals the rest, and the same control puts them away again", async ({ launcher, backendSimulator }) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();
  await library.filterMenu.clickShowAllTopics();

  await library.filterMenu.verifyListsTopics(NAMES);
  await library.filterMenu.verifyShowAllReads("Show fewer");

  await library.filterMenu.clickShowAllTopics();
  await library.filterMenu.verifyListsTopics(FIRST_SEVEN);
});

test("the topic being filtered by stays listed even from beyond the seventh", async ({ launcher, backendSimulator }) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();
  await library.filterMenu.clickShowAllTopics();
  await library.filterMenu.clickTopicChip(TOPICS[7]!.id);
  await library.filterMenu.clickShowAllTopics();

  await library.filterMenu.verifyListsTopics([...FIRST_SEVEN, "eight"]);
});
