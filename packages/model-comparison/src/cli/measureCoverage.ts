import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readArticle } from "@overview/articles";
import { formatTimestamp, wordCount, type ExtractedArticle } from "@overview/domain";
import { articleParagraphs, type GeneratedArticleOutput, type GeneratedOutput } from "@overview/generation";
import { fetchInnerTubeTranscript, withSingleRetry, type FetchedTranscript, type YouTubeFetch } from "@overview/transcripts";
import { JSDOM } from "jsdom";
import { articleCoverageInput } from "../articleCoverageInput.js";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, providerKeysFromEnv } from "../comparisonPaths.js";
import { coverageMarkdown, type CoverageRow } from "../coverageMarkdown.js";
import { COVERAGE_SET, type CoverageSource } from "../coverageSet.js";
import { measureCoverage, type Stretch } from "../measureCoverage.js";
import type { RunRecord } from "../RunRecord.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { runOne } from "../runOne.js";
import { runOneArticle } from "../runOneArticle.js";
import { spendWithinBudget, totalSpent } from "../spendWithinBudget.js";
import { videoCoverageInput } from "../videoCoverageInput.js";

const USAGE = `usage: task secrets:run -- npm run coverage --workspace packages/model-comparison -- \\
  --run <name> [--budget <dollars>] [--model provider:model] [--measure-only]`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "1" },
    model: { type: "string", default: "openai:gpt-6.1-sol" },
    "measure-only": { type: "boolean", default: false },
  },
});
const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}
const log = (line: string) => console.error(line);
const model = parseComparedModel(values.model);

const youTubeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body ?? null });
  return { status: response.status, body: await response.text() };
};
const exists = (path: string) => access(path).then(() => true, () => false);
const videoIdOf = (url: string) => new URL(url).searchParams.get("v")!;
const articleFileOf = (url: string) => `${createHash("sha256").update(url).digest("hex").slice(0, 16)}.json`;

type LoadedSource =
  | { source: CoverageSource; kind: "video"; fetched: FetchedTranscript }
  | { source: CoverageSource; kind: "article"; article: ExtractedArticle };

async function loadSource(source: CoverageSource): Promise<LoadedSource | null> {
  const directory = source.kind === "video" ? comparisonPaths.coverageTranscripts : comparisonPaths.coverageArticles;
  await mkdir(directory, { recursive: true });
  const path = join(directory, source.kind === "video" ? `${videoIdOf(source.url)}.json` : articleFileOf(source.url));
  if (!(await exists(path))) {
    try {
      const fetched =
        source.kind === "video"
          ? await withSingleRetry(() => fetchInnerTubeTranscript(youTubeFetch, videoIdOf(source.url), source.url))
          : await fetchArticle(source.url);
      await writeFile(path, `${JSON.stringify(fetched)}\n`);
      log(`fetched ${source.url}`);
    } catch (error) {
      log(`FAILED  ${source.url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  const saved = JSON.parse(await readFile(path, "utf-8"));
  return source.kind === "video" ? { source, kind: "video", fetched: saved } : { source, kind: "article", article: saved };
}

async function fetchArticle(url: string): Promise<ExtractedArticle> {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; overview-model-comparison)" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const dom = new JSDOM(await response.text(), { url });
  try {
    const read = readArticle(dom.window.document, url);
    if (read.status !== "read") throw new Error(`not readable: ${read.reason}`);
    return read.article;
  } finally {
    dom.window.close();
  }
}

const sourceIdOf = (loaded: LoadedSource) => (loaded.kind === "video" ? loaded.fetched.video.id ?? loaded.fetched.video.url : loaded.article.url);

const loaded = (await Promise.all(COVERAGE_SET.map(loadSource))).filter((source): source is LoadedSource => source !== null);
const store = runDirectoryStore(comparisonPaths.run(values.run));

if (!values["measure-only"]) {
  const apiKey = providerKeysFromEnv()[model.provider];
  if (!apiKey) {
    console.error(`no ${model.provider} key in the environment`);
    process.exit(1);
  }
  const settled = new Set((await store.all()).filter((record) => record.outcome !== "errored").map((record) => record.videoId));
  const tasks = loaded
    .filter((source) => !settled.has(sourceIdOf(source)))
    .map((source) => () =>
      source.kind === "video" ? runOne({ model, apiKey, fetched: source.fetched }) : runOneArticle({ model, apiKey, article: source.article }),
    );
  const outcome = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: totalSpent(await store.all()),
    save: store.save,
    describe: (record, spent) =>
      `${record.videoId}: ${record.outcome}${record.error ? ` (${record.error.slice(0, 120)})` : ""}, ` +
      `$${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})`,
    log,
  });
  if (outcome.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget.`);
}

const records = new Map(
  (await store.all()).filter((record) => record.model === model.model).map((record) => [record.videoId, record] as const),
);
const passed = (record: RunRecord | undefined) => record !== undefined && (record.outcome === "passed-first" || record.outcome === "passed-after-retry");

function videoRow(fetched: FetchedTranscript, record: RunRecord | undefined): CoverageRow {
  const words = fetched.transcript.reduce((total, { text }) => total + wordCount(text), 0);
  const length = `${formatTimestamp(fetched.video.durationMs ?? fetched.transcript.at(-1)?.endMs ?? 0)}, ${words.toLocaleString("en-GB")} words`;
  const coverage = passed(record) ? measureCoverage(videoCoverageInput(fetched, record!.attempts.at(-1) as GeneratedOutput)) : null;
  const place = (gap: Stretch) => `${formatTimestamp(fetched.transcript[gap.start]!.startMs)}–${formatTimestamp(fetched.transcript[gap.end]!.endMs)}`;
  return {
    title: fetched.video.title,
    kind: "video",
    length,
    outcome: record?.outcome ?? "not run",
    coverage,
    gapPlace: coverage?.largestGap ? place(coverage.largestGap) : null,
  };
}

function articleRow(article: ExtractedArticle, record: RunRecord | undefined): CoverageRow {
  const coverage = passed(record) ? measureCoverage(articleCoverageInput(article, record!.attempts.at(-1) as GeneratedArticleOutput)) : null;
  const paragraphs = articleParagraphs(article).length;
  return {
    title: article.title,
    kind: "article",
    length: `${article.wordCount.toLocaleString("en-GB")} words, ${paragraphs} paragraphs`,
    outcome: record?.outcome ?? "not run",
    coverage,
    gapPlace: coverage?.largestGap ? `paragraphs ${coverage.largestGap.start + 1}–${coverage.largestGap.end + 1}` : null,
  };
}

const rows = loaded.map((source) =>
  source.kind === "video" ? videoRow(source.fetched, records.get(sourceIdOf(source))) : articleRow(source.article, records.get(sourceIdOf(source))),
);
const markdown = coverageMarkdown(rows, values.run, values.model);
const reportPath = join(comparisonPaths.run(values.run), "coverage.md");
await mkdir(comparisonPaths.run(values.run), { recursive: true });
await writeFile(reportPath, markdown);
console.log(markdown);
log(`Written to ${reportPath}`);
