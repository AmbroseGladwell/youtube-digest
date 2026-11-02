import { ArticleRead } from "@overview/domain";
import { ARTICLE_READER_GLOBAL } from "./content/articleReaderGlobal.js";

const NO_ACCESS: ArticleRead = { status: "failed", reason: "no-access" };
const NOTHING_READABLE: ArticleRead = { status: "failed", reason: "nothing-readable" };

const runReader = (name: string): unknown => (globalThis as unknown as Record<string, () => unknown>)[name]?.();

// Works on a page the reader granted through chromePageAccess, or one activeTab opened
// (docs/features/article-extraction.md).
export async function readArticleInTab(tabId: number): Promise<ArticleRead> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["articleReader.js"] });
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func: runReader,
      args: [ARTICLE_READER_GLOBAL],
    });
    const read = ArticleRead.safeParse(frame?.result);
    return read.success ? read.data : NOTHING_READABLE;
  } catch {
    return NO_ACCESS;
  }
}
