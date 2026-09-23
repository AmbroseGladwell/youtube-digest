import { queryOptions, useQuery } from "@tanstack/react-query";
import type { TranscriptStore, VideoId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { transcriptKeys } from "../transcriptKeys.js";

export const transcriptQueryOptions = (transcriptStore: TranscriptStore, videoId: VideoId | null) =>
  queryOptions({
    queryKey: transcriptKeys.detail(videoId),
    queryFn: () => (videoId === null ? null : transcriptStore.getTranscript(videoId)),
    enabled: videoId !== null,
  });

export const useTranscriptQuery = (videoId: VideoId | null) => {
  const { transcriptStore } = useStores();
  return useQuery(transcriptQueryOptions(transcriptStore, videoId));
};
