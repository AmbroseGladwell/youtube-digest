import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview, makeOverviewState } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../../../src/features/overviews/types/TopicFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const DESKTOP = { width: 1440, height: 900 };
const TABLET_PORTRAIT = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
const PHONE_ON_ITS_SIDE = { width: 844, height: 390 };

const seed = (backendSimulator: BackendSimulator) => {
  const psychology = makeTopic({ name: "Psychology" });
  const food = makeTopic({ name: "Food" });
  backendSimulator.overviews.seedTopic(psychology);
  backendSimulator.overviews.seedTopic(food);
  const titled = (title: string, topicIds: string[]) => makeOverview({ source: { ...makeOverview().source, title }, topicIds } as never);
  const minds = titled("How habits form", [psychology.id]);
  const moods = titled("Why moods pass", [psychology.id]);
  const stew = titled("A stew for the week", [food.id]);
  for (const overview of [minds, moods, stew]) {
    backendSimulator.overviews.seed(overview);
  }
  backendSimulator.overviews.seedState(makeOverviewState(minds.id, { read: true }));
  const kitchen = makeProject();
  backendSimulator.projects.seed(kitchen);
  backendSimulator.projects.seedMember(makeProjectMember(kitchen, stew.id));
};

const navEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("app.nav.") || name.startsWith("app.sidebar."));

test.describe("wide screens", () => {
  test("the sidebar lists the pages, projects and topics, and marks where the reader is", async ({ launcher, backendSimulator, page }) => {
    seed(backendSimulator);
    await page.setViewportSize(DESKTOP);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const sidebar = await library.sidebar.verifyIsShown();

    await sidebar.verifyCurrentPage("Overviews");
    await sidebar.verifyListsProjects(["Kitchen renovation"]);
    await sidebar.verifyListsTopics(["Psychology", "Food"]);
    await sidebar.verifyTopicNamed("Psychology", "Psychology, 2 overviews, 1 unread");

    await sidebar.openPage("Projects");
    await sidebar.verifyCurrentPage("Projects");
    await launcher.appShell.openAsk();
    await sidebar.verifyCurrentPage(null);
    await launcher.appShell.verifyAskIsCurrent(true);

    await expect
      .poll(() => navEvents(backendSimulator))
      .toEqual([
        { name: "app.nav.pageChosen", props: { page: "projects", from: "sidebar" } },
        { name: "app.nav.pageChosen", props: { page: "ask", from: "masthead" } },
      ]);
  });

  test("a topic in the sidebar becomes the page's title, and choosing it again goes back to every overview", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seed(backendSimulator);
    await page.setViewportSize(DESKTOP);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.sidebar.chooseTopic("Psychology");

    await library.verifyTitleReads("Psychology", "Topic · 2 overviews · 1 unread");
    await library.sidebar.verifyTopicIsChosen("Psychology", true);
    await library.sidebar.verifyCurrentPage(null);
    await library.verifyChipsRead(["Psychology"]);

    await library.sidebar.chooseTopic("Psychology");
    await library.verifyTitleReads("Overviews", "3 overviews · 2 unread");
    await library.sidebar.verifyTopicIsChosen("Psychology", false);
    await expect
      .poll(() => navEvents(backendSimulator))
      .toEqual([
        { name: "app.nav.quickAccessChosen", props: { kind: "topic" } },
        { name: "app.nav.quickAccessChosen", props: { kind: "topic" } },
      ]);
  });

  test("hiding the sidebar hands focus to the button that brings it back, [ does the same, and the choice is kept", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seed(backendSimulator);
    await page.setViewportSize(DESKTOP);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const sidebar = library.sidebar;

    await sidebar.clickHide();
    await sidebar.verifyIsHidden();
    await sidebar.verifyShowButtonIsFocused();
    await sidebar.clickShow();
    await sidebar.verifyIsShown();
    await sidebar.verifyHideButtonIsFocused();

    await page.keyboard.press("[");
    await sidebar.verifyIsHidden();
    await launcher.openPage(Routes.settings());
    await launcher.openPage(Routes.home());
    await sidebar.verifyIsHidden();
    await sidebar.verifyOffersShow(true);

    await expect
      .poll(() => navEvents(backendSimulator))
      .toEqual([
        { name: "app.sidebar.toggled", props: { open: false, by: "button" } },
        { name: "app.sidebar.toggled", props: { open: true, by: "button" } },
        { name: "app.sidebar.toggled", props: { open: false, by: "key" } },
      ]);
  });

  test("[ typed into the search is just a character", async ({ launcher, backendSimulator, page }) => {
    seed(backendSimulator);
    await page.setViewportSize(DESKTOP);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.typeInTheSearch("[");

    await library.sidebar.verifyIsShown();
  });

  test("a tablet held upright starts with the sidebar hidden, and opening it narrows the list beside it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seed(backendSimulator);
    await page.setViewportSize(TABLET_PORTRAIT);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.sidebar.verifyIsHidden();
    await library.verifyTimeSavedSays("0 minutes");
    await library.sidebar.clickShow();

    await library.sidebar.verifyIsShown();
    await library.verifyListStartsRightOfTheSidebar();
  });

  test("pages without a list of overviews have no sidebar", async ({ launcher, backendSimulator, page }) => {
    seed(backendSimulator);
    await page.setViewportSize(DESKTOP);
    await launcher.launchExpectingLibrary(SIGNED_IN);

    await launcher.openPage(Routes.settings());

    await launcher.appShell.sidebar.verifyIsAbsent();
  });
});

test.describe("phones", () => {
  test("the bar holds Overviews and Projects as icons, marking the page the reader is on, and no sidebar", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seed(backendSimulator);
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const shell = launcher.appShell;

    await library.sidebar.verifyIsAbsent();
    await shell.verifyBarMarksPage("Overviews");
    await shell.openProjectsFromBar();
    await shell.verifyBarMarksPage("Projects");
    await shell.openAsk();
    await shell.verifyBarMarksPage("Ask");
    await shell.openOverviewsFromBar();
    await shell.verifyBarMarksPage("Overviews");

    await expect
      .poll(() => navEvents(backendSimulator))
      .toEqual([
        { name: "app.nav.pageChosen", props: { page: "projects", from: "masthead" } },
        { name: "app.nav.pageChosen", props: { page: "ask", from: "masthead" } },
        { name: "app.nav.pageChosen", props: { page: "overviews", from: "masthead" } },
      ]);
  });
});

test.describe("a phone on its side", () => {
  test.use({ hasTouch: true });

  test("keeps the phone's bar, with no sidebar", async ({ launcher, backendSimulator, page }) => {
    seed(backendSimulator);
    await page.setViewportSize(PHONE_ON_ITS_SIDE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);

    await library.sidebar.verifyIsAbsent();
    await launcher.appShell.verifyBarOffersPages(true);
  });
});
