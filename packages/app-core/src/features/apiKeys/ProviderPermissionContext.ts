import { createContext, useContext } from "react";
import type { Provider } from "@overview/domain";

// The extension cannot reach a provider's address until Chrome has been asked, and asking
// for all six on install would meet a new reader with a permission sheet naming six
// companies before they have agreed to anything. So each is asked for when its key is
// added, and given back when the key is removed (design 110d).
//
// Null in the web app, which needs no permission and must not pretend to ask for one —
// a prompt that cannot appear is worse than no prompt (CLAUDE.md, "degrade visibly").
export interface ProviderPermissions {
  granted: (provider: Provider) => Promise<boolean>;
  request: (provider: Provider) => Promise<boolean>;
  drop: (provider: Provider) => Promise<void>;
}

const ProviderPermissionContext = createContext<ProviderPermissions | null>(null);

export const ProviderPermissionProvider = ProviderPermissionContext.Provider;

export const useProviderPermissions = (): ProviderPermissions | null => useContext(ProviderPermissionContext);
