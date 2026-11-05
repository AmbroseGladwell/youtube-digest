import { createContext, useContext } from "react";
import { EMPTY_HISTORY_TRAIL, previousPathname, type HistoryTrail } from "../shell/AppShell/historyTrail.js";

const HistoryTrailContext = createContext<HistoryTrail>(EMPTY_HISTORY_TRAIL);

export const HistoryTrailProvider = HistoryTrailContext.Provider;

export function usePreviousPathname(): string | null {
  return previousPathname(useContext(HistoryTrailContext));
}
