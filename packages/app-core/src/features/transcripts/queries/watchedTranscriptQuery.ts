import { queryOptions, useQuery } from "@tanstack/react-query";
import type { TranscriptStore, VideoSource } from "@overview/domain";
import type { YouTubeFetch } from "@overview/transcripts";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { useYouTubeFetch } from "../../../app/YouTubeFetchContext.js";
import { useStores } from "../../../stores/StoresContext.js";
import { createTranscriptSources } from "../../newOverview/api/generationClients.js";
import { resolveVideo } from "../api/resolveVideo.js";
import { transcriptKeys } from "../transcriptKeys.js";
import { freeTranscriptSources } from "../util/freeTranscriptSources.js";

export const watchedTranscriptQueryOptions = (
  transcriptStore: TranscriptStore,
  sourceOptions: { youTubeFetch: YouTubeFetch | null },
  url: string | null,
) =>
  queryOptions({
    queryKey: transcriptKeys.watched(url),
    // Free rungs only, and built here rather than above so a rung never outlives the
    // resolve it was made for (docs/features/transcript-retrieval.md). Never our server: asking
    // it would tell us every video merely watched.
    // The whole video, not just its id: the panel's home names what it is beside before
    // Create, and this is the one place that already knows (design 205a).
    queryFn: (): Promise<VideoSource | null> => {
      const sources = freeTranscriptSources(createTranscriptSources({ ...sourceOptions, service: null }));
      if (url === null || sources.length === 0) return Promise.resolve(null);
      return resolveVideo(url, { sources, transcriptStore }).then((resolved) => resolved.video);
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
  const watchedUrl = useActiveVideoUrl();
  const youTubeFetch = useYouTubeFetch();
  return useQuery(watchedTranscriptQueryOptions(transcriptStore, { youTubeFetch }, watchedUrl));
};
