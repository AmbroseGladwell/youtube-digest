import type { Overview, Provider } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, parseComparedModel } from "./ComparedModel.js";
import type { RecordStore } from "./jsonRecordStore.js";
import { judgeFor, type JudgePairOptions } from "./judgePair.js";
import type { JudgeRecord } from "./JudgeRecord.js";
import { runnableModels } from "./runComparison.js";
import type { RunRecord } from "./RunRecord.js";
import { isPassed } from "./summariseRuns.js";
import { spendWithinBudget, totalSpent, type SpendOutcome } from "./spendWithinBudget.js";

export interface JudgingPair {
  fetched: FetchedTranscript;
  baseline: { name: string; overview: Overview };
  candidate: { name: string; overview: Overview };
}

const nameOf = (record: RunRecord) => `${record.provider}:${record.model}`;
export const pairKey = (videoId: string, candidate: string) => `${candidate}:${videoId}`;

export function judgingPairs(
  runs: readonly RunRecord[],
  transcripts: ReadonlyMap<string, FetchedTranscript>,
  baseline: string,
): JudgingPair[] {
  const passed = runs.filter((record) => isPassed(record) && record.overview !== null);
  return passed
    .filter((record) => nameOf(record) !== baseline)
    .flatMap((record) => {
      const reference = passed.find((other) => other.videoId === record.videoId && nameOf(other) === baseline);
      const fetched = transcripts.get(record.videoId);
      if (reference === undefined || fetched === undefined) return [];
      return [
        {
          fetched,
          baseline: { name: baseline, overview: reference.overview! },
          candidate: { name: nameOf(record), overview: record.overview! },
        },
      ];
    });
}

export interface RunJudgingOptions {
  pairs: readonly JudgingPair[];
  keys: Partial<Record<Provider, string>>;
  budgetDollars: number;
  store: RecordStore<JudgeRecord>;
  judgePair: (options: JudgePairOptions) => Promise<JudgeRecord>;
  log: (line: string) => void;
}

export async function runJudging(options: RunJudgingOptions): Promise<SpendOutcome & { skipped: number }> {
  const previous = await options.store.all();
  const settled = new Set(
    previous.filter((record) => record.outcome !== "errored").map((record) => pairKey(record.videoId, record.candidate)),
  );

  const byJudge = new Map<string, (() => Promise<JudgeRecord>)[]>();
  let skipped = 0;
  for (const pair of options.pairs) {
    const videoId = pair.fetched.video.id ?? pair.fetched.video.url;
    if (settled.has(pairKey(videoId, pair.candidate.name))) {
      skipped += 1;
      continue;
    }
    const judge = comparedModelName(judgeFor(parseComparedModel(pair.baseline.name), parseComparedModel(pair.candidate.name)));
    byJudge.set(judge, [...(byJudge.get(judge) ?? []), () => options.judgePair({ ...pair, keys: options.keys })]);
  }

  const usable = new Set(
    runnableModels([...byJudge.keys()].map(parseComparedModel), options.keys, options.log).map(comparedModelName),
  );
  const outcome = await spendWithinBudget({
    lanes: [...byJudge].filter(([judge]) => usable.has(judge)).map(([, tasks]) => tasks),
    budgetDollars: options.budgetDollars,
    spentDollars: totalSpent(previous),
    save: options.store.save,
    describe: (record, spentDollars) =>
      `${record.judge} judged ${record.candidate} against ${record.baseline} on ${record.videoId}: ` +
      `${record.results?.overall ?? record.outcome}, $${(record.costDollars ?? 0).toFixed(4)} ` +
      `(spent $${spentDollars.toFixed(4)} of $${options.budgetDollars.toFixed(2)})` +
      (record.error ? `\n    ${record.error.slice(0, 300)}` : ""),
    log: options.log,
  });
  return { ...outcome, skipped };
}
