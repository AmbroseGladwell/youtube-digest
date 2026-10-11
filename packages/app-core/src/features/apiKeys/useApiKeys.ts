import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import type { Provider } from "@overview/domain";
import type { ApiKeys } from "./ApiKeys.js";
import { readApiKeys, writeApiKeys } from "./apiKeyStorage.js";

export interface UseApiKeysResult {
  apiKeys: ApiKeys;
  saveKey: (provider: Provider, key: string) => void;
  removeKey: (provider: Provider) => void;
  removeAllKeys: () => void;
}

// The keys are read in several places at once — the masthead's generate form, the capture
// screen and the settings page — so the hook reads one shared snapshot rather than each
// caller holding its own useState copy, which would leave the form still disabled after
// the keys were saved. The cached snapshot is what keeps getSnapshot referentially stable
// between writes.
const listeners = new Set<() => void>();
let snapshot: ApiKeys | null = null;

function getSnapshot(): ApiKeys {
  snapshot ??= readApiKeys();
  return snapshot;
}

function refresh(): void {
  snapshot = readApiKeys();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  globalThis.addEventListener?.("storage", refresh);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) globalThis.removeEventListener?.("storage", refresh);
  };
}

export function useApiKeys(): UseApiKeysResult {
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
}
