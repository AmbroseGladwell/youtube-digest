import { useCallback, useEffect, useState } from "react";
import { sourceKey, type SharedOverview, type ShareToken, type SourceKey } from "@overview/domain";
import {
  isOnboardingProgressKey,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
} from "./onboardingProgressStorage.js";

// The home page's link starts onboarding on the screen after Start (design 46a).
export function startOnboarding(link: string, key: SourceKey | null): void {
  writeOnboardingProgress({ link, sourceKey: key, step: "analytics", topics: [], mayWrite: false, overviewId: null, way: null, share: null });
}

// Save to my overviews on a shared page starts onboarding with the copy as its overview:
// already made, so there is nothing to wait for and no video to check.
export function startOnboardingFromShare(token: ShareToken, snapshot: SharedOverview): void {
  writeOnboardingProgress({
    link: snapshot.note.source.url,
    sourceKey: sourceKey(snapshot.note.source),
    step: "analytics",
    topics: [],
    mayWrite: true,
    overviewId: snapshot.note.id,
    way: null,
    share: { token, snapshot },
  });
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
