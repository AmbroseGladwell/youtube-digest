import { DeviceAccountHistory, NO_ACCOUNT_HISTORY } from "./types/DeviceAccountHistory.js";

const STORAGE_KEY = "overview.deviceAccountHistory.v1";

export function readDeviceAccountHistory(storage: Storage = globalThis.localStorage): DeviceAccountHistory {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return NO_ACCOUNT_HISTORY;
    return DeviceAccountHistory.safeParse(JSON.parse(raw)).data ?? NO_ACCOUNT_HISTORY;
  } catch {
    return NO_ACCOUNT_HISTORY;
  }
}

export function writeDeviceAccountHistory(
  history: DeviceAccountHistory,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    return;
  }
}
