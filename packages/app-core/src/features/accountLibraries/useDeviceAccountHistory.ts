import { useSyncExternalStore } from "react";
import { readDeviceAccountHistory, writeDeviceAccountHistory } from "./deviceAccountHistoryStorage.js";
import type { DeviceAccountHistory } from "./types/DeviceAccountHistory.js";

// One shared snapshot, as useSyncConnection keeps: sign-out writes it from the sync
// runtime, and the strip, the library and Settings all have to see the write at once.
const listeners = new Set<() => void>();
let snapshot: DeviceAccountHistory | null = null;

function getSnapshot(): DeviceAccountHistory {
  snapshot ??= readDeviceAccountHistory();
  return snapshot;
}

function update(change: Partial<DeviceAccountHistory>): void {
  const next = { ...getSnapshot(), ...change };
  writeDeviceAccountHistory(next);
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const rememberSignedOutHere = (): void => update({ signedOutHere: true });
export const forgetSignedOutHere = (): void => {
  if (getSnapshot().signedOutHere) update({ signedOutHere: false });
};
export const dismissAccountOffer = (): void => update({ offerDismissed: true });

export function useDeviceAccountHistory(): DeviceAccountHistory {
  return useSyncExternalStore(subscribe, getSnapshot);
}
