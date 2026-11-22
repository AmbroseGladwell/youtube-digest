import { createContext, useContext } from "react";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";

// The AppShell owns the run; this hands it to the side panel, which runs it on its own page.
const NewOverviewRunContext = createContext<NewOverviewRunController | null>(null);

export const NewOverviewRunProvider = NewOverviewRunContext.Provider;

export const useNewOverviewRunController = (): NewOverviewRunController => {
  const controller = useContext(NewOverviewRunContext);
  if (!controller) {
    throw new Error("useNewOverviewRunController must be used within a NewOverviewRunProvider");
  }
  return controller;
};
