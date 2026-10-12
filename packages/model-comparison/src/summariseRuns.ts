import type { GeneratedOutput } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { checkOverview, type CheckArea } from "./checkOverview.js";
import type { RunRecord } from "./RunRecord.js";

export interface CheckTally {
  area: CheckArea;
  passed: number;
  total: number;
}

export interface ModelSummary {
  name: string;
  runs: number;
  passedFirst: number;
  passedAfterRetry: number;
  failed: number;
  errored: number;
  medianLatencyMs: number | null;
  totalCostDollars: number;
  unpricedRuns: number;
  meanCostDollars: number | null;
  costPerTwentyMinutesDollars: number | null;
  checks: Record<string, CheckTally>;
}

const TWENTY_MINUTES_MS = 20 * 60_000;

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export const videoLengthMs = (fetched: FetchedTranscript): number =>
  fetched.video.durationMs ?? fetched.transcript.at(-1)?.endMs ?? 0;

export const isPassed = (record: RunRecord): boolean =>
  record.outcome === "passed-first" || record.outcome === "passed-after-retry";

export function summariseRuns(
  records: readonly RunRecord[],
  transcripts: ReadonlyMap<string, FetchedTranscript>,
): ModelSummary[] {
  const byModel = new Map<string, RunRecord[]>();
  for (const record of records) {
    const name = `${record.provider}:${record.model}`;
    byModel.set(name, [...(byModel.get(name) ?? []), record]);
  }

  return [...byModel].map(([name, runs]) => {
    const answered = runs.filter((record) => record.outcome !== "errored");
    const priced = answered.filter((record) => record.costDollars !== null);
    const totalCostDollars = runs.reduce((total, record) => total + (record.costDollars ?? 0), 0);
    const pricedLengthMs = priced.reduce(
      (total, record) => total + videoLengthMs(transcripts.get(record.videoId)!),
      0,
    );

    const checks: Record<string, CheckTally> = {};
    for (const record of runs.filter(isPassed)) {
      const fetched = transcripts.get(record.videoId);
      if (fetched === undefined) continue;
      for (const check of checkOverview(record.attempts.at(-1) as GeneratedOutput, fetched)) {
        const tally = (checks[check.check] ??= { area: check.area, passed: 0, total: 0 });
        tally.total += 1;
        if (check.passed) tally.passed += 1;
      }
    }

    return {
      name,
      runs: runs.length,
      passedFirst: runs.filter((record) => record.outcome === "passed-first").length,
      passedAfterRetry: runs.filter((record) => record.outcome === "passed-after-retry").length,
      failed: runs.filter((record) => record.outcome === "failed").length,
      errored: runs.filter((record) => record.outcome === "errored").length,
      medianLatencyMs: median(runs.filter(isPassed).map((record) => record.latencyMs)),
      totalCostDollars,
      unpricedRuns: answered.length - priced.length,
      meanCostDollars:
        priced.length === 0 ? null : priced.reduce((total, record) => total + record.costDollars!, 0) / priced.length,
      costPerTwentyMinutesDollars:
        pricedLengthMs === 0
          ? null
          : (priced.reduce((total, record) => total + record.costDollars!, 0) / pricedLengthMs) * TWENTY_MINUTES_MS,
      checks,
    };
  });
}
