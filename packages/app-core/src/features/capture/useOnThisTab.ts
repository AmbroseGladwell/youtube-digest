import { useEffect, useRef, useState } from "react";
import { useMatch } from "react-router";
import { canonicalArticleUrl, sourceKey, type Overview } from "@overview/domain";
import { RouteParams, Routes } from "../../app/Routes.js";
import { useActiveVideoUrl } from "../../app/ActiveVideoContext.js";
import { useActivePage, type ActivePage } from "../../app/ArticlePagesContext.js";
import { isOfferedPage } from "../../app/isOfferedPage.js";
import { useIsPanel } from "../../app/LayoutContext.js";
import { extractYouTubeVideoId } from "../newOverview/util/parseYouTubeUrl.js";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { overviewForPageUrl, overviewForVideoUrl } from "../overviews/util/overviewForVideoUrl.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";

export interface OnThisTab {
  kind: "video" | "page";
  // The note the library already holds for what the tab has moved on to, if it holds one.
  held: Overview | null;
  videoUrl: string | null;
  page: ActivePage | null;
  dismiss: () => void;
}

// Whether the tab in front of the panel holds something we could take that isn't what the
// open note is about (design 205e). On a note only: settings and the queue aren't about a
// video, so there is nothing for the tab to have moved away from, and home is already the
// offer. Matched on the video's own id rather than the url, the rule
// docs/features/extension-panel.md gives for "Already in the library".
export function useOnThisTab(): OnThisTab | null {
  const isPanel = useIsPanel();
  const onOverview = useMatch(Routes.overview(`:${RouteParams.overviewId}`));
  const overviewId = onOverview?.params[RouteParams.overviewId] ?? null;
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const entries = useOverviewsWithStateQuery().data ?? [];
  const open = readableEntries(entries).find(({ overview }) => overview.id === overviewId)?.overview ?? null;

  const offeredPage = activeVideoUrl === null && isOfferedPage(activePage) ? activePage : null;
  const subject = activeVideoUrl ?? offeredPage?.url ?? null;
  // Dismissed for one subject, not for ever: moving the tab on again asks afresh (205e-4).
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const latestSubject = useRef(subject);
  latestSubject.current = subject;

  useEffect(() => {
    if (dismissedFor !== null && dismissedFor !== subject) setDismissedFor(null);
  }, [dismissedFor, subject]);

  if (!isPanel || open === null || subject === null || dismissedFor === subject) {
    return null;
  }
  if (activeVideoUrl !== null) {
    const videoId = extractYouTubeVideoId(activeVideoUrl);
    if (videoId === null || sourceKey(open.source) === videoId) return null;
    return {
      kind: "video",
      held: overviewForVideoUrl(entries, activeVideoUrl),
      videoUrl: activeVideoUrl,
      page: null,
      dismiss: () => setDismissedFor(latestSubject.current),
    };
  }
  if (offeredPage === null) return null;
  if (open.source.kind === "web" && open.source.url === canonicalArticleUrl(offeredPage.url, null)) {
    return null;
  }
  return {
    kind: "page",
    held: overviewForPageUrl(entries, offeredPage.url),
    videoUrl: null,
    page: offeredPage,
    dismiss: () => setDismissedFor(latestSubject.current),
  };
}
