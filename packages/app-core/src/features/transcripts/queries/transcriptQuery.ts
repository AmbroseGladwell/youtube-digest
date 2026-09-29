import { queryOptions, useQuery } from "@tanstack/react-query";
import type { StoredTranscript, TranscriptStore, VideoId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { useSync } from "../../sync/SyncContext.js";
import { transcriptKeys } from "../transcriptKeys.js";

type FetchTranscript = ((videoId: VideoId) => Promise<StoredTranscript | null>) | null;

// The local store first, then the account's copy on the server, so a transcript fetched on
// one device reads on every other (docs/features/transcript-storage.md).
export const transcriptQueryOptions = (
  transcriptStore: TranscriptStore,
  videoId: VideoId | null,
  fetchTranscript: FetchTranscript,
) =>
  queryOptions({
    queryKey: transcriptKeys.detail(videoId, fetchTranscript !== null),
    queryFn: async () => {
      if (videoId === null) return null;
      const held = await transcriptStore.getTranscript(videoId);
      if (held !== null || fetchTranscript === null) return held;
      return fetchTranscript(videoId);
    },
    enabled: videoId !== null,
  });

export const useTranscriptQuery = (videoId: VideoId | null) => {
  const { transcriptStore } = useStores();
  const { fetchTranscript } = useSync();
  return useQuery(transcriptQueryOptions(transcriptStore, videoId, fetchTranscript));
};
