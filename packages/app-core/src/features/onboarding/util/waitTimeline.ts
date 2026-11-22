export type WaitPhase = "running" | "ready" | "failed";

export const WAIT_BAR_START = 0.28;
export const WAIT_BAR_PER_STAGE = 0.12;
export const WAIT_BAR_CREEP_END = 0.92;
export const READY_IN_A_MOMENT_SECONDS = 30;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function waitBarFraction({
  phase,
  elapsedSeconds,
  expectedSeconds,
  doneStages,
}: {
  phase: WaitPhase;
  elapsedSeconds: number;
  expectedSeconds: number;
  doneStages: number;
}): number {
  if (phase === "ready") {
    return 1;
  }
  const byTime =
    WAIT_BAR_START + (WAIT_BAR_CREEP_END - WAIT_BAR_START) * clamp01(expectedSeconds > 0 ? elapsedSeconds / expectedSeconds : 1);
  const byStages = Math.min(WAIT_BAR_CREEP_END, WAIT_BAR_START + WAIT_BAR_PER_STAGE * doneStages);
  return Math.max(byTime, byStages);
}

export function waitEstimateLine({
  phase,
  elapsedSeconds,
  expectedSeconds,
}: {
  phase: WaitPhase;
  elapsedSeconds: number;
  expectedSeconds: number;
}): string {
  if (phase === "ready") {
    return "Ready";
  }
  const remaining = expectedSeconds - elapsedSeconds;
  if (remaining <= READY_IN_A_MOMENT_SECONDS) {
    return "Ready in a moment";
  }
  const minutes = Math.ceil(remaining / 60);
  return `About ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
}

export function scriptLineIndex(lineCount: number, secondsIntoStage: number, stageSeconds: number): number {
  if (lineCount === 0) {
    return -1;
  }
  const perLine = Math.max(1, stageSeconds / lineCount);
  return Math.min(lineCount - 1, Math.max(0, Math.floor(secondsIntoStage / perLine)));
}
