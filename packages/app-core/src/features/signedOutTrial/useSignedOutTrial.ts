import { useSyncExternalStore } from "react";
import { readSignedOutTrial, writeSignedOutTrial } from "./signedOutTrialStorage.js";
import type { SignedOutTrial } from "./types/SignedOutTrial.js";

// One shared snapshot, as useDeviceAccountHistory keeps: a run counts its overview from the
// generation pipeline, and every surface offering Create has to see the count at once.
const listeners = new Set<() => void>();
let snapshot: SignedOutTrial | null = null;

export function currentSignedOutTrial(): SignedOutTrial {
  snapshot ??= readSignedOutTrial();
  return snapshot;
}

function update(change: Partial<SignedOutTrial>): void {
  const next = { ...currentSignedOutTrial(), ...change };
  writeSignedOutTrial(next);
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const countSignedOutOverview = (): void => update({ made: currentSignedOutTrial().made + 1 });
export const rememberTrialToken = (token: string): void => update({ token });
export const forgetTrialToken = (): void => update({ token: null });

export function useSignedOutTrial(): SignedOutTrial {
  return useSyncExternalStore(subscribe, currentSignedOutTrial);
}
