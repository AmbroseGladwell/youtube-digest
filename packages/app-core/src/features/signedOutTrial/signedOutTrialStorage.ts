import { NO_TRIAL, SignedOutTrial } from "./types/SignedOutTrial.js";

const STORAGE_KEY = "overview.signedOutTrial.v1";

export function readSignedOutTrial(storage: Storage = globalThis.localStorage): SignedOutTrial {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return NO_TRIAL;
    return SignedOutTrial.safeParse(JSON.parse(raw)).data ?? NO_TRIAL;
  } catch {
    return NO_TRIAL;
  }
}

export function writeSignedOutTrial(trial: SignedOutTrial, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(trial));
  } catch {
    return;
  }
}
