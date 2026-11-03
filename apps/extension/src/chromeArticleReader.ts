import { ArticleRead, type ArticlePlace } from "@overview/domain";
import { ARTICLE_READER_GLOBAL, ARTICLE_PLACE_GLOBAL } from "./content/articleReaderGlobal.js";

const NO_ACCESS: ArticleRead = { status: "failed", reason: "no-access" };
const NOT_LOADED: ArticleRead = { status: "failed", reason: "not-loaded" };
const NOTHING_READABLE: ArticleRead = { status: "failed", reason: "nothing-readable" };

const runInPage = (name: string, ...args: unknown[]): unknown =>
  (globalThis as unknown as Record<string, (...args: unknown[]) => unknown>)[name]?.(...args);

const isShowingAnErrorPage = (error: unknown): boolean => error instanceof Error && /error page/i.test(error.message);

async function isStillLoading(tabId: number): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return tab?.status === "loading";
}

async function runReader(tabId: number, name: string, args: unknown[]): Promise<unknown> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["articleReader.js"] });
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId },
    func: runInPage,
    args: [name, ...args],
  });
  return frame?.result;
}

// Works on a page the reader granted through chromePageAccess, or one activeTab opened
// (docs/features/article-extraction.md). A half-loaded page reads as thin, and that is not
// the page's fault, so it is named as what it is.
export async function readArticleInTab(tabId: number): Promise<ArticleRead> {
  try {
    const read = ArticleRead.safeParse(await runReader(tabId, ARTICLE_READER_GLOBAL, []));
    if (!read.success) return NOTHING_READABLE;
    return read.data.status === "failed" && read.data.reason === "nothing-readable" && (await isStillLoading(tabId))
      ? NOT_LOADED
      : read.data;
  } catch (error) {
    return isShowingAnErrorPage(error) ? NOT_LOADED : NO_ACCESS;
  }
}

// Null is "we could not get into the page to look", which is not "the place has gone".
export async function showArticlePlaceInTab(tabId: number, place: ArticlePlace): Promise<boolean | null> {
  try {
    return (await runReader(tabId, ARTICLE_PLACE_GLOBAL, [place])) === true;
  } catch {
    return null;
  }
}
