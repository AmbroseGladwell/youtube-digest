import { expect } from "@playwright/test";
import { test } from "../../support/fixtures.testHelper.js";
import {
  makeArticleOverview,
  makeOverview,
} from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const ONE_CHAPTER = makeArticleOverview({
  keyPoints: [
    { text: "Field says a weak argument fails in its first step.", range: null },
    { text: "He lists five habits.", range: null },
    { text: "The last is the commonest.", range: null },
  ],
  article: {
    chapters: [{ title: "All of it", summary: "The whole post.", place: { anchor: null, quote: "A weak argument" }, wordCount: 380 }],
    keyPointChapters: [0, 0, 0],
    readAnyway: { answer: "no", reason: "It adds nothing new.", leftOut: "It leaves out the examples.", chapterIndexes: [] },
  },
});

test("an article reads as the same note: named as an article, with chapters, and no transcript", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary();
  await expect(page.getByText(/14 min article/)).toBeVisible();

  await library.nthCard(0).openReader();

  await expect(page.getByText("The Harbour Post · Article")).toBeVisible();
  await expect(page.getByText(/By Asha Rao · Published 1 Nov 2026 · 14 min read · Saved/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Chapters" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Transcript" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Who pays, opens the article/ })).toHaveAttribute(
    "href",
    "https://theharbourpost.example/2026/11/bridge-bill-twice#who-pays",
  );
});

test("read it anyway sits in the note, says what it leaves out, and links the part and the whole", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByText("Read it anyway?")).toBeVisible();
  await expect(page.getByText(/Just part of it\. .* It leaves out the line-by-line costs/)).toBeVisible();
  await expect(page.getByRole("link", { name: /The budget, line by line.*4 min/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Read the full article on The Harbour Post · 14 min/ })).toHaveAttribute(
    "href",
    "https://theharbourpost.example/2026/11/bridge-bill-twice",
  );
});

test("the chapters tab gives each chapter's read time, and says once that a jump can fail", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByRole("tab", { name: "Chapters" }).click();

  await expect(page.getByText("3 chapters")).toBeVisible();
  await expect(page.getByText(/you may land at the top/)).toHaveCount(1);
  await expect(page.getByText("03 · 4 min read · Worth reading")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the article at Who pays, in a new tab" })).toHaveAttribute(
    "href",
    "https://theharbourpost.example/2026/11/bridge-bill-twice#who-pays",
  );
});

test("a one-chapter article has no tabs and no chapter links", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(ONE_CHAPTER);
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByText(/Chapter links open/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /opens the article/ })).toHaveCount(0);
});

test("an article with no share image shows the site's name, and one that fails to load does too", async ({ page, launcher, backendSimulator }) => {
  const broken = makeArticleOverview({ id: makeOverview().id });
  backendSimulator.overviews.seed(makeArticleOverview());
  await page.route("https://cdn.example/**", (route) => route.abort());
  backendSimulator.overviews.seed({
    ...broken,
    source: { ...broken.source, id: "aa" as never, url: "https://coast.example/tides", siteName: "Coast & Country", imageUrl: "https://cdn.example/tides.jpg" } as never,
  });
  await launcher.launchExpectingLibrary();

  await expect(page.getByTestId("OverviewThumbnail.nameTile").filter({ hasText: "The Harbour Post" })).toBeVisible();
  await expect(page.getByTestId("OverviewThumbnail.nameTile").filter({ hasText: "Coast & Country" })).toBeVisible();
});

test("the library filters by source once it holds both kinds", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  backendSimulator.overviews.seed(makeArticleOverview());
  backendSimulator.overviews.seed(makeOverview({ source: { ...makeOverview().source, title: "A video about pricing" } }));
  const library = await launcher.launchExpectingLibrary();
  await library.expectCardCountToBe(2);

  await page.getByTestId("FilterPanel.moreFiltersButton").click();
  await page.getByTestId("FilterPanel.source.article").click();

  await library.expectCardCountToBe(1);
  await library.verifyCardOrder(["The town that pays its bridge bill twice"]);
  await expect(page.getByTestId("FilterPanel.moreFiltersSummary")).toHaveText("Articles · Any verdict");
});

test("with one kind in the library there is no source to choose", async ({ page, launcher, backendSimulator }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  backendSimulator.overviews.seed(makeArticleOverview());
  await launcher.launchExpectingLibrary();

  await page.getByTestId("FilterPanel.moreFiltersButton").click();
  await expect(page.getByTestId("FilterPanel.source.article")).toHaveCount(0);
});
