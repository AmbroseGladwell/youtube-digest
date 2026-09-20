import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const ENERGY = makeTopic({ name: "energy" });
const POLITICS = makeTopic({ name: "politics" });
const CLEAN_TECH = makeTopic({ name: "clean tech" });
const NUCLEAR = makeTopic({ name: "nuclear" });

const TITLE = "The Quiet Return of Nuclear Baseload";

const seedLibrary = (backendSimulator: BackendSimulator) => {
  for (const topic of [ENERGY, POLITICS, CLEAN_TECH, NUCLEAR]) {
    backendSimulator.overviews.seedTopic(topic);
  }
  const overview = makeOverview({
    topicIds: [ENERGY.id, POLITICS.id],
    video: { ...makeOverview().video, title: TITLE },
  });
  backendSimulator.overviews.seed(overview);
  backendSimulator.overviews.seed(
    makeOverview({
      topicIds: [CLEAN_TECH.id],
      video: { ...makeOverview().video, title: "A second note" },
    }),
  );
  return overview;
};

const openReader = async (launcher: Launcher, backendSimulator: BackendSimulator) => {
  const overview = seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle(TITLE).openReaderFromTitle();
  return { overview, reader };
};

test("reading, the topic line is the topics and nothing else", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);

  await reader.verifyFiledUnder(["energy", "politics"]);
  await reader.verifyTopicsAreEditable(false);
  await reader.topicPicker.verifyIsNotShown();
});

test("edit topics in the ⋯ menu opens the picker and makes the same line editable", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);

  await reader.openActionsMenu();
  await reader.verifyEditTopicsCountReads("2");
  await reader.clickEditTopics();

  await reader.verifyTopicsAreEditable(true);
  await reader.topicPicker.verifyIsShown();
});

test("the search narrows to the topics that contain what was typed", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.search("cl");

  await picker.verifyOffers(["clean tech", "nuclear"]);
  await picker.verifyOffersToCreate("cl");
});

test("a name no topic has is offered as a new one, and creating it files the overview there", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.search("climate");
  await picker.clickCreate();

  await reader.verifyFiledUnder(["energy", "politics", "climate"]);
  expect((await backendSimulator.overviews.get(overview.id))?.topicIds).toHaveLength(3);
});

test("a name a topic already has is not offered as a new one", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.search("Nuclear");

  await picker.verifyOffersNoCreate();
});

test("picking saves as you pick, and picking again takes it back off", async ({
  launcher,
  backendSimulator,
}) => {
  const { overview, reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.clickTopic("nuclear");
  await reader.verifyFiledUnder(["energy", "politics", "nuclear"]);
  await picker.verifyTopicIsPicked("nuclear", true);

  await picker.clickTopic("nuclear");
  await reader.verifyFiledUnder(["energy", "politics"]);
  await expect
    .poll(async () => (await backendSimulator.overviews.get(overview.id))?.topicIds.length)
    .toBe(2);
});

test("a chip's remove takes the overview out of that topic", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  await reader.editTopics();

  await reader.removeTopic("energy");

  await reader.verifyFiledUnder(["politics"]);
});

test("each topic is offered with how many overviews are already in it", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.search("clean");

  await picker.verifyOfferedCounts(["1"]);
});

test("escape closes the picker and hands the line back read-only", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.pressEscape();

  await picker.verifyIsNotShown();
  await reader.verifyTopicsAreEditable(false);
  await reader.verifyFiledUnder(["energy", "politics"]);
});

// Both of these and the picker's own Escape run through one useDismissOnOutside, so the
// uncovered halves are what would let a change to it break something quietly.
test("a pointer down outside the picker closes it, the same way Escape does", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await reader.clickAwayFromAnyPopover();

  await picker.verifyIsNotShown();
  await reader.verifyTopicsAreEditable(false);
});

test("the actions menu closes on Escape, and on a pointer down outside it", async ({
  launcher,
  backendSimulator,
}) => {
  const { reader } = await openReader(launcher, backendSimulator);

  await reader.openActionsMenu();
  await reader.verifyActionsMenuIsShown(true);
  await reader.pressEscape();
  await reader.verifyActionsMenuIsShown(false);

  await reader.openActionsMenu();
  await reader.verifyActionsMenuIsShown(true);
  await reader.clickAwayFromAnyPopover();
  await reader.verifyActionsMenuIsShown(false);
});

test("on a phone the same control arrives as a sheet, and Done closes it", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const { reader } = await openReader(launcher, backendSimulator);
  const picker = await reader.editTopics();

  await picker.verifyRestsOnTheWindowFoot();

  await picker.clickDone();
  await picker.verifyIsNotShown();
});
