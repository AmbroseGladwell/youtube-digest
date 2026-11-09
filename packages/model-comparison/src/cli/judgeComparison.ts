import { parseArgs } from "node:util";
import { comparisonPaths, loadComparison, providerKeysFromEnv } from "../comparisonPaths.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { judgmentStore } from "../judgmentStore.js";
import { BASELINE_MODEL, judgePair } from "../judgePair.js";
import { judgingPairs, promptPairs, runJudging } from "../runJudging.js";

const USAGE = `usage: task secrets:evals -- npm run judge --workspace packages/model-comparison -- \\
  --run <name> [--against <earlier run>] [--budget <dollars>] [--limit <pairs>] [--candidates provider:model,...]

--against judges each model's note in --run against the same model's note in the earlier run,
to compare two prompts rather than two models.`;

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    budget: { type: "string", default: "10" },
    limit: { type: "string" },
    candidates: { type: "string" },
    against: { type: "string" },
  },
});

const budgetDollars = Number(values.budget);
if (!values.run || !Number.isFinite(budgetDollars) || budgetDollars <= 0) {
  console.error(USAGE);
  process.exit(1);
}

const { runs, byVideo } = await loadComparison(values.run);
const only = values.candidates?.split(",").map((name) => name.trim());
const against = values.against === undefined ? null : await runDirectoryStore(comparisonPaths.run(values.against)).all();
const pairs = (against === null ? judgingPairs(runs, byVideo, BASELINE_MODEL) : promptPairs(runs, against, byVideo)).filter(
  (pair) => only === undefined || only.includes(pair.candidate.name),
);
if (pairs.length === 0) {
  console.error(
    against === null
      ? `no pairs to judge: run ${values.run} has no passing ${BASELINE_MODEL} overview beside another model's`
      : `no pairs to judge: no video passed for the same model in both ${values.run} and ${values.against}`,
  );
  process.exit(1);
}

const outcome = await runJudging({
  pairs: values.limit === undefined ? pairs : pairs.slice(0, Number(values.limit)),
  keys: providerKeysFromEnv(),
  budgetDollars,
  store: judgmentStore(comparisonPaths.judgments(values.run)),
  judgePair,
  log: (line) => console.error(line),
});

console.error(
  `\n${outcome.ran} judged, ${outcome.skipped} already settled, $${outcome.spentDollars.toFixed(4)} spent on judging this run in all.` +
    (outcome.stoppedForBudget ? ` Stopped at the $${budgetDollars.toFixed(2)} budget.` : ""),
);
console.error(`Report: npm run report --workspace packages/model-comparison -- --run ${values.run}`);
