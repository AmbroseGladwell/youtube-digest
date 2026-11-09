import type { MeteredCall } from "@overview/generation";
import type { JudgeOutcome, CandidateResult } from "./JudgeRecord.js";
import type { KeyPointDimension, KeyPointsAnswer } from "./keyPointsRubric.js";

export type KeyPointsResults = Record<KeyPointDimension | "overall", CandidateResult>;

export interface KeyPointsJudgeRecord {
  videoId: string;
  baseline: string;
  candidate: string;
  judge: string;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  candidateFirst: KeyPointsAnswer | null;
  candidateSecond: KeyPointsAnswer | null;
  results: KeyPointsResults | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}
