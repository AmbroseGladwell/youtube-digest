import type { MeteredCall } from "./meteredFetch.js";
import type { JudgeAnswer, JudgeDimension } from "./judgeRubric.js";

export type JudgeOutcome = "judged" | "failed" | "errored";
export type CandidateResult = "win" | "tie" | "loss";

export interface JudgeRecord {
  videoId: string;
  baseline: string;
  candidate: string;
  judge: string;
  candidateIsA: boolean;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  answer: JudgeAnswer | null;
  results: Record<JudgeDimension | "overall", CandidateResult> | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}
