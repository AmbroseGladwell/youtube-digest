import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { comparedModelName, parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadComparison, providerKeysFromEnv } from "../comparisonPaths.js";
import { extractActionableItems, type ActionableItemsRecord } from "../extractActionableItems.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import { judgeStepsCarried, type StepsJudgeRecord } from "../judgeStepsCarried.js";
import { spendWithinBudget } from "../spendWithinBudget.js";
import { stepsMarkdown, stepsNotes } from "../stepsMarkdown.js";
import { videoStepsSource } from "../StepsSource.js";

const USAGE = `usage: task secrets:evals -- npm run steps --workspace packages/model-comparison -- \\
  --run <name> [--budget <dollars>] [--judge provider:model] [--sources id,id] [--relist] [--rejudge] [--list-only] [--measure-only]

For each note in --run, how much of what its source tells the reader to do it carries (OV-251).
A judge from a provider that wrote none of the notes lists each source's actionable items once,
kept for every later run, then checks each note against them. Generates no notes.

--budget is what this invocation may spend, whatever earlier runs spent. --sources limits it to
those sources; --relist lists them again (after a change to the listing prompt); --rejudge
judges their notes again (after a change to the judging prompt); --list-only
lists without judging, to check the lists before paying to judge against them.`;

// A third provider, so it never reads a note its own provider wrote, for either writer, and one
// list per source keeps every run comparable (owner, 11 Nov 2026).
const DEFAULT_JUDGE = "gemini:gemini-3.1-pro-preview";
const LANES = 4;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "1" },
    judge: { type: "string", default: DEFAULT_JUDGE },
    sources: { type: "string" },
    relist: { type: "boolean", default: false },
    rejudge: { type: "boolean", default: false },
    "list-only": { type: "boolean", default: false },
    "measure-only": { type: "boolean", default: false },
  },
});
const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}
const log = (line: string) => console.error(line);
const judge = parseComparedModel(values.judge);
const chosen = values.sources === undefined ? null : new Set(values.sources.split(",").map((id) => id.trim()));
const isChosen = (sourceId: string) => chosen === null || chosen.has(sourceId);

const { runs, byVideo } = await loadComparison(values.run);
const sources = new Map([...byVideo].map(([id, fetched]) => [id, videoStepsSource(fetched)]));
// The store reads one folder per group, so each judge's lists sit in a folder of its own.
const store = jsonRecordStore<ActionableItemsRecord>(
  comparisonPaths.actionableItems,
  (record) => `${safePathPart(record.judge)}/${safePathPart(record.sourceId)}.json`,
);
const lists = {
  save: store.save,
  all: async () => (await store.all()).filter((record) => record.judge === comparedModelName(judge)),
};
const directory = comparisonPaths.stepsJudgments(values.run);
const judgments = jsonRecordStore<StepsJudgeRecord>(
  directory,
  (record) => `${safePathPart(record.writer)}/${safePathPart(record.videoId)}.json`,
);

if (!values["measure-only"]) {
  const keys = providerKeysFromEnv();
  const listed = new Set((await lists.all()).filter((record) => record.outcome === "judged").map((record) => record.sourceId));
  const needed = [
    ...new Set(runs.filter((run) => run.overview !== null && sources.has(run.videoId) && isChosen(run.videoId)).map((run) => run.videoId)),
  ];
  const toList = needed.filter((id) => values.relist || !listed.has(id));
  const listing = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) =>
      toList
        .filter((_, index) => index % LANES === lane)
        .map((id) => () => extractActionableItems({ source: sources.get(id)!, judge, keys })),
    ),
    budgetDollars,
    spentDollars: 0,
    save: lists.save,
    describe: (record, total) =>
      `listed ${record.sourceId}: ${record.items === null ? record.outcome : `${record.items.length} items`}, ` +
      `$${(record.costDollars ?? 0).toFixed(4)} (spent $${total.toFixed(4)} of $${budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log,
  });
  if (listing.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget while listing items.`);
  if (values["list-only"]) {
    for (const record of (await lists.all()).filter((list) => toList.includes(list.sourceId))) {
      log(`\n${record.sourceId}:`);
      for (const [index, item] of (record.items ?? []).entries()) {
        log(
          `  ${index + 1}. [${item.kind}] ${item.text} (${item.start < 0 ? "no place" : sources.get(record.sourceId)!.placeOf(item.start)})`,
        );
      }
    }
    log(`\nListed ${toList.length}, $${listing.spentDollars.toFixed(4)} spent. Nothing judged (--list-only).`);
    process.exit(0);
  }

  const itemsOf = new Map((await lists.all()).filter((record) => record.items !== null).map((record) => [record.sourceId, record.items!]));
  const settled = new Set(
    (await judgments.all()).filter((record) => record.outcome !== "errored").map((record) => `${record.writer}:${record.videoId}`),
  );
  const tasks = runs
    .filter((run) => run.overview !== null && run.overview.recipe == null && (itemsOf.get(run.videoId)?.length ?? 0) > 0)
    .filter((run) => values.rejudge || !settled.has(`${run.provider}:${run.model}:${run.videoId}`))
    .filter((run) => run.provider !== judge.provider && isChosen(run.videoId))
    .map(
      (run) => () =>
        judgeStepsCarried({
          videoId: run.videoId,
          overview: run.overview!,
          items: itemsOf.get(run.videoId)!,
          writer: parseComparedModel(`${run.provider}:${run.model}`),
          judge,
          keys,
        }),
    );
  const judging = await spendWithinBudget({
    lanes: Array.from({ length: LANES }, (_, lane) => tasks.filter((_, index) => index % LANES === lane)),
    budgetDollars,
    spentDollars: listing.spentDollars,
    save: judgments.save,
    describe: (record, total) =>
      `judged ${record.writer} on ${record.videoId}: ${record.labels?.items.map(({ verdict }) => verdict[0]).join("") ?? record.outcome}, ` +
      `$${(record.costDollars ?? 0).toFixed(4)} (spent $${total.toFixed(4)} of $${budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log,
  });
  if (judging.stoppedForBudget) log(`Stopped at the $${budgetDollars.toFixed(2)} budget while judging notes.`);
}

const markdown = stepsMarkdown(stepsNotes(runs, sources, await lists.all(), await judgments.all()), values.run);
await mkdir(directory, { recursive: true });
const reportPath = join(directory, "report.md");
await writeFile(reportPath, markdown);
console.log(markdown);
log(`Written to ${reportPath}`);
