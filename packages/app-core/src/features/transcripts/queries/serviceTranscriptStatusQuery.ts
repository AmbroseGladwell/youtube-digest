import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ServiceTranscriptStatus } from "@overview/domain";
import { createFetchServiceTranscriptApi } from "@overview/sync";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { transcriptKeys } from "../transcriptKeys.js";

const UNAVAILABLE: ServiceTranscriptStatus = { available: false };

// Whether our own server will fetch a transcript, so a reader with no other rung is
// offered Create only when it can work. A server that can't be asked is a server that
// won't fetch (docs/architecture/server-side-transcripts.md).
export const serviceTranscriptStatusQueryOptions = (apiUrl: string | null) =>
  queryOptions({
    queryKey: transcriptKeys.serviceStatus(apiUrl),
    queryFn: (): Promise<ServiceTranscriptStatus> =>
      apiUrl === null
        ? Promise.resolve(UNAVAILABLE)
        : createFetchServiceTranscriptApi({ baseUrl: apiUrl })
            .status()
            .catch(() => UNAVAILABLE),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export const useServiceTranscriptStatusQuery = () => useQuery(serviceTranscriptStatusQueryOptions(useKnownApiUrl()));
