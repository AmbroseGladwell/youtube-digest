import type { UnreadableRecord } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const titled = (title: string, savedAt: string) =>
  makeOverview({ savedAt, video: { ...makeOverview().video, title } });

const unreadable = (salvaged: UnreadableRecord["salvaged"]): UnreadableRecord => ({
  kind: "overview",
  id: crypto.randomUUID(),
  schemaVersion: 1,
  reason: "invalid",
  detail: "coreClaim: expected string",
  salvaged,
});

// Readable, salvaged and held back, with dates and titles that disagree about the order,
// and one quarantined record whose date and title were both lost.
const seedMixedLibrary = (backendSimulator: BackendSimulator) => {
  backendSimulator.overviews.seed(titled("Bravo video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Delta video", "2026-09-12T00:00:00.000Z"));
  backendSimulator.overviews.seedUnreadable(
    unreadable({
      savedAt: "2026-09-14T00:00:00.000Z",
      video: { id: null, url: null, title: "Charlie salvaged" },
    }),
  );
  backendSimulator.overviews.seedUnreadable({
    ...unreadable({
      savedAt: "2026-09-10T00:00:00.000Z",
      video: { id: null, url: null, title: "Alpha held back" },
    }),
    reason: "future-version",
    schemaVersion: 99,
  });
  backendSimulator.overviews.seedUnreadable(unreadable(null));
};

test("the library opens newest saved first, with a record that lost its date last", async ({
  launcher,
  backendSimulator,
}) => {
  seedMixedLibrary(backendSimulator);

  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.verifyReads("Newest saved first");
  await library.verifyCardOrder([
    "Bravo video",
    "Charlie salvaged",
    "Delta video",
    "Alpha held back",
    "An overview you saved",
  ]);
});

test("oldest first reverses the dates, and still keeps the undated record last", async ({
  launcher,
  backendSimulator,
}) => {
  seedMixedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.sortBy("oldest");

  await library.sortPill.verifyReads("Oldest saved first");
  await library.verifyCardOrder([
    "Alpha held back",
    "Delta video",
    "Charlie salvaged",
    "Bravo video",
    "An overview you saved",
  ]);
});

test("title order places unreadable records by their salvaged title", async ({
  launcher,
  backendSimulator,
}) => {
  seedMixedLibrary(backendSimulator);
  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.sortBy("title");

  await library.sortPill.verifyReads("Title A–Z");
  await library.verifyCardOrder([
    "Alpha held back",
    "Bravo video",
    "Charlie salvaged",
    "Delta video",
    "An overview you saved",
  ]);
});

test("the sort orders what the filters leave, and clearing the filters keeps it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(titled("Zulu tango", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Yankee tango", "2026-09-15T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Xray other", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.sortBy("title");
  await library.search("tango");
  await library.verifyCardOrder(["Yankee tango", "Zulu tango"]);

  await library.clearTheSearch();

  await library.sortPill.verifyReads("Title A–Z");
  await library.verifyCardOrder(["Xray other", "Yankee tango", "Zulu tango"]);
});

test("the chosen sort is still there on coming back from a note", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  backendSimulator.overviews.seed(titled("Newer video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Older video", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();

  await library.sortPill.sortBy("oldest");
  await library.cardWithTitle("Older video").openReaderFromTitle();
  await page.goBack();

  await library.sortPill.verifyReads("Oldest saved first");
  await library.verifyCardOrder(["Older video", "Newer video"]);
});

test("the menu works from the keyboard and gives focus back to the pill", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(titled("Newer video", "2026-09-16T00:00:00.000Z"));
  backendSimulator.overviews.seed(titled("Older video", "2026-09-14T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();
  const sortPill = library.sortPill;

  await sortPill.openWithKeyboard();
  await sortPill.verifyChecked("newest");
  await sortPill.verifyFocusIsOn("newest");
  await sortPill.press("ArrowUp");
  await sortPill.verifyFocusIsOn("title");
  await sortPill.press("Escape");

  await sortPill.verifyIsOpen(false);
  await sortPill.verifyFocusIsOnTheTrigger();
  await sortPill.verifyReads("Newest saved first");

  await sortPill.openWithKeyboard();
  await sortPill.press("ArrowDown");
  await sortPill.verifyFocusIsOn("oldest");
  await sortPill.press("Enter");

  await sortPill.verifyIsOpen(false);
  await sortPill.verifyFocusIsOnTheTrigger();
  await sortPill.verifyReads("Oldest saved first");
  await library.verifyCardOrder(["Older video", "Newer video"]);
});
