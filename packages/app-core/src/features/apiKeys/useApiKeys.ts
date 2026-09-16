import { useCallback, useState } from "react";
import { ApiKeys } from "./ApiKeys.js";
import { readApiKeys, writeApiKeys } from "./apiKeyStorage.js";

export interface UseApiKeysResult {
  apiKeys: ApiKeys;
  setApiKeys: (patch: Partial<ApiKeys>) => void;
}

export function useApiKeys(): UseApiKeysResult {
  const [apiKeys, setApiKeysState] = useState<ApiKeys>(() => readApiKeys());

  const setApiKeys = useCallback((patch: Partial<ApiKeys>) => {
    setApiKeysState((current) => {
      const updated = { ...current, ...patch };
      writeApiKeys(updated);
      return updated;
    });
  }, []);

  return { apiKeys, setApiKeys };
}
