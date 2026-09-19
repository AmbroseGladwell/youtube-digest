import { queryOptions, useQuery } from "@tanstack/react-query";
import type { TranscriptStore, VideoId } from "@overview/types";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { createTranscriptClient } from "../../newOverview/api/generationClients.js";
import { resolveVideo } from "../api/resolveVideo.js";
import { transcriptKeys } from "../transcriptKeys.js";

export const watchedTranscriptQueryOptions = (
  transcriptStore: TranscriptStore,
  supadataApiKey: string | null,
  url: string | null,
) =>
  queryOptions({
    queryKey: transcriptKeys.watched(url),
    queryFn: (): Promise<VideoId | null> => {
      if (url === null || supadataApiKey === null) return Promise.resolve(null);
      return resolveVideo(url, {
        transcriptClient: createTranscriptClient(supadataApiKey),
        transcriptStore,
      }).then((resolved) => resolved.video.id);
    },
    enabled: url !== null && supadataApiKey !== null,
    // Captions don't change, and a retry here would spend a second credit on a video
    // nobody has asked for a note on yet.
    staleTime: Infinity,
    retry: false,
  });

export const useWatchedTranscriptQuery = () => {
  const { transcriptStore } = useStores();
  const { apiKeys } = useApiKeys();
  const watchedUrl = useActiveVideoUrl();
  return useQuery(watchedTranscriptQueryOptions(transcriptStore, apiKeys.supadataApiKey, watchedUrl));
};
