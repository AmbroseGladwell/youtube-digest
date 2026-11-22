import { useCallback, useSyncExternalStore } from "react";
import type { Provider } from "@overview/domain";
import type { ApiKeys } from "./ApiKeys.js";
import { readApiKeys, writeApiKeys } from "./apiKeyStorage.js";

export interface UseApiKeysResult {
  apiKeys: ApiKeys;
  saveKey: (provider: Provider, key: string) => void;
  removeKey: (provider: Provider) => void;
  removeAllKeys: () => void;
}

// One shared snapshot, not a useState copy per caller, so a save reaches every form at once.
const listeners = new Set<() => void>();
let snapshot: ApiKeys | null = null;

const getSnapshot = (): ApiKeys => {
  snapshot ??= readApiKeys();
  return snapshot;
};

const refresh = (): void => {
  snapshot = readApiKeys();
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      globalThis.removeEventListener?.("storage", refresh);
    }
  };
};

export const useApiKeys = (): UseApiKeysResult => {
  const apiKeys = useSyncExternalStore(subscribe, getSnapshot);

  const saveKey = useCallback((provider: Provider, key: string) => {
    const current = getSnapshot();
    writeApiKeys({ keys: { ...current.keys, [provider]: { key, addedAt: new Date().toISOString() } } });
    refresh();
  }, []);

  const removeKey = useCallback((provider: Provider) => {
    const { [provider]: _removed, ...rest } = getSnapshot().keys;
    writeApiKeys({ keys: rest });
    refresh();
  }, []);

  const removeAllKeys = useCallback(() => {
    writeApiKeys({ keys: {} });
    refresh();
  }, []);

  return { apiKeys, saveKey, removeKey, removeAllKeys };
};
