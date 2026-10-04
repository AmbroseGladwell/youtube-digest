import { AnalyticsConsent } from "./types/AnalyticsConsent.js";

const STORAGE_KEY = "overview.analyticsConsent.v1";

export function readAnalyticsConsent(storage: Storage = globalThis.localStorage): AnalyticsConsent | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return AnalyticsConsent.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(
  consent: AnalyticsConsent | null,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    if (consent === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    return;
  }
}
