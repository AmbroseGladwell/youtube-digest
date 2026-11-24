import { SourceKey, TopicId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview, makeOverviewState } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

test("a seeded library renders one card per overview", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Original video" } }));
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Common knowledge video" } }));

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
    source: { ...makeOverview().source, title: "Original video" },
    verdict: {
      novelty: "original",
      standsOut: { text: "A new idea.", range: null },
      dubious: false,
      dubiousClaims: [],
      reasoning: "x",
      similarTo: [],
    },
  });
  const recycled = makeOverview({
    source: { ...makeOverview().source, title: "Common knowledge video" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(novel);
  backendSimulator.overviews.seed(recycled);

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);

  await library.filterPanel.clickNoveltyChip("original");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Original video").verifyTitle("Original video");
});

test("the read-status filter is on from the start, and turning it off shows what has been read", async ({ launcher, backendSimulator }) => {
  const unread = makeOverview({ source: { ...makeOverview().source, title: "Unread video" } });
  const read = makeOverview({ source: { ...makeOverview().source, title: "Read video" } });
  backendSimulator.overviews.seed(unread);
  backendSimulator.overviews.seed(read);
  backendSimulator.overviews.seedState(makeOverviewState(read.id, { read: true }));

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Unread video").verifyTitle("Unread video");

  await library.filterPanel.clickStatusChip("unread");
  await library.expectCardCountToBe(2);
});

test("the search box filters by a case-insensitive substring of the video title", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Platysma exercises" } }));
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Compound interest" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.verifyOffersToClearTheSearch(false);
  await library.search("PLATYSMA");
  await library.expectCardCountToBe(1);

  await library.verifyOffersToClearTheSearch(true);
  await library.clearTheSearch();

  await library.verifySearchReads("");
  await library.expectCardCountToBe(2);
});

test("every key typed into the search stays, however fast it comes, and the address follows", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Kitchen renovation" } }));
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "Compound interest" } }));

  const library = await launcher.launchExpectingLibrary();
  await library.typeInTheSearch("kitchen");

  await library.verifySearchReads("kitchen");
  await library.expectCardCountToBe(1);
  await library.verifyTheAddressHoldsTheSearch("kitchen");
});

test("filters combine with AND: a video matching only one active filter stays hidden", async ({ launcher, backendSimulator }) => {
  const matchesNeither = makeOverview({
    source: { ...makeOverview().source, title: "Wrong video" },
    verdict: { novelty: "common_knowledge", standsOut: null, dubious: false, dubiousClaims: [], reasoning: "x", similarTo: [] },
  });
  backendSimulator.overviews.seed(matchesNeither);

  const library = await launcher.launchExpectingLibrary();
  await library.filterPanel.clickNoveltyChip("original");
  await library.verifyEmptyState();
});

const article = (title: string, url: string, siteName: string | null) =>
  makeOverview({
    source: {
      kind: "web",
      id: SourceKey.parse(`article-${title.length}`),
      url,
      title,
      siteName,
      author: null,
      publishedAt: null,
      language: null,
      imageUrl: null,
      wordCount: 900,
    },
  } as never);

test("a link can filter by source, Added, No topic and several values at once", async ({ launcher, backendSimulator }) => {
  const topic = TopicId.parse("11111111-1111-4111-8111-111111111111");
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "A video in a topic" }, topicIds: [topic] }));
  backendSimulator.overviews.seed(
    makeOverview({ source: { ...makeOverview().source, title: "An old video" }, savedAt: "2025-01-01T09:00:00.000Z" }),
  );
  backendSimulator.overviews.seed(article("Pizza at home", "https://www.seriouseats.com/pizza", "Serious Eats"));
  backendSimulator.overviews.seed(article("Pasta at home", "https://m.seriouseats.com/pasta", null));
  backendSimulator.overviews.seed(article("A long read", "https://www.example.org/long-read", "Example"));

  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(5);

  await launcher.openPage("/?source=site:seriouseats.com");
  await library.expectCardCountToBe(2);

  await launcher.openPage("/?source=site:seriouseats.com,site:example.org");
  await library.expectCardCountToBe(3);

  await launcher.openPage("/?added=30d&kind=video");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("A video in a topic").verifyTitle("A video in a topic");

  await launcher.openPage("/?topic=none&kind=video");
  await library.expectCardCountToBe(1);
  await library.cardWithTitle("An old video").verifyTitle("An old video");
});

test("an old link that filtered by ?source=article still opens the articles", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "A video" } }));
  backendSimulator.overviews.seed(article("Pizza at home", "https://www.seriouseats.com/pizza", "Serious Eats"));

  const library = await launcher.launchExpectingLibrary();
  await launcher.openPage("/?source=article");

  await library.expectCardCountToBe(1);
  await library.cardWithTitle("Pizza at home").verifyTitle("Pizza at home");
});
