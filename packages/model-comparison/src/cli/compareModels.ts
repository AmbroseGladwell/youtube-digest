import { parseArgs } from "node:util";
import { parseComparedModel } from "../ComparedModel.js";
import { comparisonPaths, loadTranscripts, providerKeysFromEnv } from "../comparisonPaths.js";
import { DEFAULT_COMPARED_MODELS } from "../modelPrices.js";
import { runComparison } from "../runComparison.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { runOne } from "../runOne.js";

const USAGE = `usage: task secrets:run -- npm run compare --workspace packages/model-comparison -- \\
  --run <name> [--budget <dollars>] [--limit <videos>] [--models provider:model,...]`;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "10" },
    limit: { type: "string" },
    models: { type: "string" },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}

const transcripts = await loadTranscripts();
if (transcripts.length === 0) {
  console.error("no transcripts yet: npm run fetch-transcripts --workspace packages/model-comparison");
  process.exit(1);
}

const keys = providerKeysFromEnv();

const outcome = await runComparison({
  models: (values.models?.split(",") ?? DEFAULT_COMPARED_MODELS).map((name) => parseComparedModel(name.trim())),
  keys,
  transcripts: values.limit === undefined ? transcripts : transcripts.slice(0, Number(values.limit)),
  budgetDollars,
  store: runDirectoryStore(comparisonPaths.run(values.run)),
  runOne,
  log: (line) => console.error(line),
});

console.error(
  `\n${outcome.ran} run, ${outcome.skipped} already settled, $${outcome.spentDollars.toFixed(4)} spent on this run in all.` +
    (outcome.stoppedForBudget ? ` Stopped at the $${budgetDollars.toFixed(2)} budget.` : ""),
);
console.error(`Report: npm run report --workspace packages/model-comparison -- --run ${values.run}`);
