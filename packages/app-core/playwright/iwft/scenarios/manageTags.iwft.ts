import { test, expect } from "../../support/fixtures.testHelper.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const titled = (title: string, tags: string[]) => makeOverview({ video: { ...makeOverview().video, title }, tags });

const SIDE_PROJECT = titled("Side project", ["saas", "pricing"]);
const CHROME = titled("Chrome extension", ["saas", "micro-saas"]);
const TOOLS = titled("Tools", ["micro-saas"]);
const AGENTS = titled("Agents", ["ai-saas", "ai"]);
const NUCLEAR = titled("Nuclear", ["nuclear", "energy"]);

const seedLibrary = (backendSimulator: BackendSimulator) => {
  for (const overview of [SIDE_PROJECT, CHROME, TOOLS, AGENTS, NUCLEAR]) backendSimulator.overviews.seed(overview);
};

const tagsOf = async (backendSimulator: BackendSimulator, overview: { id: Parameters<BackendSimulator["overviews"]["get"]>[0] }) =>
  (await backendSimulator.overviews.get(overview.id))?.tags;

test("Manage tags lists every tag with how many overviews use it, most used first or A–Z, and finds one", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  const dialog = await library.filterPanel.openManageTags();

  await dialog.verifySummaryReads("7 tags on 5 overviews. Changes apply to every overview that uses the tag.");
  await dialog.verifyRowsRead([
    "#micro-saas2 overviews",
    "#saas2 overviews",
    "#ai1 overview",
    "#ai-saas1 overview",
    "#energy1 overview",
    "#nuclear1 overview",
    "#pricing1 overview",
  ]);
  await dialog.find("saas");
  await dialog.verifyRowsRead(["#micro-saas2 overviews", "#saas2 overviews", "#ai-saas1 overview"]);
  await dialog.sortBy("name");
  await dialog.verifyRowsRead(["#ai-saas1 overview", "#micro-saas2 overviews", "#saas2 overviews"]);
});

test("merging keeps the most used name unless told otherwise, rewrites every overview, and blocks the others", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("saas", "micro-saas", "ai-saas");
  await dialog.openMerge();
  await dialog.keepName("saas");
  await dialog.verifyMergeSays(
    "4 overviews will be tagged #saas. You can undo this until you close Manage tags.",
    "Merge into #saas",
  );
  await dialog.confirmMerge();

  await dialog.verifyNoticeReads("Merged 3 tags into #saas, now on 4 overviews.");
  await expect.poll(() => tagsOf(backendSimulator, CHROME)).toEqual(["saas"]);
  await expect.poll(() => tagsOf(backendSimulator, TOOLS)).toEqual(["saas"]);
  await expect.poll(() => tagsOf(backendSimulator, AGENTS)).toEqual(["saas", "ai"]);
  await expect
    .poll(async () => (await backendSimulator.settingsStore.get()).tagAliases)
    .toEqual({ "micro-saas": "saas", "ai-saas": "saas" });
});

test("a merge can keep a new name instead", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("saas", "micro-saas");
  await dialog.openMerge();
  await dialog.keepNewName("Software Business");
  await dialog.confirmMerge();

  await expect.poll(() => tagsOf(backendSimulator, SIDE_PROJECT)).toEqual(["software-business", "pricing"]);
});

test("renaming says what it will save as, refuses a name with nothing in it, and merges onto a name that exists", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("micro-saas");
  await dialog.startRename();
  await dialog.typeNewName("Micro SaaS tools");
  await dialog.verifyRenameSays("Saves as #micro-saas-tools", "Save");

  await dialog.typeNewName("!!");
  await dialog.verifyRenameSays("Use at least one letter or number.", "Save");
  await dialog.verifyRenameIsRefused();

  await dialog.typeNewName("SaaS");
  await dialog.verifyRenameSays(
    "#saas already exists. Saving merges #micro-saas into it: 2 overviews move to #saas.",
    "Merge",
  );
  await dialog.saveRename();

  await dialog.verifyNoticeReads("Merged #micro-saas into #saas, now on 3 overviews.");
  await expect.poll(() => tagsOf(backendSimulator, TOOLS)).toEqual(["saas"]);
});

test("deleting takes the tag off every overview, and Undo puts it and everything else back", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("nuclear");
  await dialog.delete();
  await dialog.verifyNoticeReads("Deleted #nuclear from 1 overview.");
  await expect.poll(() => tagsOf(backendSimulator, NUCLEAR)).toEqual(["energy"]);
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).tagAliases).toEqual({ nuclear: null });

  await dialog.undo();

  await expect.poll(() => tagsOf(backendSimulator, NUCLEAR)).toEqual(["nuclear", "energy"]);
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).tagAliases).toEqual({});
});

test("a tag the reader added is merged with the note's own", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  backendSimulator.overviews.seedState(makeOverviewState(NUCLEAR.id, { userTags: ["micro-saas"] }));
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("micro-saas");
  await dialog.startRename();
  await dialog.typeNewName("saas");
  await dialog.saveRename();

  await expect.poll(async () => (await backendSimulator.overviews.getState(NUCLEAR.id)).userTags).toEqual(["saas"]);
});

test("Escape backs out of a step before it closes the dialog", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  const dialog = await library.filterPanel.openManageTags();

  await dialog.select("saas", "pricing");
  await dialog.openMerge();
  await dialog.pressEscape();
  await dialog.verifyIsShown();
  await dialog.verifyRowsRead(["#micro-saas2 overviews", "#saas2 overviews", "#ai1 overview", "#ai-saas1 overview", "#energy1 overview", "#nuclear1 overview", "#pricing1 overview"]);

  await dialog.pressEscape();
  await dialog.verifyIsClosed();
});

test("with no tags anywhere there is nothing to manage", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Untagged", []));
  const library = await launcher.launchExpectingLibrary();

  await library.filterPanel.openMoreFilters();
  await library.filterPanel.verifyOffersNoManageTags();
});
