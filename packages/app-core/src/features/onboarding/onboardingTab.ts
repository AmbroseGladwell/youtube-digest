const STORAGE_KEY = "overview.onboarding.tab.v1";

let held: string | null = null;

// This tab, for as long as it's open: the run lives in the tab that started onboarding, and a
// reload of that tab is still that tab (docs/features/onboarding.md, "The run lives in one tab").
export function onboardingTabId(): string {
  if (held !== null) return held;
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
}
