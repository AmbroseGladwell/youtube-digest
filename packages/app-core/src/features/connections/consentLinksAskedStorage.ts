import { ConsentLinksAsked } from "./types/ConsentLinksAsked.js";

const STORAGE_KEY = "overview.consentLinksAsked.v1";
const KEPT_FOR_MS = 60 * 60 * 1000;

const read = (storage: Storage): ConsentLinksAsked => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = ConsentLinksAsked.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

// A link landing on a request never asked about here was opened on another device.
export const rememberConsentLinkAsked = (requestId: string, now: number, storage: Storage = globalThis.localStorage): void => {
  const kept = read(storage).filter((entry) => entry.requestId !== requestId && now - entry.askedAt < KEPT_FOR_MS);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...kept, { requestId, askedAt: now }]));
  } catch {
    return;
  }
};

export const wasConsentLinkAskedHere = (requestId: string, storage: Storage = globalThis.localStorage): boolean => {
  return read(storage).some((entry) => entry.requestId === requestId);
};
