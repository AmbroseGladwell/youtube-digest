import type { CandidateResult } from "./JudgeRecord.js";

export type BlindChoice = "A" | "B" | "tie";

export interface BlindPick {
  videoId: string;
  baseline: string;
  candidate: string;
  candidateWasA: boolean;
  choice: BlindChoice;
  result: CandidateResult;
  pickedAt: string;
}
