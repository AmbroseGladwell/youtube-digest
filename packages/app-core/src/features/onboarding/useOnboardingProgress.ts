import { useCallback, useSyncExternalStore } from "react";
import { sourceKey, type SharedOverview, type ShareToken, type SourceKey } from "@overview/domain";
import { onboardingTabId } from "./onboardingTab.js";
import {
  isOnboardingProgressKey,
  readOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
} from "./onboardingProgressStorage.js";

// One snapshot for the tab, as useSyncConnection keeps: the run's runtime above the router and
// the page both read it, and a write by either has to reach the other in the same tab.
const listeners = new Set<() => void>();
let snapshot: OnboardingProgress | null | undefined;

function getSnapshot(): OnboardingProgress | null {
  snapshot ??= readOnboardingProgress();
  return snapshot;
}

function refresh(): void {
  snapshot = readOnboardingProgress();
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (isOnboardingProgressKey(event.key)) refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.("storage", onStorage);
  };
}

export function writeProgress(progress: OnboardingProgress | null): void {
  writeOnboardingProgress(progress);
  refresh();
}

// The home page's link starts onboarding on the screen after Start (design 46a). The run is
// this tab's.
export function startOnboarding(link: string, key: SourceKey | null, tabId: number | null = null): void {
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
    plan: null,
    landed: null,
    share: null,
  });
}

// Save to my overviews on a shared page, or a sample chosen at Start, starts onboarding with
// the copy as its overview: already made, so there is nothing to wait for and no video to check.
export function startOnboardingFromShare(token: ShareToken, snapshot: SharedOverview, sample = false): void {
  writeProgress({
    link: snapshot.note.source.url,
    sourceKey: sourceKey(snapshot.note.source),
    tabId: null,
    step: "analytics",
    topics: [],
    mayWrite: true,
    overviewId: snapshot.note.id,
    runner: null,
    way: null,
    plan: null,
    landed: null,
    share: { token, snapshot, sample },
  });
}

// Onboarding's progress, written through as it changes and read again when another tab
// changes it: the sign-in link opens in a tab of its own.
export function useOnboardingProgress() {
  const progress = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((patch: Partial<OnboardingProgress> | null) => {
    const current = readOnboardingProgress();
    writeProgress(patch === null || current === null ? null : { ...current, ...patch });
  }, []);

  return [progress, update] as const;
}
