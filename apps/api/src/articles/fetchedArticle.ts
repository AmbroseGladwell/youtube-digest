import { Worker } from "node:worker_threads";
import type { ArticleRead } from "@overview/domain";
import type { FetchedPage } from "./fetchArticlePage.js";

const PARSE_TIMEOUT_MS = 15_000;
const MOST_AT_ONCE = 1;
const UNFINISHED: ArticleRead = { status: "failed", reason: "unfinished" };

let running = 0;
const waiting: (() => void)[] = [];

const turn = async (): Promise<void> => {
  if (running < MOST_AT_ONCE) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
};

const done = (): void => {
  const next = waiting.shift();
  if (next === undefined) running -= 1;
  else next();
};

function parseInWorker(html: string, url: string): Promise<ArticleRead> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./articleParseWorker.js", import.meta.url), { workerData: { html, url } });
    const finish = (read: ArticleRead) => {
      clearTimeout(timer);
      resolve(read);
      void worker.terminate();
    };
    const timer = setTimeout(() => finish(UNFINISHED), PARSE_TIMEOUT_MS);
    worker.once("message", finish);
    worker.once("error", () => finish(UNFINISHED));
  });
}

// Parsing a large page takes seconds of CPU, which on this process would stop every other
// reader's requests, so it happens on a worker, one at a time because a worker holding jsdom
// needs well over 100MB, and is given up on if a page is built to be slow. Giving up is ours,
// not the page's, so it never says the page isn't an article (docs/features/pasted-article-links.md).
export async function fetchedArticle(page: FetchedPage): Promise<ArticleRead> {
  if (page.status !== "page") return page;
  await turn();
  try {
    return await parseInWorker(page.html, page.url);
  } finally {
    done();
  }
}
