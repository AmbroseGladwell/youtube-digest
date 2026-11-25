import { ArticleRead, type ArticlePlace } from "@overview/domain";
import { ARTICLE_READER_GLOBAL, ARTICLE_PLACE_GLOBAL } from "./content/articleReaderGlobal.js";

const NO_ACCESS: ArticleRead = { status: "failed", reason: "no-access" };
const NOT_LOADED: ArticleRead = { status: "failed", reason: "not-loaded" };
const NOTHING_READABLE: ArticleRead = { status: "failed", reason: "nothing-readable" };

const runInPage = (name: string, ...args: unknown[]): unknown =>
  (globalThis as unknown as Record<string, (...args: unknown[]) => unknown>)[name]?.(...args);

const isShowingAnErrorPage = (error: unknown): boolean => error instanceof Error && /error page/i.test(error.message);

const isStillLoading = async (tabId: number): Promise<boolean> => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return tab?.status === "loading";
};

const runReader = async (tabId: number, name: string, args: unknown[]): Promise<unknown> => {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["articleReader.js"] });
  const [frame] = await chrome.scripting.executeScript({
    target: { tabId },
    func: runInPage,
    args: [name, ...args],
  });
  return frame?.result;
};

// A half-loaded page reads as thin through no fault of its own, so it is named as what it is.
export const readArticleInTab = async (tabId: number): Promise<ArticleRead> => {
  try {
    const read = ArticleRead.safeParse(await runReader(tabId, ARTICLE_READER_GLOBAL, []));
    if (!read.success) {
      return NOTHING_READABLE;
    }
    return read.data.status === "failed" && read.data.reason === "nothing-readable" && (await isStillLoading(tabId))
      ? NOT_LOADED
      : read.data;
  } catch (error) {
    return isShowingAnErrorPage(error) ? NOT_LOADED : NO_ACCESS;
  }
};

// Null is "we couldn't get into the page to look", not "the place has gone".
export const showArticlePlaceInTab = async (tabId: number, place: ArticlePlace): Promise<boolean | null> => {
  try {
    return (await runReader(tabId, ARTICLE_PLACE_GLOBAL, [place])) === true;
  } catch {
    return null;
  }
};

const LOAD_TIMEOUT_MS = 30_000;

const loaded = (tabId: number): Promise<void> =>
  new Promise((resolve) => {
    const changed = (updated: number, change: chrome.tabs.TabChangeInfo) => {
      if (updated === tabId && change.status === "complete") {
        done();
      }
    };
    const timer = setTimeout(() => done(), LOAD_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(changed);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(changed);
    void chrome.tabs.get(tabId).then(
      (tab) => tab.status === "complete" && done(),
      () => done(),
    );
  });

// A kept link is read in a tab of its own, out of sight, then closed (docs/features/kept-links.md, "Only the extension can read").
export const readArticleAt = async (url: string): Promise<ArticleRead> => {
  const tab = await chrome.tabs.create({ url, active: false }).catch(() => null);
  if (tab?.id === undefined) {
    return NOT_LOADED;
  }
  try {
    await loaded(tab.id);
    return await readArticleInTab(tab.id);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
};
