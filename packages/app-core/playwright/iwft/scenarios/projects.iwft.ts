import type { Connection, Overview } from "@overview/domain";
import { projectMarkdown } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../../../src/features/projects/types/ProjectFactory.testHelper.js";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const CLAUDE = { by: "assistant" as const, connectionId: "claude", name: "Claude" };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const titled = (title: string, overrides: Partial<Overview> = {}) =>
  makeOverview({ source: { ...makeOverview().source, title, channel: "Build Better" }, ...overrides });

const judged = (title: string, novelty: "original" | "fresh_angle" | "common_knowledge", savedAt: string, dubious = false) =>
  titled(title, { savedAt, verdict: { novelty, standsOut: null, dubious, dubiousClaims: null, reasoning: "Because.", similarTo: [] } });

const connection = (overrides: Partial<Connection> = {}): Connection => ({
  id: "claude",
  clientName: "Claude",
  createdAt: "2026-09-12T12:00:00.000Z",
  lastUsedAt: "2026-11-12T12:00:00.000Z",
  readsProfile: true,
  writes: true,
  ...overrides,
});

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
});

test.describe("the rail", () => {
  test("with no projects it is a heading and New project, and making one opens its page", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("The kitchen layout mistakes I see every week"));

    const library = await launcher.launchExpectingLibrary();
    await library.projectsRail.verifyListsProjects([]);
    await library.projectsRail.verifyAllProjectsReads(null);

    const dialog = await library.projectsRail.clickNewProject();
    await dialog.verifyCreateIsDisabled(true);
    await dialog.verifyHelpReads("Say what you’re doing, by when, and what matters most.");
    await dialog.typeName("Kitchen renovation");
    await dialog.typePurpose("Redo the kitchen by March for £18k.");
    await dialog.verifyCountsRead("18 / 80", "35 / 280");
    await dialog.clickCreate();

    const head = await library.projectHead.verifyIsShown();
    await head.verifyNameReads("Kitchen renovation");
    await head.verifyKickerReads("Project·Made today");
    await head.verifyPurposeReads("Redo the kitchen by March for £18k.");
    await head.verifyFactsRead("0 overviews0 unreadUpdated today");
    await head.verifyEmptyOffersPrompt(null);
    await library.projectsRail.verifyListsProjects(["Kitchen renovation"]);
    await library.projectsRail.verifyIsCurrent("Kitchen renovation");
    await library.projectsRail.verifyAllProjectsReads("All projects");
    expect((await backendSimulator.projects.list()).map((project) => project.purposeBy)).toEqual([{ by: "reader" }]);
  });

  test("a name already taken can't be used again", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Anything"));
    backendSimulator.projects.seed(makeProject());

    const library = await launcher.launchExpectingLibrary();
    const dialog = await library.projectsRail.clickNewProject();
    await dialog.typeName("kitchen renovation ");

    await dialog.verifyTakenReads("You already have a project called “Kitchen renovation”.");
    await dialog.verifyCreateIsDisabled(true);
  });

  test("lists five last changed first, says Made by Claude, and cuts to All N projects with the archived counted", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(titled("Anything"));
    const names = ["One", "Two", "Three", "Four", "Five", "Six"];
    names.forEach((name, index) =>
      backendSimulator.projects.seed(
        makeProject({
          id: crypto.randomUUID() as never,
          name,
          createdAt: `2026-11-0${index + 1}T09:00:00.000Z`,
          createdBy: name === "Six" ? CLAUDE : { by: "reader" },
        }),
      ),
    );
    backendSimulator.projects.seed(makeProject({ id: crypto.randomUUID() as never, name: "Old", archivedAt: "2026-10-01T00:00:00.000Z" }));

    const library = await launcher.launchExpectingLibrary();

    await library.projectsRail.verifyListsProjects(["Six", "Five", "Four", "Three", "Two"]);
    await library.projectsRail.verifyRowReads("Six", "SixMade by Claude0");
    await library.projectsRail.verifyAllProjectsReads("All 6 projects · 1 archived");
  });
});

test.describe("a project's page", () => {
  const layout = judged("The kitchen layout mistakes I see every week", "fresh_angle", "2026-11-08T09:00:00.000Z");
  const sink = judged("What moving a sink really costs", "original", "2026-11-09T09:00:00.000Z");
  const quartz = judged("Quartz or granite: the honest answer", "common_knowledge", "2026-11-10T09:00:00.000Z", true);
  const elsewhere = titled("Stop studying Spanish, start listening");
  const project = makeProject();

  const seed = (backendSimulator: Parameters<Parameters<typeof test>[2]>[0]["backendSimulator"]) => {
    for (const overview of [layout, sink, quartz, elsewhere]) backendSimulator.overviews.seed(overview);
    backendSimulator.overviews.seedState({ overviewId: layout.id, read: true, favourite: false, userTags: [] });
    backendSimulator.projects.seed(project);
    backendSimulator.projects.seedMember(makeProjectMember(project, layout.id));
    backendSimulator.projects.seedMember(makeProjectMember(project, sink.id, { addedBy: CLAUDE, addedAt: "2026-11-11T09:00:00.000Z" }));
    backendSimulator.projects.seedMember(makeProjectMember(project, quartz.id, { addedBy: CLAUDE, addedAt: "2026-11-11T09:00:00.000Z" }));
  };

  test("opens from the rail with what it's for, counts, the spread, and only its own overviews, read or not", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();

    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.verifyKickerReads("Project·Made 4 Nov");
    await head.verifyPurposeReads("Redo the kitchen by March for £18k without moving the sink.");
    await head.verifyAssistantHintIsShown(false);
    await head.verifyFactsRead("3 overviews2 unreadUpdated 11 Nov");
    await head.verifySpreadReads("1 Original1 Fresh angle1 Widely covered1 dubious");
    await library.verifyCardOrder(["Quartz or granite", "What moving a sink", "The kitchen layout"]);
    await library.cardWithTitle("The kitchen layout").verifyAddedByReads(null);
    await library.cardWithTitle("What moving a sink").verifyAddedByReads("Added by Claude · 11 Nov·Remove");
  });

  test("taking out what an assistant added is silent and counted", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await library.cardWithTitle("What moving a sink").clickRemoveFromProject();

    await library.verifyCardOrder(["Quartz or granite", "The kitchen layout"]);
    await head.verifyFactsRead("2 overviews1 unreadUpdated 11 Nov");
    await expect
      .poll(() => backendSimulator.analytics.events().filter((event) => event.name === "projects.membership.removed"))
      .toEqual([
        { name: "projects.membership.removed", props: { projectId: project.id, overviewId: sink.id, addedBy: "assistant", from: "row" } },
      ]);
  });

  test("renames in place, and Escape leaves the name as it was", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.rename("Galley kitchen", "Escape");
    await head.verifyNameReads("Kitchen renovation");
    await head.verifyMenuIsFocused();

    await head.rename("Galley kitchen");
    await head.verifyNameReads("Galley kitchen");
    await library.projectsRail.verifyListsProjects(["Galley kitchen"]);
  });

  test("a purpose an assistant wrote says so until the reader saves their own", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    backendSimulator.connections.seed(connection());
    backendSimulator.projects.seed({ ...project, purposeBy: CLAUDE });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const head = await library.projectsRail.openProject("Kitchen renovation");
    await head.verifyAssistantHintIsShown(true);
    await head.verifyWrittenByReads("Written by Claude");

    await head.editPurpose("Redo the kitchen by March, ten days of work.");
    await head.verifyPurposeHelpReads("Saving makes it yours: “Written by Claude” goes.");
    await head.clickSave();

    await head.verifyPurposeReads("Redo the kitchen by March, ten days of work.");
    await head.verifyWrittenByReads(null);
  });

  test("without a purpose it invites one, mentioning an assistant only when one is connected", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    backendSimulator.projects.seed({ ...project, purpose: null, purposeBy: null });
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.verifyInvitesAPurpose(/like “Redo the kitchen by March for £18k”\. It sits at the top/);
    await head.addPurpose("Choose worktops and a builder.");
    await head.clickSave();

    await head.verifyPurposeReads("Choose worktops and a builder.");
  });

  test("Copy as Markdown copies the brief an assistant reads", async ({ launcher, backendSimulator, page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.clickCopy();

    await head.verifyCopyReads("Copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(
      projectMarkdown(project, [
        { overview: layout, read: true, addedBy: { by: "reader" } },
        { overview: sink, read: false, addedBy: CLAUDE },
        { overview: quartz, read: false, addedBy: CLAUDE },
      ]),
    );
  });

  test("archiving hides it from the rail and the index keeps it, with Restore in both places", async ({ launcher, backendSimulator }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.archive();

    await head.verifyArchivedStripReads("Archived today.Hidden from your projects. Restore brings it back.");
    await library.projectsRail.verifyListsProjects([]);
    await library.projectsRail.verifyAllProjectsReads("All projects · 1 archived");
    await head.clickRestore();
    await head.verifyArchivedStripReads(null);
    await head.archive();

    const index = await library.projectsRail.openAllProjects();
    await index.verifySummaryReads("0 projects · 1 archived");
    await index.showArchived();
    await index.restore("Kitchen renovation");
    await index.verifySummaryReads("1 project");
    await library.projectsRail.verifyListsProjects(["Kitchen renovation"]);
  });

  test("deleting asks first with Cancel focused, keeps the overviews and goes back to the library", async ({
    launcher,
    backendSimulator,
  }) => {
    seed(backendSimulator);
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    const dialog = await head.delete();
    await dialog.verifyCancelIsFocused();
    await dialog.verifyBodyReads(
      "Its 3 overviews stay in your library. The project goes from every device. You can’t undo this. To put it away instead, archive it.",
    );
    await dialog.clickDelete();

    await library.projectsRail.verifyListsProjects([]);
    expect(await backendSimulator.projects.list()).toEqual([]);
    expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(4);
  });

  test("left alone for 60 days, the page asks quietly whether it's still wanted, and Keep it puts that off", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(layout);
    backendSimulator.projects.seed({ ...project, createdAt: "2026-08-01T09:00:00.000Z" });
    backendSimulator.projects.seedMember(makeProjectMember(project, layout.id, { addedAt: "2026-09-03T09:00:00.000Z" }));
    const library = await launcher.launchExpectingLibrary();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.verifyNudgeReads("Nothing new since 3 September. Still working on this?");
    await head.clickKeep();

    await head.verifyNudgeReads(null);
  });

  test("an empty project offers an assistant that can write a prompt to fill it", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Anything"));
    backendSimulator.connections.seed(connection());
    backendSimulator.projects.seed(project);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.verifyEmptyOffersPrompt(
      "“Find anything I’ve saved in The Overview that helps with my project “Kitchen renovation”, and add it to the project.”",
    );
  });

  test("a read-only assistant counts as none for filling an empty project", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(titled("Anything"));
    backendSimulator.connections.seed(connection({ writes: false }));
    backendSimulator.projects.seed(project);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await head.verifyEmptyOffersPrompt(null);
    await head.verifyAssistantHintIsShown(true);
  });
});

test.describe("on an overview", () => {
  const layout = titled("The kitchen layout mistakes I see every week");
  const project = makeProject();

  test("Add to project… ticks it in at once, and the line under the byline says where it is", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(layout);
    backendSimulator.projects.seed(project);
    backendSimulator.projects.seed(
      makeProject({ id: crypto.randomUUID() as never, name: "Old one", archivedAt: "2026-10-01T00:00:00.000Z" }),
    );
    const library = await launcher.launchExpectingLibrary();
    const reader = await library.cardWithTitle("The kitchen layout").openReader();
    await reader.verifyProjectsLineReads(null);

    const picker = await reader.addToProject();
    await picker.verifyOffers(["Kitchen renovation"]);
    await picker.verifyFootReads("Not in a project yet");
    await picker.tick("Kitchen renovation");
    await picker.verifyFootReads("In 1 project");
    await picker.clickDone();

    await reader.verifyProjectsLineReads("In Kitchen renovation · Change");
    await reader.verifyMenuSaysInProjects("In 1");
    expect((await backendSimulator.projects.members()).map((member) => member.overviewId)).toEqual([layout.id]);
  });

  test("New project… from the picker says what it will add, and adds it", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(layout);
    const library = await launcher.launchExpectingLibrary();
    const reader = await library.cardWithTitle("The kitchen layout").openReader();

    const picker = await reader.addToProject();
    const dialog = await picker.clickNewProject();
    await dialog.verifyAddsReads("Also adds “The kitchen layout mistakes I see every week”");
    await dialog.typeName("Kitchen renovation");
    await dialog.clickCreate();

    await dialog.verifyIsNotShown();
    await reader.verifyProjectsLineReads("In Kitchen renovation · Change");
  });

  test("four or more projects show the latest two and how many more, which opens the list", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(layout);
    ["Kitchen renovation", "Lisbon move", "Learning Spanish", "Launching my app"].forEach((name, index) => {
      const each = makeProject({ id: crypto.randomUUID() as never, name });
      backendSimulator.projects.seed(each);
      backendSimulator.projects.seedMember(makeProjectMember(each, layout.id, { addedAt: `2026-11-1${index}T09:00:00.000Z` }));
    });
    const library = await launcher.launchExpectingLibrary();
    const reader = await library.cardWithTitle("The kitchen layout").openReader();

    await reader.verifyProjectsLineReads("In Launching my app, Learning Spanish and 2 more · Change");
    const picker = await reader.openMoreProjects();
    await picker.verifyIsTicked("Kitchen renovation", true);
  });
});

test.describe("on a phone and in the panel", () => {
  test("Projects come first in the Filters sheet, and choosing one closes it onto the project's page", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    const overview = titled("The kitchen layout mistakes I see every week");
    const project = makeProject();
    backendSimulator.overviews.seed(overview);
    backendSimulator.projects.seed(project);
    backendSimulator.projects.seedMember(makeProjectMember(project, overview.id));
    const library = await launcher.launchExpectingLibrary();

    await library.openFilters();
    const head = await library.projectsRail.openProject("Kitchen renovation");

    await library.verifyFiltersAreOpen(false);
    await head.verifyNameReads("Kitchen renovation");
  });

  test("in the panel a project's name opens it in the web app", async ({ launcher, backendSimulator }) => {
    const VIDEO_URL = "https://www.youtube.com/watch?v=webAppVideo01";
    const overview = titled("The kitchen layout mistakes I see every week");
    const note = { ...overview, source: { ...overview.source, id: "webAppVideo01" as never, url: VIDEO_URL } };
    const project = makeProject();
    backendSimulator.overviews.seed(note);
    backendSimulator.projects.seed(project);
    backendSimulator.projects.seedMember(makeProjectMember(project, note.id));
    const capture = await launcher.launchPanel({
      activeVideoUrl: VIDEO_URL,
      sync: true,
      syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
    });
    const reader = await capture.openStoredOverview();

    await reader.verifyProjectsLineReads("In Kitchen renovation · Change");
    await reader.verifyProjectLinkHref("Kitchen renovation", new RegExp(`^https://sync\\.test/projects/${project.id}$`));
  });
});
