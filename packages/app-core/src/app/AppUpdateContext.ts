import { createContext, useContext } from "react";

// Supplied only by a shell that can act: the extension can open chrome://extensions, app-core cannot.
export interface AppUpdate {
  label: string;
  apply: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

export const AppUpdateProvider = AppUpdateContext.Provider;

export const useAppUpdate = (): AppUpdate | null => {
  return useContext(AppUpdateContext);
};
