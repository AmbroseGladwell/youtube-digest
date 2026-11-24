import type { UnreadableRecord } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const titled = (title: string, savedAt: string) => makeOverview({ savedAt, source: { ...makeOverview().source, title } });

const unreadable = (salvaged: UnreadableRecord["salvaged"]): UnreadableRecord => ({
  kind: "overview",
  id: crypto.randomUUID(),
  schemaVersion: 1,
  reason: "invalid",
  detail: "coreClaim: expected string",
  salvaged,
});

const seedMixedLibrary = (backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seed(titled("Bravo video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Delta video", "2026-09-12T00:00:00.000Z"));
  backendSimulator.overviews.seedUnreadable(
    unreadable({
      savedAt: "2026-09-14T00:00:00.000Z",
      source: { kind: "youtube", id: null, url: null, title: "Charlie salvaged" },
    }),
  );
  backendSimulator.overviews.seedUnreadable({
    ...unreadable({
      savedAt: "2026-09-10T00:00:00.000Z",
      source: { kind: "youtube", id: null, url: null, title: "Alpha held back" },
    }),
    reason: "future-version",
    schemaVersion: 99,
  });
  backendSimulator.overviews.seedUnreadable(unreadable(null));
};

test("the library opens newest saved first, with a record that lost its date last", async ({ launcher, backendSimulator }) => {
  seedMixedLibrary(backendSimulator);

  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.verifyReads("Added, newest first");
  await library.verifyCardOrder(["Bravo video", "Charlie salvaged", "Delta video", "Alpha held back", "An overview you saved"]);
});

test("oldest first reverses the dates, and still keeps the undated record last", async ({ launcher, backendSimulator }) => {
  seedMixedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.sortBy("oldest");

  await library.sortMenu.verifyReads("Added, oldest first");
  await library.verifyCardOrder(["Alpha held back", "Delta video", "Charlie salvaged", "Bravo video", "An overview you saved"]);
});

test("title order places unreadable records by their salvaged title", async ({ launcher, backendSimulator }) => {
  seedMixedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.sortBy("title");

  await library.sortMenu.verifyReads("Title, A–Z");
  await library.verifyCardOrder(["Alpha held back", "Bravo video", "Charlie salvaged", "Delta video", "An overview you saved"]);
});

test("the sort orders what the filters leave, and clearing the filters keeps it", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("Zulu tango", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Yankee tango", "2026-09-15T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Xray other", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.sortBy("title");
  await library.search("tango");
  await library.verifyCardOrder(["Yankee tango", "Zulu tango"]);

  await library.clearTheSearch();

  await library.sortMenu.verifyReads("Title, A–Z");
  await library.verifyCardOrder(["Xray other", "Yankee tango", "Zulu tango"]);
});

test("the chosen sort is still there on coming back from a note", async ({ launcher, backendSimulator, page }) => {
  backendSimulator.overviews.seed(titled("Newer video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Older video", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();

  await library.sortMenu.sortBy("oldest");
  await library.cardWithTitle("Older video").openReaderFromTitle();
  await page.goBack();

  await library.sortMenu.verifyReads("Added, oldest first");
  await library.verifyCardOrder(["Older video", "Newer video"]);
});

test("the menu works from the keyboard, each choice applies at once, and Escape gives focus back to the button", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(titled("Newer video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Older video", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();
  const sortMenu = library.sortMenu;

  await sortMenu.openWithKeyboard();
  await sortMenu.verifyChecked("field", "added");
  await sortMenu.verifyFocusIsOn("field", "added");
  await sortMenu.press("ArrowUp");
  await sortMenu.verifyFocusIsOn("group", "month");
  await sortMenu.press("Home");
  await sortMenu.press("ArrowDown");
  await sortMenu.press("ArrowDown");
  await sortMenu.press("ArrowDown");
  await sortMenu.verifyFocusIsOn("field", "title");
  await sortMenu.press("Enter");

  await sortMenu.verifyIsOpen(true);
  await sortMenu.verifyChecked("order", "asc");
  await sortMenu.verifyGroupsOffered(["None", "Letter"]);
  await library.verifyCardOrder(["Newer video", "Older video"]);
  await sortMenu.press("Escape");

  await sortMenu.verifyIsOpen(false);
  await sortMenu.verifyFocusIsOnTheTrigger();
  await sortMenu.verifyReads("Title, A–Z");
  await sortMenu.verifyMarkedChanged(true);
});

test("grouping by month puts a heading over each month with its count, and none is the default", async ({ launcher, backendSimulator }) => {
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, 2, 10).toISOString();
  backendSimulator.overviews.seed(titled("This month's", now.toISOString()));
  backendSimulator.overviews.seed(titled("Last year's", lastYear));
  backendSimulator.overviews.seed(titled("Also last year's", lastYear));
  const library = await launcher.launchExpectingLibrary();
  await library.verifyHeadingsRead([]);
  await library.sortMenu.verifyMarkedChanged(false);

  await library.sortMenu.choose("group", "month");
  await library.sortMenu.close();

  await library.verifyHeadingsRead([`This month1`, `March ${now.getFullYear() - 1}2`]);
  await library.sortMenu.verifyReads("Added, newest first, by month");
  await library.sortMenu.choose("field", "title");
  await library.sortMenu.verifyChecked("group", "none");
  await library.sortMenu.close();
  await library.verifyHeadingsRead([]);
});

test("a link can sort by Updated, where the reader's own edit counts, and by Published either way", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: "2026-09-01T00:00:00.000Z",
      editedAt: "2026-10-05T00:00:00.000Z",
      source: { ...makeOverview().source, title: "Edited lately", publishedAt: "2019-03-01T00:00:00.000Z" },
    }),
  );
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: "2026-10-01T00:00:00.000Z",
      source: { ...makeOverview().source, title: "Saved lately", publishedAt: null },
    }),
  );
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: "2026-09-10T00:00:00.000Z",
      source: { ...makeOverview().source, title: "Saved earlier", publishedAt: "2025-05-01T00:00:00.000Z" },
    }),
  );

  const library = await launcher.launchExpectingLibrary();

  await launcher.openPage("/?sort=updated");
  await library.verifyCardOrder(["Edited lately", "Saved lately", "Saved earlier"]);

  await launcher.openPage("/?sort=published&dir=asc");
  await library.verifyCardOrder(["Edited lately", "Saved earlier", "Saved lately"]);
  await library.sortMenu.verifyReads("Published, oldest first");
});
