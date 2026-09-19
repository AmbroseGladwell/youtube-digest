import { createContext, useContext } from "react";
import type { RunReport } from "../features/newOverview/types/RunReport.js";

export interface RunBridge {
  subscribe: (onChange: () => void) => () => void;
  // The video the page asked for an overview of, cleared as it is read: a request is
  // acted on once, by whichever shell is mounted when it arrives.
  takeRequest: () => string | null;
  report: (report: RunReport | null) => void;
}

// One seam rather than two, because it is one relationship: the injected button asks for
// a run and then watches the one it asked for (docs/features/injected-button.md). The web
// app has no page to talk to and supplies nothing, so both halves are simply absent.
const RunBridgeContext = createContext<RunBridge | null>(null);

export const RunBridgeProvider = RunBridgeContext.Provider;

export function useRunBridge(): RunBridge | null {
  return useContext(RunBridgeContext);
}
