import { useCallback, useSyncExternalStore } from "react";
import { sourceKey, sourceUrl, type SharedOverview, type ShareToken, type SourceKey } from "@overview/domain";
import { onboardingTabId } from "./onboardingTab.js";
import {
  isOnboardingProgressKey,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
} from "./onboardingProgressStorage.js";

// One snapshot per tab, so the runtime's and the page's writes reach each other.
const listeners = new Set<() => void>();
let snapshot: OnboardingProgress | null | undefined;

const getSnapshot = (): OnboardingProgress | null => {
  snapshot ??= readOnboardingProgress();
  return snapshot;
};

const refresh = (): void => {
  snapshot = readOnboardingProgress();
  for (const listener of listeners) {
    listener();
  }
};

const onStorage = (event: StorageEvent): void => {
  if (isOnboardingProgressKey(event.key)) {
    refresh();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      globalThis.removeEventListener?.("storage", onStorage);
    }
  };
};

export const writeProgress = (progress: OnboardingProgress | null): void => {
  writeOnboardingProgress(progress);
  refresh();
};

// Starts on the screen after Start, with the run this tab's (design 46a).
export const startOnboarding = (link: string, key: SourceKey | null, tabId: number | null = null): void => {
  writeProgress({
    link,
    sourceKey: key,
    tabId,
    step: "analytics",
    topics: [],
    mayWrite: false,
    overviewId: null,
    runner: onboardingTabId(),
    way: null,
    landed: null,
    share: null,
  });
};

// The copy is already made, so there is nothing to wait for and no video to check.
export const startOnboardingFromShare = (token: ShareToken, snapshot: SharedOverview, sample = false): void => {
  writeProgress({
    link: sourceUrl(snapshot.note.source),
    sourceKey: sourceKey(snapshot.note.source),
    tabId: null,
    step: "analytics",
    topics: [],
    mayWrite: true,
    overviewId: snapshot.note.id,
    runner: null,
    way: null,
    landed: null,
    share: { token, snapshot, sample },
  });
};

// Read again when another tab changes it: the sign-in link opens in a tab of its own.
export const useOnboardingProgress = () => {
  const progress = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((patch: Partial<OnboardingProgress> | null) => {
    const current = readOnboardingProgress();
    writeProgress(patch === null || current === null ? null : { ...current, ...patch });
  }, []);

  return [progress, update] as const;
};
