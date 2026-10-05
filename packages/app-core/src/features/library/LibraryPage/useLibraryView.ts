import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Topic } from "@overview/domain";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { readLibraryView, writeLibraryView, type RestoredLibraryView } from "../libraryViewStorage.js";
import { DEFAULT_LIBRARY_VIEW, type LibraryView } from "../types/LibraryView.js";
import { applyLibraryView, hasLibraryViewParams, parseLibraryView } from "../util/libraryFilterParams.js";

function restoringFor(accountId: string | null): RestoredLibraryView {
  return readLibraryView(accountId) ?? { view: DEFAULT_LIBRARY_VIEW, dropped: [] };
}

function withoutMissingTopic(restoring: RestoredLibraryView, topics: Topic[]): RestoredLibraryView {
  const { topicId } = restoring.view.filters;
  if (topicId === "all" || topics.some((topic) => topic.id === topicId)) return restoring;
  return {
    ...restoring,
    view: { ...restoring.view, filters: { ...restoring.view.filters, topicId: "all" } },
    dropped: [...restoring.dropped, "topic"],
  };
}

export interface UseLibraryViewResult {
  searchParams: URLSearchParams;
  view: LibraryView;
  change: (next: URLSearchParams) => void;
}

// The URL holds the view. Opened with none of its params, the list takes the view this
// account left on this device, or unread first; a link that names a view wins and is not
// saved (docs/features/library-view.md).
export function useLibraryView(topics: Topic[] | undefined): UseLibraryViewResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = libraryAccountIdOf(useSyncConnection().connection);
  const [restoredAccountId, setRestoredAccountId] = useState(accountId);
  const [restoring, setRestoring] = useState<RestoredLibraryView | null>(() =>
    hasLibraryViewParams(searchParams) ? null : restoringFor(accountId),
  );

  const target = useRef<{ restoring: RestoredLibraryView; search: string } | null>(null);

  if (restoredAccountId !== accountId) {
    setRestoredAccountId(accountId);
    setRestoring(restoringFor(accountId));
  }

  if (restoring !== null && target.current?.restoring === restoring && target.current.search === searchParams.toString()) {
    setRestoring(null);
  }

  useEffect(() => {
    if (restoring === null || target.current?.restoring === restoring) return;
    if (topics === undefined && restoring.view.filters.topicId !== "all") return;
    const restored = topics === undefined ? restoring : withoutMissingTopic(restoring, topics);
    if (restored.dropped.length > 0) writeLibraryView(accountId, restored.view);
    const next = applyLibraryView(searchParams, restored.view);
    if (next.toString() === searchParams.toString()) {
      setRestoring(null);
      return;
    }
    target.current = { restoring: restored, search: next.toString() };
    setRestoring(restored);
    setSearchParams(next, { replace: true });
  }, [restoring, topics]);

  const shown = restoring === null ? searchParams : applyLibraryView(searchParams, restoring.view);

  const change = (next: URLSearchParams) => {
    setRestoring(null);
    setSearchParams(next, { replace: true });
    writeLibraryView(accountId, parseLibraryView(next));
  };

  return { searchParams: shown, view: parseLibraryView(shown), change };
}
