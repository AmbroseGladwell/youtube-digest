import { createContext, useContext } from "react";
import type { Provider } from "@overview/domain";

// Asked per key, not on install: docs/features/byo-providers.md, "What the extension has to ask for".
export interface ProviderPermissions {
  granted: (provider: Provider) => Promise<boolean>;
  request: (provider: Provider) => Promise<boolean>;
  drop: (provider: Provider) => Promise<void>;
}

const ProviderPermissionContext = createContext<ProviderPermissions | null>(null);

export const ProviderPermissionProvider = ProviderPermissionContext.Provider;

export const useProviderPermissions = (): ProviderPermissions | null => useContext(ProviderPermissionContext);
