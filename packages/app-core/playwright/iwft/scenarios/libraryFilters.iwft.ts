import { test } from "../../support/fixtures.testHelper.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a seeded library renders one card per overview", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Original video" } }));
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Common knowledge video" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);
});

test("the list head counts what the library holds: overviews", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());
  backendSimulator.overviews.seed(makeOverview({ savedAt: "2026-09-10T00:00:00.000Z" }));

  const library = await launcher.launchExpectingLibrary();

  await library.verifyCountReads("2 overviews · 2 unread");
});

test("the list head drops to the singular on a library of one", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview());

  const library = await launcher.launchExpectingLibrary();

  await library.verifyCountReads("1 overview · 1 unread");
});

test("the novelty filter narrows the visible cards", async ({ launcher, backendSimulator }) => {
  const novel = makeOverview({
    video: { ...makeOverview().video, title: "Original video" },
    verdict: { novelty: "original", standsOut: { text: "A new idea.", range: null }, dubious: false, reasoning: "x", similarTo: [] },
  });
  const recycled = makeOverview({
    video: { ...makeOverview().video, title: "Common knowledge video" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(novel);
  backendSimulator.overviews.seed(recycled);

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);

  await library.filterPanel.clickNoveltyChip("original");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Original video").verifyTitle("Original video");
});

test("the read-status filter is on from the start, and turning it off shows what has been read", async ({
  launcher,
  backendSimulator,
}) => {
  const unread = makeOverview({ video: { ...makeOverview().video, title: "Unread video" } });
  const read = makeOverview({ video: { ...makeOverview().video, title: "Read video" } });
  backendSimulator.overviews.seed(unread);
  backendSimulator.overviews.seed(read);
  backendSimulator.overviews.seedState(makeOverviewState(read.id, { read: true }));

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Unread video").verifyTitle("Unread video");

  await library.filterPanel.clickStatusChip("unread");
  await library.expectCardCountToBe(2);
});

test("the search box filters by a case-insensitive substring of the video title", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Platysma exercises" } }));
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Compound interest" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.verifyOffersToClearTheSearch(false);
  await library.search("PLATYSMA");
  await library.expectCardCountToBe(1);

  await library.verifyOffersToClearTheSearch(true);
  await library.clearTheSearch();

  await library.verifySearchReads("");
  await library.expectCardCountToBe(2);
});

test("filters combine with AND: a video matching only one active filter stays hidden", async ({
  launcher,
  backendSimulator,
}) => {
  const matchesNeither = makeOverview({
    video: { ...makeOverview().video, title: "Wrong video" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(matchesNeither);

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickNoveltyChip("original");
  await library.verifyEmptyState();
});
