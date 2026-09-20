import { createContext, useContext } from "react";
import type { NewOverviewRunController } from "./useNewOverviewRun.js";

// The run is still owned by the AppShell, which is the one component that survives every
// navigation. This only hands it down: the side panel runs a generation on its own page
// rather than in a dialog the shell renders (docs/features/extension-panel.md).
const NewOverviewRunContext = createContext<NewOverviewRunController | null>(null);

export const NewOverviewRunProvider = NewOverviewRunContext.Provider;

export function useNewOverviewRunController(): NewOverviewRunController {
  const controller = useContext(NewOverviewRunContext);
  if (!controller) {
    throw new Error("useNewOverviewRunController must be used within a NewOverviewRunProvider");
  }
  return controller;
}
