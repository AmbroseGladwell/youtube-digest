import { queryOptions, useQuery } from "@tanstack/react-query";
import type { TranscriptStore, VideoId } from "@overview/domain";
import type { YouTubeFetch } from "@overview/transcripts";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { useYouTubeFetch } from "../../../app/YouTubeFetchContext.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { createTranscriptSources } from "../../newOverview/api/generationClients.js";
import { resolveVideo } from "../api/resolveVideo.js";
import { transcriptKeys } from "../transcriptKeys.js";
import { freeTranscriptSources } from "../util/freeTranscriptSources.js";

export const watchedTranscriptQueryOptions = (
  transcriptStore: TranscriptStore,
  sourceOptions: { youTubeFetch: YouTubeFetch | null; supadataApiKey: string | null },
  url: string | null,
) =>
  queryOptions({
    queryKey: transcriptKeys.watched(url),
    // Free rungs only, and built here rather than above so a rung never outlives the
    // resolve it was made for (docs/features/transcript-retrieval.md).
    queryFn: (): Promise<VideoId | null> => {
      const sources = freeTranscriptSources(createTranscriptSources(sourceOptions));
      if (url === null || sources.length === 0) return Promise.resolve(null);
      return resolveVideo(url, { sources, transcriptStore }).then((resolved) => resolved.video.id);
    },
    // Noticing the video and grabbing its captions costs nothing, so it needs no key —
    // but with no free rung there is nothing to do here at all
    // (docs/features/watching-detection.md).
    enabled: url !== null && sourceOptions.youTubeFetch !== null,
    // Captions don't change, and a background fetch nobody asked for should not hammer
    // YouTube when the first attempt failed.
    staleTime: Infinity,
    retry: false,
  });

export const useWatchedTranscriptQuery = () => {
  const { transcriptStore } = useStores();
  const { apiKeys } = useApiKeys();
  const watchedUrl = useActiveVideoUrl();
  const youTubeFetch = useYouTubeFetch();
  return useQuery(
    watchedTranscriptQueryOptions(
      transcriptStore,
      { youTubeFetch, supadataApiKey: apiKeys.supadataApiKey },
      watchedUrl,
    ),
  );
};
