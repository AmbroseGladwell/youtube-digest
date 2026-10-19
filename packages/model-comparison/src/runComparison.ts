import type { Provider } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import type { RecordStore } from "./jsonRecordStore.js";
import { priceOf } from "./modelPrices.js";
import type { RunOneOptions } from "./runOne.js";
import type { RunRecord } from "./RunRecord.js";
import { spendWithinBudget, totalSpent } from "./spendWithinBudget.js";

export interface RunComparisonOptions {
  models: readonly ComparedModel[];
  keys: Partial<Record<Provider, string>>;
  transcripts: readonly FetchedTranscript[];
  budgetDollars: number;
  store: RecordStore<RunRecord>;
  runOne: (options: RunOneOptions) => Promise<RunRecord>;
  log: (line: string) => void;
}

export interface ComparisonOutcome {
  ran: number;
  skipped: number;
  spentDollars: number;
  stoppedForBudget: boolean;
}

const runKey = (provider: string, model: string, videoId: string) => `${provider}:${model}:${videoId}`;
const videoIdOf = (fetched: FetchedTranscript) => fetched.video.id ?? fetched.video.url;

export function runnableModels(
  models: readonly ComparedModel[],
  keys: Partial<Record<Provider, string>>,
  log: (line: string) => void,
): ComparedModel[] {
  return models.filter((model) => {
    if (priceOf(model) === undefined) {
      log(`skipping ${comparedModelName(model)}: no price in modelPrices.ts, so its spend cannot be capped`);
      return false;
    }
    if (!keys[model.provider]) {
      log(`skipping ${comparedModelName(model)}: no ${model.provider} key in the environment`);
      return false;
    }
    return true;
  });
}

export async function runComparison(options: RunComparisonOptions): Promise<ComparisonOutcome> {
  const previous = await options.store.all();
  const settled = new Set(
    previous
      .filter((record) => record.outcome !== "errored")
      .map((record) => runKey(record.provider, record.model, record.videoId)),
  );

  let skipped = 0;
  const lanes = runnableModels(options.models, options.keys, options.log).map((model) =>
    options.transcripts
      .filter((fetched) => {
        const done = settled.has(runKey(model.provider, model.model, videoIdOf(fetched)));
        if (done) skipped += 1;
        return !done;
      })
      .map((fetched) => () => options.runOne({ model, apiKey: options.keys[model.provider]!, fetched })),
  );

  const outcome = await spendWithinBudget({
    lanes,
    budgetDollars: options.budgetDollars,
    spentDollars: totalSpent(previous),
    save: options.store.save,
    describe: (record, spentDollars) =>
      `${record.provider}:${record.model} ${record.videoId}: ${record.outcome}, ` +
      `${(record.latencyMs / 1000).toFixed(1)}s, $${(record.costDollars ?? 0).toFixed(4)} ` +
      `(spent $${spentDollars.toFixed(4)} of $${options.budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log: options.log,
  });
  return { ...outcome, skipped };
}
