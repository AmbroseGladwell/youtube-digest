import { createContext, useContext } from "react";

// What a shell can do about an out-of-date app, when it can do anything: the web app can
// reload itself and needs nothing from here, the extension can open chrome://extensions
// and app-core cannot. A control appears only where pressing it would work
// (docs/features/record-migrations.md, "Where the banner lives").
export interface AppUpdate {
  label: string;
  apply: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

export const AppUpdateProvider = AppUpdateContext.Provider;

export function useAppUpdate(): AppUpdate | null {
  return useContext(AppUpdateContext);
}
