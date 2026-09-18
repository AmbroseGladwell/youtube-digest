import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const unsortedOverview = (title: string) =>
  makeOverview({ video: { ...makeOverview().video, title, channel: "Practical Engineering" } });

test("the rail offers a new topic even when the library has none to filter by", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(unsortedOverview("The Quiet Return of Nuclear Baseload"));

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.verifyOffersNoTopics();

  const dialog = await library.openNewTopic();
  await dialog.verifyHintReads("Overviews that fit it are filed here from now on.");
  await dialog.verifyCreateIsDisabled(true);
});

test("naming the topic says what it will do, and creating it makes it filterable", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(unsortedOverview("The Quiet Return of Nuclear Baseload"));

  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.openNewTopic();

  await dialog.typeName("climate");
  await dialog.verifyHintReads("Overviews that fit “climate” are filed here from now on.");
  await dialog.verifyCreateReads("Create topic");
  await dialog.clickCreate();

  await dialog.verifyIsNotShown();
  await library.filterPanel.verifyOffersTopic("climate");
});

test("unsorted overviews can be moved in as the topic is made, and the button counts them", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(unsortedOverview("The Quiet Return of Nuclear Baseload"));
  backendSimulator.overviews.seed(unsortedOverview("What a Heat Pump Actually Costs to Run"));

  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.openNewTopic();

  await dialog.verifyUnsortedHeadReads("Add from unsorted · 2");
  await dialog.typeName("climate");
  await dialog.chooseUnsorted("The Quiet Return of Nuclear Baseload");
  await dialog.verifyCreateReads("Create topic · 1 overview");
  await dialog.chooseUnsorted("What a Heat Pump Actually Costs to Run");
  await dialog.verifyCreateReads("Create topic · 2 overviews");
  await dialog.clickCreate();

  const overviews = await backendSimulator.overviewStore.listOverviews();
  expect(overviews.every((overview) => overview.topicIds.length === 1)).toBe(true);
});

test("a library with nothing unsorted offers no list to move in", async ({
  launcher,
  backendSimulator,
}) => {
  const topic = makeTopic({ name: "energy" });
  backendSimulator.overviews.seedTopic(topic);
  backendSimulator.overviews.seed(
    makeOverview({ topicIds: [topic.id], video: { ...makeOverview().video, title: "Already filed" } }),
  );

  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.openNewTopic();

  await dialog.verifyOffersNoUnsorted();
});

test("escape leaves the dialog without making a topic", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(unsortedOverview("The Quiet Return of Nuclear Baseload"));

  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.openNewTopic();
  await dialog.typeName("climate");
  await dialog.pressEscape();

  await dialog.verifyIsNotShown();
  expect(await backendSimulator.overviewStore.listTopics()).toHaveLength(0);
});
