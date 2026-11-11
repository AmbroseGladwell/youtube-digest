import { Worker } from "node:worker_threads";
import type { ArticleRead } from "@overview/domain";

const UNFINISHED: ArticleRead = { status: "failed", reason: "unfinished" };

interface Job {
  id: number;
  html: string;
  url: string;
  resolve: (read: ArticleRead) => void;
}

export interface ArticleParserOptions {
  workerUrl: URL;
  timeoutMs: number;
  heapLimitMb: number;
}

export type ArticleParser = (html: string, url: string) => Promise<ArticleRead>;

// One warm worker, one page at a time, replaced whenever a page outruns the limit or the
// worker fails (docs/features/pasted-article-links.md, "Parsing").
export function createArticleParser({ workerUrl, timeoutMs, heapLimitMb }: ArticleParserOptions): ArticleParser {
  const waiting: Job[] = [];
  let worker: Worker | null = null;
  let current: { job: Job; timer: NodeJS.Timeout } | null = null;
  let nextId = 0;

  const settle = (read: ArticleRead) => {
    if (current === null) return;
    clearTimeout(current.timer);
    current.job.resolve(read);
    current = null;
    setImmediate(next);
  };

  const replaceWorker = () => {
    const failed = worker;
    worker = null;
    void failed?.terminate();
  };

  const startWorker = (): Worker => {
    const started = new Worker(workerUrl, { resourceLimits: { maxOldGenerationSizeMb: heapLimitMb } });
    started.on("message", ({ id, read }: { id: number; read: ArticleRead }) => {
      if (started === worker && current?.job.id === id) settle(read);
    });
    started.on("error", () => {
      if (started !== worker) return;
      replaceWorker();
      settle(UNFINISHED);
    });
    started.on("exit", () => {
      if (started !== worker) return;
      worker = null;
      settle(UNFINISHED);
    });
    started.unref();
    return started;
  };

  const next = () => {
    if (current !== null) return;
    const job = waiting.shift();
    if (job === undefined) return;
    worker ??= startWorker();
    const timer = setTimeout(() => {
      replaceWorker();
      settle(UNFINISHED);
    }, timeoutMs);
    current = { job, timer };
    worker.postMessage({ id: job.id, html: job.html, url: job.url });
  };

  return (html, url) =>
    new Promise((resolve) => {
      nextId += 1;
      waiting.push({ id: nextId, html, url, resolve });
      next();
    });
}
