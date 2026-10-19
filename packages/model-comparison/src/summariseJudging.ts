import type { BlindPick } from "./BlindPick.js";
import { JUDGE_DIMENSIONS, type JudgeDimension } from "./judgeRubric.js";
import type { CandidateResult, JudgeRecord } from "./JudgeRecord.js";
import { pairKey } from "./runJudging.js";

export interface Tally {
  win: number;
  tie: number;
  loss: number;
}

export interface CandidateJudging {
  candidate: string;
  baseline: string;
  judges: string[];
  judged: number;
  unjudged: number;
  judgeCostDollars: number;
  byDimension: Record<JudgeDimension | "overall", Tally>;
  picks: Tally;
  agreement: { agreed: number; compared: number };
}

const emptyTally = (): Tally => ({ win: 0, tie: 0, loss: 0 });

// A tie counts as half a win, so 50% means level with the baseline.
export const winRate = (tally: Tally): number | null => {
  const total = tally.win + tally.tie + tally.loss;
  return total === 0 ? null : (tally.win + tally.tie / 2) / total;
};

export function summariseJudging(judgments: readonly JudgeRecord[], picks: readonly BlindPick[]): CandidateJudging[] {
  const candidates = [...new Set([...judgments.map((record) => record.candidate), ...picks.map((pick) => pick.candidate)])].sort();
  const overallByPair = new Map<string, CandidateResult>(
    judgments
      .filter((record) => record.results !== null)
      .map((record) => [pairKey(record.videoId, record.candidate), record.results!.overall]),
  );

  return candidates.map((candidate) => {
    const mine = judgments.filter((record) => record.candidate === candidate);
    const judged = mine.filter((record) => record.results !== null);
    const byDimension = Object.fromEntries(
      [...JUDGE_DIMENSIONS, "overall" as const].map((dimension) => {
        const tally = emptyTally();
        for (const record of judged) tally[record.results![dimension]] += 1;
        return [dimension, tally];
      }),
    ) as CandidateJudging["byDimension"];

    const myPicks = picks.filter((pick) => pick.candidate === candidate);
    const pickTally = emptyTally();
    for (const pick of myPicks) pickTally[pick.result] += 1;
    const compared = myPicks.filter((pick) => overallByPair.has(pairKey(pick.videoId, pick.candidate)));

    return {
      candidate,
      baseline: mine[0]?.baseline ?? myPicks[0]?.baseline ?? "",
      judges: [...new Set(mine.map((record) => record.judge))],
      judged: judged.length,
      unjudged: mine.length - judged.length,
      judgeCostDollars: mine.reduce((total, record) => total + (record.costDollars ?? 0), 0),
      byDimension,
      picks: pickTally,
      agreement: {
        agreed: compared.filter((pick) => overallByPair.get(pairKey(pick.videoId, pick.candidate)) === pick.result).length,
        compared: compared.length,
      },
    };
  });
}
