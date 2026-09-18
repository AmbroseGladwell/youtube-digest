import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const NAMES = ["one", "two", "three", "four", "five", "six", "seven", "eight"];
const TOPICS = NAMES.map((name) => makeTopic({ name }));
const FIRST_SIX = NAMES.slice(0, 6);

const seedTopics = (backendSimulator: BackendSimulator, count: number) => {
  for (const topic of TOPICS.slice(0, count)) {
    backendSimulator.overviews.seedTopic(topic);
  }
  backendSimulator.overviews.seed(makeOverview({ topicIds: [TOPICS[0]!.id] }));
};

test("a handful of topics are all listed, with nothing held back", async ({
  launcher,
  backendSimulator,
}) => {
  seedTopics(backendSimulator, 4);

  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.verifyListsTopics(NAMES.slice(0, 4));
  await library.filterPanel.verifyOffersNoShowAll();
});

test("a long list stops at six, and says how many there are in total", async ({
  launcher,
  backendSimulator,
}) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.verifyListsTopics(FIRST_SIX);
  await library.filterPanel.verifyShowAllReads("Show all 8 topics");
});

test("showing all reveals the rest, and the same control puts them away again", async ({
  launcher,
  backendSimulator,
}) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickShowAllTopics();

  await library.filterPanel.verifyListsTopics(NAMES);
  await library.filterPanel.verifyShowAllReads("Show fewer");

  await library.filterPanel.clickShowAllTopics();
  await library.filterPanel.verifyListsTopics(FIRST_SIX);
});

// A filter you cannot see is a filter you cannot clear.
test("the topic being filtered by stays listed even from beyond the sixth", async ({
  launcher,
  backendSimulator,
}) => {
  seedTopics(backendSimulator, 8);

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickShowAllTopics();
  await library.filterPanel.clickTopicChip(TOPICS[7]!.id);
  await library.filterPanel.clickShowAllTopics();

  await library.filterPanel.verifyListsTopics([...FIRST_SIX, "eight"]);
});
