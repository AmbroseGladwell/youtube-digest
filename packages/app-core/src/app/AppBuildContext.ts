import { createContext, useContext } from "react";

export interface AppBuild {
  version: string;
  commit: string | null;
  dirty: boolean;
}

const AppBuildContext = createContext<AppBuild | null>(null);

export const AppBuildProvider = AppBuildContext.Provider;

export const useAppBuild = (): AppBuild | null => {
  return useContext(AppBuildContext);
};
