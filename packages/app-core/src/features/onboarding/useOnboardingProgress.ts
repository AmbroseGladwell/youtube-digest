import { useCallback, useEffect, useState } from "react";
import {
  isOnboardingProgressKey,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
} from "./onboardingProgressStorage.js";

// The home page's link starts onboarding on the screen after Start (design 46a).
export function startOnboarding(link: string, videoUrl: string | null): void {
  writeOnboardingProgress({ link, videoUrl, step: "analytics", topics: [], mayWrite: false, overviewId: null, way: null });
}

// Onboarding's progress, written through as it changes and read again when another tab
// changes it: the sign-in link opens in a tab of its own.
export function useOnboardingProgress() {
  const [progress, setProgress] = useState(readOnboardingProgress);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (isOnboardingProgressKey(event.key)) setProgress(readOnboardingProgress());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<OnboardingProgress> | null) => {
    const current = readOnboardingProgress();
    const next = patch === null || current === null ? null : { ...current, ...patch };
    writeOnboardingProgress(next);
    setProgress(next);
  }, []);

  return [progress, update] as const;
}
