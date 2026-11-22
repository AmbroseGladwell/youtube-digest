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
    // Never our server: asking it would tell us every video merely watched.
    queryFn: (): Promise<VideoSource | null> => {
      const sources = freeTranscriptSources(createTranscriptSources({ ...sourceOptions, service: null }));
      if (url === null || sources.length === 0) {
        return Promise.resolve(null);
      }
      return resolveVideo(url, { sources, transcriptStore }).then((resolved) => resolved.video);
    },
    enabled: url !== null && sourceOptions.youTubeFetch !== null,
    // Captions don't change, and a background fetch nobody asked for shouldn't retry against YouTube.
    staleTime: Infinity,
    retry: false,
  });

export const useWatchedTranscriptQuery = () => {
  const { transcriptStore } = useStores();
  const watchedUrl = useActiveVideoUrl();
  const youTubeFetch = useYouTubeFetch();
  return useQuery(watchedTranscriptQueryOptions(transcriptStore, { youTubeFetch }, watchedUrl));
};
