import { test } from "../../support/fixtures.testHelper.js";
import {
  makeOverview,
  makeOverviewState,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a seeded library renders one card per overview", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Novel video" } }));
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Recycled video" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);
});

test("the novelty filter narrows the visible cards", async ({ launcher, backendSimulator }) => {
  const novel = makeOverview({
    video: { ...makeOverview().video, title: "Novel video" },
    verdict: { novelty: "novel", dubious: false, reasoning: "x", similarTo: [] },
  });
  const recycled = makeOverview({
    video: { ...makeOverview().video, title: "Recycled video" },
    verdict: { novelty: "recycled", dubious: false, reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(novel);
  backendSimulator.overviews.seed(recycled);

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);

  await library.filterPanel.clickNoveltyChip("novel");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Novel video").verifyTitle("Novel video");
});

test("the read-status filter narrows the visible cards", async ({ launcher, backendSimulator }) => {
  const unread = makeOverview({ video: { ...makeOverview().video, title: "Unread video" } });
  const read = makeOverview({ video: { ...makeOverview().video, title: "Read video" } });
  backendSimulator.overviews.seed(unread);
  backendSimulator.overviews.seed(read);
  backendSimulator.overviews.seedState(makeOverviewState(read.id, { read: true }));

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickStatusChip("unread");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Unread video").verifyTitle("Unread video");
});

test("the search box filters by a case-insensitive substring of the video title", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Platysma exercises" } }));
  backendSimulator.overviews.seed(makeOverview({ video: { ...makeOverview().video, title: "Compound interest" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.search("PLATYSMA");
  await library.expectCardCountToBe(1);
});

test("filters combine with AND: a video matching only one active filter stays hidden", async ({
  launcher,
  backendSimulator,
}) => {
  const matchesNeither = makeOverview({
    video: { ...makeOverview().video, title: "Wrong video" },
    verdict: { novelty: "recycled", dubious: false, reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(matchesNeither);

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickNoveltyChip("novel");
  await library.verifyEmptyState();
});
