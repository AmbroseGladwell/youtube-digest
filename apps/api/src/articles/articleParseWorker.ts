import { parentPort } from "node:worker_threads";
import { parseArticlePage } from "./parseArticlePage.js";

parentPort?.on("message", ({ id, html, url }: { id: number; html: string; url: string }) => {
  parentPort?.postMessage({ id, read: parseArticlePage(html, url) });
});
