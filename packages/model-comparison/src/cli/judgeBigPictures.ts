import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { bigPictureMarkdown } from "../bigPictureMarkdown.js";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadComparison, providerKeysFromEnv } from "../comparisonPaths.js";
import { judgeBigPicture, type BigPictureJudgeRecord } from "../judgeBigPicture.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import { spendWithinBudget, totalSpent } from "../spendWithinBudget.js";

const USAGE = `usage: task secrets:evals -- npm run judge-big-picture --workspace packages/model-comparison -- \\
  --run <name> [--budget <dollars>] [--measure-only]

Runs the deletion test on every big picture in --run: would a reader of In one line and the core
claim lose anything if it were removed? Judges notes that already exist: it generates none.`;

const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "1" },
    "measure-only": { type: "boolean", default: false },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}
const log = (line: string) => console.error(line);

const { runs, byVideo } = await loadComparison(values.run);
const directory = comparisonPaths.bigPictureJudgments(values.run);
const store = jsonRecordStore<BigPictureJudgeRecord>(
  directory,
  (record) => `${safePathPart(record.writer)}/${safePathPart(record.videoId)}.json`,
);

if (!values["measure-only"]) {
  const previous = await store.all();
  const settled = new Set(previous.filter((record) => record.outcome !== "errored").map((record) => `${record.writer}:${record.videoId}`));
  const keys = providerKeysFromEnv();
  const tasks = runs
    .filter((run) => run.overview !== null && run.overview.bigPicture !== null && byVideo.has(run.videoId))
    .filter((run) => !settled.has(`${run.provider}:${run.model}:${run.videoId}`))
    .map(
      (run) => () =>
        judgeBigPicture({
          videoId: run.videoId,
          overview: run.overview!,
          writer: parseComparedModel(`${run.provider}:${run.model}`),
          keys,
        }),
    );
  const outcome = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: totalSpent(previous),
    save: store.save,
    describe: (record, spent) =>
      `${record.judge} judged ${record.writer} on ${record.videoId}: ${record.labels?.deletion ?? record.outcome}, ` +
      `$${(record.costDollars ?? 0).toFixed(4)} (spent $${spent.toFixed(4)} of $${budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log,
  });
  if (outcome.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget.`);
}

const markdown = bigPictureMarkdown(runs, await store.all(), byVideo, values.run);
await mkdir(directory, { recursive: true });
const reportPath = join(directory, "report.md");
await writeFile(reportPath, markdown);
console.log(markdown);
log(`Written to ${reportPath}`);
