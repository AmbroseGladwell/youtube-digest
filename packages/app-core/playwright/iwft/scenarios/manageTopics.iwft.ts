import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const DESKTOP = { width: 1440, height: 900 };

const HEALTH = makeTopic({ name: "Health", description: "Wellbeing, illness and medical care." });
const FITNESS = makeTopic({ name: "Fitness", description: "Exercise, training and sport." });
const FILM = makeTopic({ name: "Film", description: "Films, including TV." });
const PARENTING = makeTopic({ name: "Parenting" });
const BEING_A_DAD = makeTopic({ name: "Being a dad" });

const filed = (title: string, topicIds: string[]) => makeOverview({ source: { ...makeOverview().source, title }, topicIds } as never);

const RUN = filed("Run", [HEALTH.id, FITNESS.id]);
const SLEEP = filed("Sleep", [HEALTH.id]);
const LIFT = filed("Lift", [FITNESS.id]);
const MOVIE = filed("Movie", [FILM.id]);
const TODDLER = filed("Toddler", [PARENTING.id]);
const BEDTIME = filed("Bedtime", [BEING_A_DAD.id]);

const seedLibrary = (backendSimulator: BackendSimulator) => {
  for (const topic of [HEALTH, FITNESS, FILM, PARENTING, BEING_A_DAD]) {
    backendSimulator.overviews.seedTopic(topic);
  }
  for (const overview of [RUN, SLEEP, LIFT, MOVIE, TODDLER, BEDTIME]) {
    backendSimulator.overviews.seed(overview);
  }
};

const topicIdsOf = async (backendSimulator: BackendSimulator, overview: { id: Parameters<BackendSimulator["overviews"]["get"]>[0] }) =>
  (await backendSimulator.overviews.get(overview.id))?.topicIds;

const topicNames = async (backendSimulator: BackendSimulator) =>
  (await backendSimulator.overviewStore.listTopics()).map(({ name, description }) => `${name}: ${description ?? "none"}`).sort();

const topicEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("library.manageTopics."));

test("Manage topics lists every topic with its description and count, most used first or A–Z, and finds one", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  const dialog = await library.filterMenu.openManageTopics();

  await dialog.verifySummaryReads("5 topics on 6 overviews. Changes apply to every overview filed under the topic.");
  await dialog.verifyRowsRead([
    "FitnessExercise, training and sport.2 overviews",
    "HealthWellbeing, illness and medical care.2 overviews",
    "Being a dad1 overview",
    "FilmFilms, including TV.1 overview",
    "Parenting1 overview",
  ]);
  await dialog.verifyBarHintReads("Select topics to rename, merge or delete them.");
  await dialog.find("ent");
  await dialog.verifyRowsRead(["Parenting1 overview"]);
  await dialog.find("");
  await dialog.sortBy("name");
  await dialog.verifyRowsRead([
    "Being a dad1 overview",
    "FilmFilms, including TV.1 overview",
    "FitnessExercise, training and sport.2 overviews",
    "HealthWellbeing, illness and medical care.2 overviews",
    "Parenting1 overview",
  ]);
  await dialog.select("Film");
  await dialog.verifyBarOffers({ rename: true, merge: false });
  await dialog.select("Parenting");
  await dialog.verifyBarOffers({ rename: false, merge: true });
});

test("renaming edits the description with it, asks for a look when only the name moved, and can clear it", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();

  await dialog.select("Film");
  await dialog.startRename();
  await dialog.verifyRenameFields("Film", "Films, including TV.");
  await dialog.verifyDescriptionLook(null);
  await dialog.typeName("Documentaries");
  await dialog.verifyDescriptionLook("You changed the name. Does this still describe Documentaries?");
  await dialog.verifyRenameSays(null, "Save");
  await dialog.clearDescription();
  await dialog.verifyDescriptionLook(null);
  await dialog.saveRename();

  await expect.poll(() => topicNames(backendSimulator)).toContain("Documentaries: none");
  await dialog.verifyRowsRead([
    "FitnessExercise, training and sport.2 overviews",
    "HealthWellbeing, illness and medical care.2 overviews",
    "Being a dad1 overview",
    "Documentaries1 overview",
    "Parenting1 overview",
  ]);
});

test("a blank name is refused, and a name another topic has turns Save into Merge… and opens the merge step", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();

  await dialog.select("Being a dad");
  await dialog.startRename();
  await dialog.typeName("  ");
  await dialog.verifyRenameSays("A topic needs a name.", "Save");
  await dialog.verifySaveIsRefused();
  await dialog.typeName("parenting ");
  await dialog.verifyRenameSays("Parenting already exists. Saving will merge Being a dad into it.", "Merge…");
  await dialog.saveRename();

  await dialog.verifyKeptName("Parenting");
  await dialog.verifyMergeSays("2 overviews will be in Parenting. Undo puts everything back, the description too.", "Merge into Parenting");
});

test("merging files every overview under the kept topic once, edits its description, and Undo puts it all back", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();

  await dialog.select("Health", "Fitness");
  await dialog.openMerge();
  await dialog.verifyKeptName("Fitness");
  await dialog.keepName("Health");
  await dialog.verifyKeptDescription("Wellbeing, illness and medical care.");
  await dialog.verifyBorrowNoteReads("From Health. Fitness had “Exercise, training and sport.”");
  await dialog.keepNewName("Health & fitness");
  await dialog.typeDescription("Wellbeing, exercise, training, illness and medical care.");
  await dialog.verifyMergeSays(
    "3 overviews will be in Health & fitness. Undo puts everything back, the description too.",
    "Merge into Health & fitness",
  );
  await dialog.confirmMerge();

  await dialog.verifyNoticeReads("Merged 2 topics into Health & fitness, now on 3 overviews.", true);
  await expect.poll(() => topicIdsOf(backendSimulator, RUN)).toHaveLength(1);
  await expect
    .poll(() => topicNames(backendSimulator))
    .toContain("Health & fitness: Wellbeing, exercise, training, illness and medical care.");
  const kept = (await topicIdsOf(backendSimulator, RUN))![0];
  await expect.poll(() => topicIdsOf(backendSimulator, LIFT)).toEqual([kept]);

  await dialog.undo();

  await expect
    .poll(() => topicNames(backendSimulator))
    .toEqual([
      "Being a dad: none",
      "Film: Films, including TV.",
      "Fitness: Exercise, training and sport.",
      "Health: Wellbeing, illness and medical care.",
      "Parenting: none",
    ]);
  await expect.poll(() => topicIdsOf(backendSimulator, RUN)).toEqual([FITNESS.id, HEALTH.id]);
  await expect.poll(() => topicIdsOf(backendSimulator, LIFT)).toEqual([FITNESS.id]);
});

test("closing straight after a merge hands its Undo to the toast", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();
  await dialog.select("Parenting", "Being a dad");
  await dialog.openMerge();
  await dialog.confirmMerge();
  await dialog.verifyNoticeReads("Merged 2 topics into Being a dad, now on 2 overviews.", true);

  await dialog.close();

  await library.toast.verifyReads("Merged 2 topics into Being a dadUndo");
  await library.toast.clickUndo();
  await expect.poll(() => topicIdsOf(backendSimulator, TODDLER)).toEqual([PARENTING.id]);
});

test("deleting asks first with focus on Keep, Keep changes nothing, and Delete unfiles the topic", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();

  await dialog.select("Fitness");
  await dialog.delete();
  await dialog.verifyDeleteAsks("Delete Fitness?It’s on 2 overviews. They stay in your library; 1 will have no topic.");
  await dialog.keep();
  await dialog.verifyRowsRead([
    "FitnessExercise, training and sport.2 overviews",
    "HealthWellbeing, illness and medical care.2 overviews",
    "Being a dad1 overview",
    "FilmFilms, including TV.1 overview",
    "Parenting1 overview",
  ]);

  await dialog.delete();
  await dialog.confirmDelete();

  await dialog.verifyNoticeReads("Deleted Fitness. 1 overview has no topic now.", false);
  await expect.poll(() => topicIdsOf(backendSimulator, LIFT)).toEqual([]);
  await expect.poll(() => topicIdsOf(backendSimulator, RUN)).toEqual([HEALTH.id]);
});

test("several topics delete together, named in the question", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterMenu.openManageTopics();

  await dialog.select("Parenting", "Being a dad", "Film");
  await dialog.delete();
  await dialog.verifyDeleteAsks(
    "Delete 3 topics?Parenting, Being a dad and FilmThey’re on 3 overviews. Those stay in your library; 3 will have no topic.",
  );
  await dialog.confirmDelete();

  await dialog.verifyNoticeReads("Deleted 3 topics. 3 overviews have no topic now.", false);
});

test.describe("wide screens", () => {
  test("the sidebar offers Manage under its topics, and a topic's page opens one step for that topic", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seedLibrary(backendSimulator);
    await page.setViewportSize(DESKTOP);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    const fromSidebar = await library.sidebar.openManageTopics();
    await fromSidebar.verifySummaryReads("5 topics on 6 overviews. Changes apply to every overview filed under the topic.");
    await fromSidebar.close();

    await library.sidebar.chooseTopic("Film");
    const renaming = await library.openTopicAction("rename");
    await renaming.verifyRenameFields("Film", "Films, including TV.");
    await renaming.pressEscape();
    await renaming.pressEscape();
    await renaming.verifyIsClosed();

    const deleting = await library.openTopicAction("delete");
    await deleting.verifyDeleteAsks("Delete Film?It’s on 1 overview. It stays in your library; 1 will have no topic.");
    await deleting.confirmDelete();
    await deleting.close();

    await library.verifyTitleReads("Overviews", "6 overviews · 6 unread");
    await expect
      .poll(() => topicEvents(backendSimulator).map(({ name, props }) => ({ name, from: props.from, plan: props.plan })))
      .toEqual([
        { name: "library.manageTopics.opened", from: "sidebar", plan: "free" },
        { name: "library.manageTopics.closed", from: undefined, plan: "free" },
        { name: "library.manageTopics.opened", from: "topicPage", plan: "free" },
        { name: "library.manageTopics.closed", from: undefined, plan: "free" },
        { name: "library.manageTopics.opened", from: "topicPage", plan: "free" },
        { name: "library.manageTopics.deleteAsked", from: undefined, plan: "free" },
        { name: "library.manageTopics.deleted", from: undefined, plan: "free" },
        { name: "library.manageTopics.closed", from: undefined, plan: "free" },
      ]);
  });
});

test("with no topics, nothing offers to manage them", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.overviews.seed(makeOverview());
  await page.setViewportSize(DESKTOP);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);

  await library.sidebar.verifyOffersManageTopics(false);
  await library.filterMenu.verifyOffersNoManageTopics();
});
