import { createContext, useContext } from "react";
import type { OnboardingRun } from "./useOnboardingRun.js";

export interface OnboardingRunState {
  // What this tab knows of the run: its own, or the phase another tab answers with.
  run: OnboardingRun;
  // The run is this tab's. Another tab mirrors it, and takes it over if this tab goes.
  mine: boolean;
  // Which try this is, so a failure is counted once per try.
  attempt: number;
  // Runs it again, here: a tab that was only mirroring takes the run over first.
  retry: () => void;
  // Runs it again transcribing the episode's audio, which the reader chose (design 305c-2).
  transcribe: () => void;
}

const IDLE: OnboardingRun = {
  phase: "fetching",
  found: null,
  overview: null,
  failure: null,
  transcription: null,
  sourceWords: null,
  writingStarted: false,
};

const OnboardingRunContext = createContext<OnboardingRunState>({
  run: IDLE,
  mine: false,
  attempt: 0,
  retry: () => undefined,
  transcribe: () => undefined,
});

export const OnboardingRunProvider = OnboardingRunContext.Provider;

export function useOnboardingRunState(): OnboardingRunState {
  return useContext(OnboardingRunContext);
}
