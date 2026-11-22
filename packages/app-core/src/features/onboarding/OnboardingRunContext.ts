import { createContext, useContext } from "react";
import type { OnboardingRun } from "./useOnboardingRun.js";

export interface OnboardingRunState {
  // This tab's own, or the phase another tab answers with.
  run: OnboardingRun;
  mine: boolean;
  // So a failure is counted once per try.
  attempt: number;
  // A tab that was only mirroring takes the run over first.
  retry: () => void;
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

export const useOnboardingRunState = (): OnboardingRunState => {
  return useContext(OnboardingRunContext);
};
