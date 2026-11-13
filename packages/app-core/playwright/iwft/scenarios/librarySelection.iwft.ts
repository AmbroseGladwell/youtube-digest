import type { Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const HOME = makeTopic({ name: "Home" });
const MONEY = makeTopic({ name: "Money" });

const titled = (title: string, savedAt: string, overrides: Partial<Overview> = {}) =>
  makeOverview({ savedAt, source: { ...makeOverview().source, title }, ...overrides });

const layout = titled("The kitchen layout mistakes I see every week", "2026-11-08T09:00:00.000Z", { topicIds: [HOME.id] });
const sink = titled("What moving a sink really costs", "2026-11-09T09:00:00.000Z", { topicIds: [HOME.id] });
const quote = titled("How to read a builder’s quote", "2026-11-10T09:00:00.000Z", { topicIds: [HOME.id, MONEY.id] });
const spanish = titled("Stop studying Spanish, start listening", "2026-11-11T09:00:00.000Z");
const kitchen = makeProject();

const seed = (backendSimulator: BackendSimulator) => {
  for (const topic of [HOME, MONEY]) backendSimulator.overviews.seedTopic(topic);
  for (const overview of [layout, sink, quote, spanish]) backendSimulator.overviews.seed(overview);
  backendSimulator.projects.seed(kitchen);
  backendSimulator.projects.seedMember(makeProjectMember(kitchen, layout.id));
};

const pickAll = async (library: { pick: (title: string) => Promise<unknown> }, titles: string[]) => {
  for (const title of titles) await library.pick(title);
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

test.describe("selecting on the web", () => {
  test("the select button is the one way in, and × or Escape stops it", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();

    await library.verifySelectButtonReads("Select");
    await library.selectionBar.verifyIsShown(false);
    await library.startSelecting();

    await library.verifySelectButtonReads("Stop selecting");
    await library.verifyCountReads("Click to select");
    await library.selectionBar.verifyIsEnabled(false);
    await library.pick("What moving a sink");
    await library.pick("How to read a builder");
    await library.verifyPicked("What moving a sink", true);
    await library.verifyPicked("Stop studying Spanish", false);
    await library.verifyCountReads("2 selected");
    await library.selectionBar.verifyCountReads("2 selected");
    await library.selectionBar.verifyActionsAreNamed(["Add to project…", "Add to topic…", "Mark read", "Favourite", "Delete…"]);

    await library.stopSelecting();
    await library.selectionBar.verifyIsShown(false);
    await library.verifyCountReads("4 overviews · 4 unread");

    await library.startSelecting();
    await library.verifyCountReads("Click to select");
    await library.page.keyboard.press("Escape");
    await library.selectionBar.verifyIsShown(false);
  });

  test("ticking a row opens nothing", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    await library.startSelecting();

    await library.pick("What moving a sink");
    await library.pick("What moving a sink");

    await library.verifyIsShown();
    await library.verifyPicked("What moving a sink", false);
  });

  test("Add to project… files them all, shows a dash where some are in, and a tick gives it to all", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    await library.startSelecting();
    await pickAll(library, ["The kitchen layout", "What moving a sink", "How to read a builder"]);

    const picker = await library.selectionBar.addToProject();
    await picker.verifyHeadingReads("Projects for 3 overviews");
    await picker.verifyIsMixed("Kitchen renovation");
    await picker.verifyFootReads("Kitchen renovation on 1");
    await picker.tick("Kitchen renovation");

    await picker.verifyIsTicked("Kitchen renovation", true);
    await picker.verifyFootReads("Kitchen renovation on all 3");
    await expect.poll(async () => (await backendSimulator.projects.members()).length).toBe(3);
    await expect
      .poll(() => backendSimulator.analytics.events().filter((event) => event.name === "projects.membership.added"))
      .toEqual([
        expect.objectContaining({ props: expect.objectContaining({ overviewId: quote.id, from: "selection" }) }),
        expect.objectContaining({ props: expect.objectContaining({ overviewId: sink.id, from: "selection" }) }),
      ]);

    await picker.tick("Kitchen renovation");
    await picker.verifyFootReads("None of them is in a project yet");
    await expect.poll(async () => (await backendSimulator.projects.members()).length).toBe(0);
  });

  test("New project… from the bar makes one with every selected overview in it", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    await library.startSelecting();
    await pickAll(library, ["What moving a sink", "How to read a builder"]);

    const picker = await library.selectionBar.addToProject();
    const dialog = await picker.clickNewProject();
    await dialog.verifyAddsReads("Also adds 2 overviews");
    await dialog.typeName("Bathroom");
    await dialog.clickCreate();

    await library.verifyIsShown();
    await library.projectsRail.verifyListsProjects(["Bathroom", "Kitchen renovation"]);
    await expect
      .poll(async () => (await backendSimulator.projects.members()).filter((member) => member.projectId !== kitchen.id).length)
      .toBe(2);
  });

  test("Add to topic… shows which some have, gives a ticked topic to all, and makes a new one for all", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    await library.startSelecting();
    await pickAll(library, ["What moving a sink", "How to read a builder", "Stop studying Spanish"]);

    const picker = await library.selectionBar.addToTopic();
    await picker.verifyHeadingReads("Topics for 3 overviews");
    await picker.verifyOptionState("Home", "some");
    await picker.verifyOptionReads("Money", "Money1 of 3 have it1");
    await picker.verifyFootReads("Home on 2 · Money on 1");

    await picker.tick("Home");
    await picker.verifyOptionState("Home", "all");
    await expect.poll(async () => (await backendSimulator.overviews.get(spanish.id))?.topicIds).toEqual([HOME.id]);

    await picker.tick("Home");
    await picker.verifyOptionState("Home", "none");
    await expect.poll(async () => (await backendSimulator.overviews.get(quote.id))?.topicIds).toEqual([MONEY.id]);

    await picker.makeTopic("Renovation");
    await picker.verifyOptionState("Renovation", "all");
    await picker.verifyFootReads("Money on 1 · Renovation on all 3");
  });

  test("Mark read turns to Mark unread once all are read, and the heart fills once all are favourites", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    backendSimulator.overviews.seedState({ overviewId: sink.id, read: true, favourite: true, userTags: [] });
    const library = await launcher.launchExpectingLibrary();
    await library.filterPanel.clickStatusChip("unread");
    await library.startSelecting();
    await pickAll(library, ["What moving a sink", "How to read a builder"]);

    await library.selectionBar.verifyReadReads("Mark read");
    await library.selectionBar.verifyFavouriteIsPressed(false);
    await library.selectionBar.toggleRead();
    await library.selectionBar.toggleFavourite();

    await library.selectionBar.verifyReadReads("Mark unread");
    await library.selectionBar.verifyFavouriteIsPressed(true);
    await expect.poll(async () => (await backendSimulator.overviews.getState(quote.id))?.read).toBe(true);
    await expect.poll(async () => (await backendSimulator.overviews.getState(quote.id))?.favourite).toBe(true);

    await library.selectionBar.toggleRead();
    await expect.poll(async () => (await backendSimulator.overviews.getState(sink.id))?.read).toBe(false);
  });

  test("Delete… asks with the count and Cancel focused, then takes them from the library and their projects", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    await library.startSelecting();
    await pickAll(library, ["The kitchen layout", "What moving a sink"]);

    const dialog = await library.selectionBar.delete();
    await dialog.verifyReads(
      "Delete 2 overviews?",
      "They go from your library on every device, and from any projects they’re in. You can’t undo this.",
    );
    await dialog.verifyCancelIsFocused();
    await dialog.verifyDeleteReads("Delete 2 overviews");
    await dialog.cancel();
    await library.expectCardCountToBe(4);

    await (await library.selectionBar.delete()).confirm();

    await library.expectCardCountToBe(2);
    await library.verifyCountReads("Click to select");
    await library.projectsRail.verifyRowReads("Kitchen renovation", "Kitchen renovation0");
    await expect
      .poll(() => backendSimulator.analytics.events().filter((event) => event.name === "library.selection.deleted"))
      .toEqual([{ name: "library.selection.deleted", props: { overviews: 2 } }]);
  });
});

test.describe("selecting in a project", () => {
  test("the bar adds Remove from the project, which takes them out", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    backendSimulator.projects.seedMember(makeProjectMember(kitchen, sink.id));
    const library = await launcher.launchExpectingLibrary();
    await library.projectsRail.openProject("Kitchen renovation");

    await library.startSelecting();
    await library.verifySelectionLineReads("Click to select");
    await library.pick("What moving a sink");
    await library.verifySelectionLineReads("1 selected");
    await library.selectionBar.verifyActionsAreNamed([
      "Add to project…",
      "Add to topic…",
      "Mark read",
      "Favourite",
      "Remove from Kitchen renovation",
      "Delete…",
    ]);
    await library.selectionBar.removeFromProject();

    await library.verifyCardOrder(["The kitchen layout"]);
    await library.verifySelectionLineReads("Click to select");
    await expect.poll(async () => (await backendSimulator.projects.members()).map((member) => member.overviewId)).toEqual([layout.id]);
  });
});

test.describe("on a phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
  });

  test("search folds into an icon, opens across the row, keeps a query, and × folds it back", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();

    await library.verifySearchIsFolded(true);
    await library.verifySearchIconIsCentred();
    await library.openSearch();
    await library.verifySearchIsFolded(false);
    await library.verifySearchIsFocused();

    await library.search("sink");
    await library.blurTheSearch();
    await library.verifySearchReads("sink");
    await library.verifyOffersToClearTheSearch(true);
    await library.expectCardCountToBe(1);

    await library.clearTheSearch();
    await library.verifySearchIsFolded(true);
    await library.expectCardCountToBe(4);

    await library.openSearch();
    await library.pressEscapeInTheSearch();
    await library.verifySearchIsFolded(true);
  });

  test("the bar is icons alone, each named", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();

    await library.startSelecting();
    await library.pick("What moving a sink");

    await library.verifyCountReads("1 selected");
    await library.selectionBar.verifyActionsAreNamed(["Add to project", "Add to topic", "Mark read", "Favourite", "Delete"]);
  });
});
