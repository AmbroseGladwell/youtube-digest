import { test } from "../../support/fixtures.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { LibraryPageObject } from "../../pageObjects/LibraryPageObject.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview, makeOverviewState } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const titled = (title: string, savedAt: string) => makeOverview({ savedAt, source: { ...makeOverview().source, title } });

const seedLibrary = (backendSimulator: BackendSimulator) => {
  const apple = titled("Apple", "2026-09-16T00:00:00.000Z");
  const read = titled("Already read", "2026-09-15T00:00:00.000Z");
  const zebra = titled("Zebra", "2026-09-14T00:00:00.000Z");
  for (const overview of [apple, read, zebra]) {
    backendSimulator.overviews.seed(overview);
  }
  backendSimulator.overviews.seedState(makeOverviewState(read.id, { read: true }));
  return { apple, read, zebra };
};

const returnToTheLibrary = async (launcher: Launcher, library: LibraryPageObject) => {
  await launcher.openPage(Routes.settings());
  await launcher.openPage(Routes.home());
  return new LibraryPageObject(library.testContext).verifyIsShown();
};

test("a first visit opens on unread with no chip for it, and turning Unread off shows everything with a chip and Reset", async ({
  launcher,
  backendSimulator,
}) => {
  seedLibrary(backendSimulator);

  const library = await launcher.launchExpectingLibrary();

  await library.verifyCardOrder(["Apple", "Zebra"]);
  await library.verifyNoChips();
  await library.verifyOffersReset(false);

  await library.showAll();
  await library.verifyCardOrder(["Apple", "Already read", "Zebra"]);
  await library.verifyChipsRead(["Read and unread"]);
  await library.verifyOffersReset(true);
});

test("the filters and order the reader leaves are the ones they come back to", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.filterMenu.clickStatusChip("unread");
  await library.sortPill.sortBy("title");

  const returned = await returnToTheLibrary(launcher, library);
  await returned.verifyCardOrder(["Already read", "Apple", "Zebra"]);
  await returned.verifyChipsRead(["Read and unread"]);
  await returned.sortPill.verifyReads("Title A–Z");
});

test("Reset puts the filters back to unread, keeps the order, and that is kept too", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  await library.showAll();
  await library.sortPill.sortBy("oldest");

  await library.resetView();

  await library.verifyCardOrder(["Zebra", "Apple"]);
  await library.verifyOffersReset(false);
  const returned = await returnToTheLibrary(launcher, library);
  await returned.verifyNoChips();
  await returned.sortPill.verifyReads("Oldest saved first");
});

test("a link that names a view is followed, and the saved view is left as it was", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await launcher.openPage(`${Routes.home()}?status=read`);
  await library.verifyCardOrder(["Already read"]);

  const returned = await returnToTheLibrary(launcher, library);
  await returned.verifyCardOrder(["Apple", "Zebra"]);
  await returned.verifyNoChips();
});

test("with nothing unread, the list says the reader is caught up and offers everything", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  await library.cardWithTitle("Apple").clickMarkRead();
  await library.cardWithTitle("Zebra").clickMarkRead();
  await library.verifyCardOrder(["Apple", "Zebra"]);

  const returned = await returnToTheLibrary(launcher, library);
  await returned.verifyCaughtUp();
  await returned.showAllFromCaughtUp();

  await returned.verifyCardOrder(["Apple", "Already read", "Zebra"]);
});

test("a row marked read from the unread list stays put until the view changes", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.cardWithTitle("Apple").clickMarkRead();

  await library.cardWithTitle("Apple").verifyIsRead(true);
  await library.verifyCardOrder(["Apple", "Zebra"]);
  await library.sortPill.sortBy("title");
  await library.verifyCardOrder(["Zebra"]);
});

test("Previous and Next walk the list the reader opened it from, in its order", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();
  await library.sortPill.sortBy("title");

  const reader = await library.cardWithTitle("Apple").openReader();
  await reader.verifyPosition("1 of 2");
  await reader.clickMarkRead();
  await reader.verifyPosition("1 of 2");

  await reader.clickNextOverview();
  await reader.verifyPosition("2 of 2");
  await reader.clickPreviousOverview();
  await reader.verifyPosition("1 of 2");
});

test("Reset and the caught-up way out are counted, with each filter they change", async ({ launcher, backendSimulator }) => {
  seedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary({
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
  });
  await library.showAll();
  await library.resetView();

  await test.expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("library.")))
    .toEqual([
      { name: "library.filterSheet.opened", props: {} },
      { name: "library.filters.statusChosen", props: { status: "all", from: "panel" } },
      { name: "library.filterSheet.closed", props: {} },
      { name: "library.view.reset", props: { applied: 1 } },
      { name: "library.filters.statusChosen", props: { status: "unread", from: "reset" } },
    ]);
});
