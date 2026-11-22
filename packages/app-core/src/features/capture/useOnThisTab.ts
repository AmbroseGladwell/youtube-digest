import { useEffect, useRef, useState } from "react";
import { useMatch } from "react-router";
import { canonicalArticleUrl, keptSharedLink, sourceKey, type Overview } from "@overview/domain";
import { RouteParams, Routes } from "../../app/Routes.js";
import { useActiveVideoUrl } from "../../app/ActiveVideoContext.js";
import { useActivePage, type ActivePage } from "../../app/ArticlePagesContext.js";
import { isOfferedPage } from "../../app/isOfferedPage.js";
import { useIsPanel } from "../../app/LayoutContext.js";
import { isPlatformPodcastLink, isPodcastShowLink } from "../newOverview/usePodcastLink.js";
import { extractYouTubeVideoId } from "../newOverview/util/parseYouTubeUrl.js";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { overviewForPageUrl, overviewForVideoUrl } from "../overviews/util/overviewForVideoUrl.js";
import { readableEntries } from "../overviews/types/LibraryEntry.js";

export interface OnThisTab {
  kind: "video" | "page" | "episode";
  held: Overview | null;
  videoUrl: string | null;
  page: ActivePage | null;
  dismiss: () => void;
}

// When this shows: docs/features/extension-panel.md, "The line under the bar".
export const useOnThisTab = (): OnThisTab | null => {
  const isPanel = useIsPanel();
  const onOverview = useMatch(Routes.overview(`:${RouteParams.overviewId}`));
  const overviewId = onOverview?.params[RouteParams.overviewId] ?? null;
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const entries = useOverviewsWithStateQuery().data ?? [];
  const open = readableEntries(entries).find(({ overview }) => overview.id === overviewId)?.overview ?? null;

  const offeredPage = activeVideoUrl === null && isOfferedPage(activePage) ? activePage : null;
  const subject = activeVideoUrl ?? offeredPage?.url ?? null;
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const latestSubject = useRef(subject);
  latestSubject.current = subject;

  useEffect(() => {
    if (dismissedFor !== null && dismissedFor !== subject) {
      setDismissedFor(null);
    }
  }, [dismissedFor, subject]);

  if (!isPanel || open === null || subject === null || dismissedFor === subject) {
    return null;
  }
  if (activeVideoUrl !== null) {
    const videoId = extractYouTubeVideoId(activeVideoUrl);
    if (videoId === null || sourceKey(open.source) === videoId) {
      return null;
    }
    return {
      kind: "video",
      held: overviewForVideoUrl(entries, activeVideoUrl),
      videoUrl: activeVideoUrl,
      page: null,
      dismiss: () => setDismissedFor(latestSubject.current),
    };
  }
  if (offeredPage === null) {
    return null;
  }
  // A Spotify or Apple tab is read on home, where its offer says what the address holds (106k).
  if (isPlatformPodcastLink(offeredPage.url)) {
    if (isPodcastShowLink(offeredPage.url)) {
      return null;
    }
    if (open.source.kind === "podcast" && keptSharedLink(open.source.sharedFrom) === keptSharedLink(offeredPage.url)) {
      return null;
    }
    return { kind: "episode", held: null, videoUrl: null, page: offeredPage, dismiss: () => setDismissedFor(latestSubject.current) };
  }
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
};
