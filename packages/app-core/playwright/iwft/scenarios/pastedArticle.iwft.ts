import { articleSourceId, type ExtractedArticle } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";
import { makeArticleOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { articleFailureNoticeTestIds } from "../../../src/features/capture/components/ArticleFailureNotice/ArticleFailureNoticeTestIds.js";
import { articleLinkStatusTestIds } from "../../../src/features/newOverview/components/ArticleLinkStatus/ArticleLinkStatusTestIds.js";
import { generateOverviewFormTestIds } from "../../../src/features/newOverview/components/GenerateOverviewForm/GenerateOverviewFormTestIds.js";
import { CHROME_EXTENSION_URL } from "../../../src/util/chromeExtensionUrl.js";
import { overviewActionsMenuTestIds } from "../../../src/features/reader/components/OverviewActionsMenu/OverviewActionsMenuTestIds.js";
import { regenerateArticleDialogTestIds } from "../../../src/features/reader/components/RegenerateArticleDialog/RegenerateArticleDialogTestIds.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const LINK = "https://theharbourpost.example/2026/11/bridge-bill-twice";
const ARTICLE: ExtractedArticle = {
  url: LINK,
  title: "The town that pays its bridge bill twice",
  siteName: "The Harbour Post",
  author: "Asha Rao",
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011.", links: [] }],
  wordCount: 3220,
  recipe: null,
};

test("a pasted article is named before Generate, then read once and made into a note", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(articleLinkStatusTestIds.found)).toHaveText("Article on The Harbour Post · 14 min read");
  await page.getByTestId(generateOverviewFormTestIds.generateButton).click();

  await expect(page.getByText("Fetching the article")).toBeVisible();
  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.input).toHaveProperty("article.url", LINK);
  expect(backendSimulator.articles.reads()).toEqual([LINK]);
});

test("a site that blocks us sends a desktop reader to the extension, and nothing is offered to generate", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "blocked" });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("theharbourpost.example doesn’t let us read it from here");
  await expect(page.getByRole("link", { name: "Get the extension on the Chrome Web Store" })).toHaveAttribute("href", CHROME_EXTENSION_URL);
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveCount(0);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
});

test("in the extension's own page, a paywall sends the reader to the article and the side panel", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "paywalled", shownWords: 180, siteName: "The Harbour Post" });
  await launcher.launch({ ...SIGNED_IN, surface: "extension" });
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("Only the opening came through");
  await expect(page.getByRole("link", { name: "Open the article in a new tab" })).toHaveAttribute("href", LINK);
  await expect(page.getByText("Then press Create overview in the side panel.")).toBeVisible();
});

test("a link that isn't an article can be cleared and another pasted", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.articles.answerWith({ status: "failed", reason: "nothing-readable" });
  backendSimulator.ourKey.isAvailable();
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();
  const field = page.getByTestId(generateOverviewFormTestIds.urlInput);

  await field.fill(LINK);
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("That link isn’t an article");
  await page.getByTestId(articleFailureNoticeTestIds.way).click();

  await expect(field).toHaveValue("");
  await expect(page.getByTestId(articleFailureNoticeTestIds.root)).toHaveCount(0);
});

test("an article already held replaces Generate with the way to it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  const held = makeArticleOverview();
  backendSimulator.overviews.seed({ ...held, source: { ...held.source, id: await articleSourceId(LINK) } } as never);
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openNewOverview();

  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);

  await expect(page.getByTestId(articleLinkStatusTestIds.held)).toContainText("You already have this article.");
  await expect(page.getByTestId(generateOverviewFormTestIds.generateButton)).toHaveCount(0);
  await page.getByTestId(articleLinkStatusTestIds.openHeld).click();
  await launcher.readerPage.verifyIsShown();
});

test("without an account the field stays YouTube's, and a page link is refused, not fetched", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await launcher.launch({ apiKeys: ANTHROPIC_KEY });
  await launcher.appShell.openNewOverview();

  await expect(page.getByTestId(generateOverviewFormTestIds.urlInput)).not.toHaveAttribute("placeholder", /article/);
  await page.getByTestId(generateOverviewFormTestIds.urlInput).fill(LINK);
  await expect(page.getByTestId(articleLinkStatusTestIds.reading)).toHaveCount(0);
  expect(backendSimulator.articles.reads()).toEqual([]);
});

// OV-285: we keep no copy of an article, so regenerating away from it reads the link again.
test("an article regenerates from its link under the same id, without opening it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  const old = makeArticleOverview();
  backendSimulator.overviews.seed(old);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate", exact: true }).click();

  await expect.poll(() => backendSimulator.ourKey.generations().length).toBe(1);
  expect(backendSimulator.ourKey.generations()[0]?.overviewId).toBe(old.id);
  expect(backendSimulator.articles.reads()).toEqual([LINK]);
  await expect(page.getByTestId(regenerateArticleDialogTestIds.root)).toHaveCount(0);
});

test("an article our server can't read again keeps its note and sends a desktop reader to the extension", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.articles.answerWith({ status: "failed", reason: "blocked" });
  const old = makeArticleOverview();
  backendSimulator.overviews.seed(old);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate", exact: true }).click();

  await launcher.appShell.generationStatusStrip.verifyHasFailed();
  await launcher.appShell.generationStatusStrip.clickDetails();
  await expect(page.getByTestId(articleFailureNoticeTestIds.title)).toHaveText("theharbourpost.example doesn’t let us read it from here");
  await expect(page.getByRole("link", { name: "Get the extension on the Chrome Web Store" })).toHaveAttribute("href", CHROME_EXTENSION_URL);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  expect(await backendSimulator.overviewStore.listOverviews()).toEqual([old]);
});

test("with no account to fetch through, regenerating an article explains that it needs the page open", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeArticleOverview());
  const library = await launcher.launchExpectingLibrary({ apiKeys: ANTHROPIC_KEY });
  await library.nthCard(0).openReader();

  await page.getByTestId(overviewActionsMenuTestIds.trigger).click();
  await page.getByRole("menuitem", { name: "Regenerate…" }).click();

  await expect(page.getByTestId(regenerateArticleDialogTestIds.root)).toContainText("We don’t keep a copy of it");
  expect(backendSimulator.articles.reads()).toEqual([]);
});
