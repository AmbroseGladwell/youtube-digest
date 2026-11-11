import type { ArticleRead } from "@overview/domain";
import { createArticleParser } from "./createArticleParser.js";
import type { FetchedPage } from "./fetchArticlePage.js";

const PARSE_TIMEOUT_MS = 15_000;
const PARSE_HEAP_LIMIT_MB = 160;

let parse: ReturnType<typeof createArticleParser> | null = null;

// Parsing takes CPU that would stop every other reader's requests, so it happens on a worker
// (docs/features/pasted-article-links.md, "Parsing").
export async function fetchedArticle(page: FetchedPage): Promise<ArticleRead> {
  if (page.status !== "page") return page;
  parse ??= createArticleParser({
    workerUrl: new URL("./articleParseWorker.js", import.meta.url),
    timeoutMs: PARSE_TIMEOUT_MS,
    heapLimitMb: PARSE_HEAP_LIMIT_MB,
  });
  return parse(page.html, page.url);
}
