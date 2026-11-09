import type { Locator, Page } from "@playwright/test";
import { articleSourceId, type ArticleRead, type ExtractedArticle } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import type { IwftArticlePagesConfig } from "../../network/IwftArticlePages.testHelper.js";
import { makeArticleOverview, makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { sourceOfferTestIds } from "../../../src/features/capture/components/SourceOffer/SourceOfferTestIds.js";
import { recentOverviewsTestIds } from "../../../src/features/capture/components/RecentOverviews/RecentOverviewsTestIds.js";
import { kindChipTestIds } from "../../../src/components/shared/KindChip/KindChipTestIds.js";
import { capturePageTestIds } from "../../../src/features/capture/CapturePage/CapturePageTestIds.js";
import { readerNoticeTestIds } from "../../../src/features/reader/components/ReaderNotice/ReaderNoticeTestIds.js";
import { articleChaptersPanelTestIds } from "../../../src/features/reader/components/ArticleChaptersPanel/ArticleChaptersPanelTestIds.js";
import { overviewActionsMenuTestIds } from "../../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { regenerateArticleDialogTestIds } from "../../../src/features/reader/components/RegenerateArticleDialog/RegenerateArticleDialogTestIds.js";
import { Routes } from "../../../src/app/Routes.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

const ARTICLE_URL = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const OPEN_PAGE = { url: ARTICLE_URL, title: "The town that pays its bridge bill twice | The Harbour Post", tabId: 7 };

const ARTICLE: ExtractedArticle = {
  url: ARTICLE_URL,
  title: "The town that pays its bridge bill twice",
  siteName: "The Harbour Post",
  author: "Asha Rao",
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011." }],
  wordCount: 3200,
  recipe: null,
};

const READ: ArticleRead = { status: "read", article: ARTICLE };

const beside = (overrides: Partial<IwftArticlePagesConfig> = {}): IwftArticlePagesConfig => ({
  page: OPEN_PAGE,
  granted: true,
  read: READ,
  ...overrides,
});

const chrome = {
  answer: (page: Page, allowed: boolean) => page.evaluate((next) => window.__iwftArticlePages__?.answerChrome(next), allowed),
  willRead: (page: Page, read: ArticleRead) => page.evaluate((next) => window.__iwftArticlePages__?.willRead(next), read),
  willFindPlaces: (page: Page, found: boolean | null) =>
    page.evaluate((next) => window.__iwftArticlePages__?.willFindPlaces(next), found),
  moveTo: (page: Page, next: IwftArticlePagesConfig["page"]) => page.evaluate((to) => window.__iwftArticlePages__?.moveTo(to), next),
  rightClick: (page: Page) => page.evaluate((to) => window.__iwftArticlePages__?.rightClick(to), OPEN_PAGE),
  reloads: (page: Page) => page.evaluate(() => window.__iwftArticlePages__?.reloads),
};

// An undefined custom property draws in the parent's colour without a word (OV-212), so what is
// compared is the drawn colour against the --label token resolved beside it, in both schemes.
const expectDrawnInTheLabelTone = async (page: Page, label: Locator) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const { drawn, token } = await label.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--label)";
      element.after(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      return { drawn: getComputedStyle(element).color, token };
    });
    expect(drawn, colorScheme).toBe(token);
  }
};

test("on a page that's neither, the panel says what it works on and shows what's recent, with no button", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  backendSimulator.overviews.seed(makeOverview());
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ page: null }) });

  await expect(page.getByTestId(capturePageTestIds.noVideoNote)).toHaveText(
    "Open a YouTube video or an article, and you can make an overview of it here.",
  );
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
  await expect(page.getByTestId(recentOverviewsTestIds.row)).toHaveCount(2);
  await expect(page.getByTestId(kindChipTestIds.root)).toHaveText(["Article"]);
  await expectDrawnInTheLabelTone(page, page.getByTestId(recentOverviewsTestIds.heading));
});

test("a site's front page is not offered, since it is a list of other stories", async ({ page, launcher }) => {
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: beside({ page: { ...OPEN_PAGE, url: "https://theharbourpost.example/" } }),
  });

  await expect(page.getByTestId(capturePageTestIds.noVideoNote)).toBeVisible();
  await expect(page.getByTestId(capturePageTestIds.createButton)).toHaveCount(0);
});

test("first time on a site: the panel warns, Chrome asks, and an allowed article becomes a note", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ granted: false }) });

  await expect(page.getByTestId(sourceOfferTestIds.site)).toHaveText("theharbourpost.example · Article");
  await expectDrawnInTheLabelTone(page, page.getByTestId(sourceOfferTestIds.site));
  await expect(page.getByTestId(sourceOfferTestIds.title)).toHaveText(OPEN_PAGE.title);
  await expect(page.getByTestId(sourceOfferTestIds.facts), "nothing has been read yet").toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.firstTimeNote)).toContainText("We only read a page when you press Create.");

  await page.getByTestId(capturePageTestIds.createButton).click();
  await expect(page.getByTestId(capturePageTestIds.askingNote)).toHaveText("Choose Allow in Chrome’s box to carry on.");
  await expect(page.getByTestId(capturePageTestIds.createButton)).toBeDisabled();
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await chrome.answer(page, true);

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The town that pays its bridge bill twice");
  const [generation] = backendSimulator.ourKey.generations();
  expect(generation?.input).toHaveProperty("article.url", ARTICLE_URL);
  expect(generation?.input).not.toHaveProperty("video");
});

test("a site already allowed asks nothing and says nothing", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside() });

  await expect(page.getByTestId(capturePageTestIds.createButton)).toBeEnabled();
  await expect(page.getByTestId(capturePageTestIds.firstTimeNote)).toHaveCount(0);

  await page.getByTestId(capturePageTestIds.createButton).click();
  await launcher.readerPage.verifyIsShown();
});

test("declined in Chrome, the panel says nothing counted and can ask again", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ granted: false }) });

  await page.getByTestId(capturePageTestIds.createButton).click();
  await chrome.answer(page, false);

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("Chrome didn’t allow theharbourpost.example");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toContainText("nothing counted");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await page.getByTestId(articleFailureNoticeTestIds.way).click();
  await expect(page.getByTestId(capturePageTestIds.askingNote)).toBeVisible();
  await chrome.answer(page, true);
  await launcher.readerPage.verifyIsShown();
});

test("a paywall names the words it let through, and costs nothing", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: beside({ read: { status: "failed", reason: "paywalled", shownWords: 180, siteName: "The Harbour Post" } }),
  });

  await page.getByTestId(capturePageTestIds.createButton).click();

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("Only the opening is showing");
  await expect(page.getByTestId(articleFailureNoticeTestIds.body)).toContainText("The page gave us 180 words");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);

  await chrome.willRead(page, READ);
  await page.getByTestId(articleFailureNoticeTestIds.way).click();
  await launcher.readerPage.verifyIsShown();
});

test("a page that turns out not to be an article has no button, and going elsewhere clears it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ read: { status: "failed", reason: "nothing-readable" } }) });
  await page.getByTestId(capturePageTestIds.createButton).click();

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("This page isn’t an article");
  await expect(page.getByTestId(articleFailureNoticeTestIds.way)).toHaveCount(0);

  await chrome.moveTo(page, { ...OPEN_PAGE, url: "https://theharbourpost.example/another-story" });
  await expect(page.getByTestId(articleFailureNoticeTestIds.root)).toHaveCount(0);
  await expect(page.getByTestId(capturePageTestIds.createButton)).toBeVisible();
});

test("a page that didn't load is reloaded and read again", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ read: { status: "failed", reason: "not-loaded" } }) });
  await page.getByTestId(capturePageTestIds.createButton).click();
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("The page didn’t finish loading");

  await chrome.willRead(page, READ);
  await page.getByTestId(articleFailureNoticeTestIds.way).click();

  await launcher.readerPage.verifyIsShown();
  expect(await chrome.reloads(page)).toBe(1);
});

test("right-click goes straight to reading, and the note explains why Create may still ask", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ granted: false, page: null }) });

  await chrome.rightClick(page);

  await launcher.readerPage.verifyIsShown();
  await expect(page.getByTestId(readerNoticeTestIds.root)).toHaveText(
    "Read with one-time access. The Create button on theharbourpost.example will ask Chrome once.",
  );
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
});

test("an article held under its canonical address opens the note it has, and nothing is made", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.overviews.seed(makeArticleOverview({ source: { ...makeArticleOverview().source, id: await articleSourceId(ARTICLE_URL) } as never }));
  await launcher.launchPanel({
    ...SIGNED_IN,
    activeVideoUrl: null,
    articlePages: beside({ page: { ...OPEN_PAGE, url: "https://theharbourpost.example/newsletter-link" } }),
  });

  await page.getByTestId(capturePageTestIds.createButton).click();

  await launcher.readerPage.verifyIsShown();
  await expect(page.getByTestId(readerNoticeTestIds.root)).toContainText("You made an overview of this on");
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("an unreadable article can be made again beside it, and otherwise says where to go", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const id = "0f0f0f0f-0000-4000-8000-000000000001";
  backendSimulator.overviews.seedUnreadable({
    kind: "overview",
    id,
    schemaVersion: 1,
    reason: "failed-migration",
    salvaged: { savedAt: null, source: { kind: "web", id: await articleSourceId(ARTICLE_URL), url: ARTICLE_URL, title: "Old" } },
  } as never);
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ page: null }) });
  await launcher.openPage(Routes.overview(id));

  await expect(page.getByRole("heading", { name: "This overview can’t be opened" })).toBeVisible();
  await expect(page.getByText(/open the article on theharbourpost\.example and press Create overview/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the article in a new tab" })).toHaveAttribute("href", ARTICLE_URL);

  await chrome.moveTo(page, OPEN_PAGE);
  await page.getByRole("button", { name: "Make it again" }).click();
  await expect.poll(() => backendSimulator.ourKey.generations()[0]?.overviewId).toBe(id);
});

test("beside the article, chapters move the page and say when a place has gone", async ({ page, launcher, backendSimulator }) => {
  const overview = makeArticleOverview();
  backendSimulator.overviews.seed(overview);
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside() });
  await launcher.openPage(Routes.overview(overview.id));

  await expect(page.getByText("Chapter links move the article beside this panel to that place.")).toBeVisible();
  await page.getByRole("tab", { name: "Chapters" }).click();
  await expect(page.getByText(/you may land at the top/)).toHaveCount(0);

  await page.getByTestId(articleChaptersPanelTestIds.show).first().click();
  await expect(page.getByTestId(articleChaptersPanelTestIds.show).first()).toHaveText("Shown on the page");

  await chrome.willFindPlaces(page, false);
  await page.getByTestId(articleChaptersPanelTestIds.show).nth(1).click();
  await expect(page.getByTestId(articleChaptersPanelTestIds.missing)).toContainText("Couldn’t find this place on the page.");
});

test("regenerating beside the article runs; away from it the menu explains first", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  const overview = makeArticleOverview();
  backendSimulator.overviews.seed(overview);
  await launcher.launchPanel({ ...SIGNED_IN, activeVideoUrl: null, articlePages: beside({ page: null }) });
  await launcher.openPage(Routes.overview(overview.id));

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate…" }).click();
  await expect(page.getByTestId(regenerateArticleDialogTestIds.root)).toContainText("We don’t keep a copy of it");
  await page.getByTestId(regenerateArticleDialogTestIds.cancelButton).click();

  await chrome.moveTo(page, OPEN_PAGE);
  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate", exact: true }).click();

  await launcher.readerPage.verifyIsShown();
  expect(backendSimulator.ourKey.generations()[0]?.overviewId).toBe(overview.id);
});
