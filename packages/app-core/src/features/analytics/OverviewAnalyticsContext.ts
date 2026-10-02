import { createContext, useContext } from "react";
import { OverviewId } from "@overview/domain";
import { bindOverviewId, type OverviewPageAnalytics, type ReaderAnalytics } from "./bindOverviewId.js";
import { silentAnalytics } from "./createAnalytics.js";

export interface OverviewAnalytics {
  // What any page an overview is read on can say: the tabs, the note, the transcript, the
  // chapters and the player.
  page: OverviewPageAnalytics;
  // What only the reader's own page can say, about an overview the reader owns. Null on a
  // shared link.
  reader: ReaderAnalytics | null;
}

const silentReader = bindOverviewId(silentAnalytics.reader, OverviewId.parse("00000000-0000-4000-8000-000000000000"));

const OverviewAnalyticsContext = createContext<OverviewAnalytics>({ page: silentReader, reader: null });

export const OverviewAnalyticsProvider = OverviewAnalyticsContext.Provider;

export function useOverviewPageAnalytics(): OverviewPageAnalytics {
  return useContext(OverviewAnalyticsContext).page;
}

export function useReaderAnalytics(): ReaderAnalytics {
  return useContext(OverviewAnalyticsContext).reader ?? silentReader;
}
