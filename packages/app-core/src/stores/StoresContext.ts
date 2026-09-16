import { createContext, useContext } from "react";
import type { OverviewStore, SettingsStore } from "@overview/types";

export interface Stores {
  overviewStore: OverviewStore;
  settingsStore: SettingsStore;
}

// No default: which backend answers OverviewStore/SettingsStore (local IndexedDB today,
// a synced API for a signed-in paid tier later) is a decision the mounting shell makes,
// not app-core (docs/architecture/v1-architecture-decisions.md's swappable-store model).
const StoresContext = createContext<Stores | null>(null);

export const StoresProvider = StoresContext.Provider;

export function useStores(): Stores {
  const stores = useContext(StoresContext);
  if (!stores) {
    throw new Error("useStores must be used within a StoresProvider");
  }
  return stores;
}
