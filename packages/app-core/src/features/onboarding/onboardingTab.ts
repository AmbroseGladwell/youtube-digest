const STORAGE_KEY = "overview.onboarding.tab.v1";

let held: string | null = null;

// docs/features/onboarding.md, "The run lives in one tab".
export const onboardingTabId = (): string => {
  if (held !== null) {
    return held;
  }
  try {
    held = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (held === null) {
      held = crypto.randomUUID();
      globalThis.sessionStorage.setItem(STORAGE_KEY, held);
    }
  } catch {
    held = crypto.randomUUID();
  }
  return held;
};
