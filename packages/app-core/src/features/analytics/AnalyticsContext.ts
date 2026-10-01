import { createContext, useContext } from "react";
import { silentAnalytics, type Analytics } from "./createAnalytics.js";

const AnalyticsContext = createContext<Analytics>(silentAnalytics);

export const AnalyticsProvider = AnalyticsContext.Provider;

export function useAnalytics(): Analytics {
  return useContext(AnalyticsContext);
}
