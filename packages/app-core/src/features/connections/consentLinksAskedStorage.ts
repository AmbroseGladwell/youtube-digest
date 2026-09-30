import { ConsentLinksAsked } from "./types/ConsentLinksAsked.js";

const STORAGE_KEY = "overview.consentLinksAsked.v1";
const KEPT_FOR_MS = 60 * 60 * 1000;

function read(storage: Storage): ConsentLinksAsked {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = ConsentLinksAsked.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// The requests this browser asked a sign-in link for. A link that lands on a request this
// browser never asked about was opened on another device (design 58f).
export function rememberConsentLinkAsked(
  requestId: string,
  now: number,
  storage: Storage = globalThis.localStorage,
): void {
  const kept = read(storage).filter((entry) => entry.requestId !== requestId && now - entry.askedAt < KEPT_FOR_MS);
  storage.setItem(STORAGE_KEY, JSON.stringify([...kept, { requestId, askedAt: now }]));
}

export function wasConsentLinkAskedHere(requestId: string, storage: Storage = globalThis.localStorage): boolean {
  return read(storage).some((entry) => entry.requestId === requestId);
}
