import { parentPort } from "node:worker_threads";
import { parseArticlePage } from "./parseArticlePage.js";

interface ArticleParseJob {
  id: number;
  html: string;
  url: string;
}

parentPort?.on("message", ({ id, html, url }: ArticleParseJob) => {
  parentPort?.postMessage({ id, read: parseArticlePage(html, url) });
});
