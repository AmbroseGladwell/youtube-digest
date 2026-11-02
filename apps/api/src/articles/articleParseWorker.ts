import { parentPort, workerData } from "node:worker_threads";
import { parseArticlePage } from "./parseArticlePage.js";

const { html, url } = workerData as { html: string; url: string };
parentPort?.postMessage(parseArticlePage(html, url));
