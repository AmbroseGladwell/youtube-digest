import { queryOptions, useQuery } from "@tanstack/react-query";
import { DEFAULT_OVERVIEW_STATE, sourceKey, type CaptureStore, type SavedCapture } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { captureKeys } from "../captureKeys.js";

export const savedCapturesQueryOptions = (captureStore: CaptureStore) =>
  queryOptions({
    queryKey: [...captureKeys.all, "saved"] as const,
    queryFn: async (): Promise<SavedCapture[]> =>
      (await captureStore.listCaptures()).filter((capture): capture is SavedCapture => capture.stage === "saved"),
  });

export const useSavedCapturesQuery = () => {
  const { captureStore } = useStores();
  return useQuery(savedCapturesQueryOptions(captureStore));
};

// One whose overview is made somewhere else waits here only until its tombstone comes down.
export const savedCaptureEntries = (captures: readonly SavedCapture[], library: readonly LibraryEntry[]): LibraryEntry[] => {
  const made = new Set(library.flatMap((entry) => (entry.kind === "overview" ? (sourceKey(entry.overview.source) ?? []) : [])));
  return captures
    .filter((capture) => !made.has(capture.sourceKey))
    .map((capture) => ({ kind: "capture", capture, state: { ...DEFAULT_OVERVIEW_STATE, overviewId: capture.id } }));
};
