import { createContext, useContext } from "react";
import type { RunReport } from "../features/newOverview/types/RunReport.js";

export interface RunBridge {
  subscribe: (onChange: () => void) => () => void;
  // Cleared as it is read: a request is acted on once, by whichever shell is mounted when it arrives.
  takeRequest: () => string | null;
  report: (report: RunReport | null) => void;
}

// One seam, not two: the injected button asks for a run and then watches the one it asked for.
const RunBridgeContext = createContext<RunBridge | null>(null);

export const RunBridgeProvider = RunBridgeContext.Provider;

export const useRunBridge = (): RunBridge | null => {
  return useContext(RunBridgeContext);
};
