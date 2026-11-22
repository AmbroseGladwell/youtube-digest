import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ServiceTranscriptStatus } from "@overview/domain";
import { createFetchServiceTranscriptApi } from "@overview/sync";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { transcriptKeys } from "../transcriptKeys.js";

const UNAVAILABLE: ServiceTranscriptStatus = { available: false };

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
