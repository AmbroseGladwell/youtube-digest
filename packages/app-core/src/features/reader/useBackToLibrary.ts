import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { usePreviousPathname } from "../../app/HistoryTrailContext.js";
import { Routes } from "../../app/Routes.js";
import { useReaderAnalytics } from "../analytics/OverviewAnalyticsContext.js";

export type BackSource = "head" | "bar";

const plainClick = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

// Back in history when the library is the entry behind this one, so the scroll position
// and the view come back with it; otherwise the link goes home on its own
// (docs/features/back-within-reach.md, "Back in history, or home").
export function useBackToLibrary(): (from: BackSource, event: MouseEvent<HTMLAnchorElement>) => void {
  const analytics = useReaderAnalytics();
  const navigate = useNavigate();
  const previous = usePreviousPathname();

  return (from, event) => {
    analytics.page.backFollowed({ from });
    if (previous !== Routes.home() || !plainClick(event)) return;
    event.preventDefault();
    void navigate(-1);
  };
}
