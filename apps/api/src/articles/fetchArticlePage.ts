import type { ArticleRead } from "@overview/domain";
import { createPublicWebFetch, readBodyText, type PublicWebAnswer, type PublicWebFetchOptions } from "../publicWeb/createPublicWebFetch.js";

type ArticleFailure = Extract<ArticleRead, { status: "failed" }>;
export type FetchedPage = { status: "page"; url: string; html: string } | ArticleFailure;

const MOST_BYTES = 3 * 1024 * 1024;

const failed = (reason: ArticleFailure["reason"]): ArticleFailure => ({ status: "failed", reason });

const ARTICLE_FAILURE: Record<Extract<PublicWebAnswer, { status: "failed" }>["reason"], ArticleFailure["reason"]> = {
  closed: "not-found",
  blocked: "blocked",
  missing: "not-found",
  "no-answer": "no-answer",
};

export interface ArticlePageFetcherOptions extends PublicWebFetchOptions {
  mostBytes?: number;
}

// docs/features/pasted-article-links.md
export function createArticlePageFetcher({ mostBytes = MOST_BYTES, ...options }: ArticlePageFetcherOptions = {}) {
  const fetchPublicWeb = createPublicWebFetch(options);

  return async function fetchArticlePage(link: string): Promise<FetchedPage> {
    const answer = await fetchPublicWeb(link, { accept: "text/html,application/xhtml+xml" });
    if (answer.status === "failed") return failed(ARTICLE_FAILURE[answer.reason]);
    const { response, url } = answer;
    if (!/\b(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      return failed("nothing-readable");
    }
    try {
      const html = await readBodyText(response, mostBytes);
      return html === null ? failed("nothing-readable") : { status: "page", url, html };
    } catch {
      return failed("no-answer");
    }
  };
}
