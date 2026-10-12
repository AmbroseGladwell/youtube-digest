import type { Provider } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import { priceOf } from "./modelPrices.js";
import type { RunOneOptions } from "./runOne.js";
import type { RunRecord } from "./RunRecord.js";

export interface RunStore {
  all(): Promise<RunRecord[]>;
  save(record: RunRecord): Promise<void>;
}

export interface RunComparisonOptions {
  models: readonly ComparedModel[];
  keys: Partial<Record<Provider, string>>;
  transcripts: readonly FetchedTranscript[];
  budgetDollars: number;
  store: RunStore;
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

export async function runComparison(options: RunComparisonOptions): Promise<ComparisonOutcome> {
  const previous = await options.store.all();
  const settled = new Set(
    previous
      .filter((record) => record.outcome !== "errored")
      .map((record) => runKey(record.provider, record.model, record.videoId)),
  );
  let spentDollars = previous.reduce((total, record) => total + (record.costDollars ?? 0), 0);
  let stoppedForBudget = false;
  let ran = 0;
  let skipped = 0;

  const runnable = options.models.filter((model) => {
    if (priceOf(model) === undefined) {
      options.log(`skipping ${comparedModelName(model)}: no price in modelPrices.ts, so its spend cannot be capped`);
      return false;
    }
    if (!options.keys[model.provider]) {
      options.log(`skipping ${comparedModelName(model)}: no ${model.provider} key in the environment`);
      return false;
    }
    return true;
  });

  const work = async (model: ComparedModel) => {
    for (const fetched of options.transcripts) {
      if (settled.has(runKey(model.provider, model.model, videoIdOf(fetched)))) {
        skipped += 1;
        continue;
      }
      if (spentDollars >= options.budgetDollars) {
        stoppedForBudget = true;
        return;
      }
      const record = await options.runOne({ model, apiKey: options.keys[model.provider]!, fetched });
      spentDollars += record.costDollars ?? 0;
      ran += 1;
      await options.store.save(record);
      options.log(
        `${comparedModelName(model)} ${record.videoId}: ${record.outcome}, ` +
          `${(record.latencyMs / 1000).toFixed(1)}s, $${(record.costDollars ?? 0).toFixed(4)} ` +
          `(spent $${spentDollars.toFixed(4)} of $${options.budgetDollars.toFixed(2)})` +
          (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
      );
    }
  };

  await Promise.all(runnable.map(work));
  return { ran, skipped, spentDollars, stoppedForBudget };
}
