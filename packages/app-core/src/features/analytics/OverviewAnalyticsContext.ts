import { createContext, useContext } from "react";
import { OverviewId } from "@overview/domain";
import { bindOverviewId, type OverviewPageAnalytics, type ReaderAnalytics } from "./bindOverviewId.js";
import { silentAnalytics } from "./createAnalytics.js";

export interface OverviewAnalytics {
  page: OverviewPageAnalytics;
  // Null on a shared link.
  reader: ReaderAnalytics | null;
}

const silentReader = bindOverviewId(silentAnalytics.reader, OverviewId.parse("00000000-0000-4000-8000-000000000000"));

const OverviewAnalyticsContext = createContext<OverviewAnalytics>({ page: silentReader, reader: null });

export const OverviewAnalyticsProvider = OverviewAnalyticsContext.Provider;

export const useOverviewPageAnalytics = (): OverviewPageAnalytics => {
  return useContext(OverviewAnalyticsContext).page;
};

export const useReaderAnalytics = (): ReaderAnalytics => {
  return useContext(OverviewAnalyticsContext).reader ?? silentReader;
};
