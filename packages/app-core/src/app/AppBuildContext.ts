import { createContext, useContext } from "react";

// What the running build knows about itself: the one version number every build carries,
// and the commit it was made from. A shell that passes nothing gets no version line
// (docs/architecture/deploy.md, "The version").
export interface AppBuild {
  version: string;
  commit: string | null;
  dirty: boolean;
}

const AppBuildContext = createContext<AppBuild | null>(null);

export const AppBuildProvider = AppBuildContext.Provider;

export function useAppBuild(): AppBuild | null {
  return useContext(AppBuildContext);
}
