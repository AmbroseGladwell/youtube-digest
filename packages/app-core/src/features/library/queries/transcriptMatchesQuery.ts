import { queryOptions, useQuery } from "@tanstack/react-query";
import { TRANSCRIPT_QUERY_MAX_LENGTH, type TranscriptSearchResponse } from "@overview/domain";
import { createFetchTranscriptSearchApi, type TranscriptSearchApi } from "@overview/sync";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { libraryKeys } from "../libraryKeys.js";

export interface TranscriptMatchesParams {
  apiUrl: string | null;
  accountId: string | null;
  token: string | null;
  query: string;
}

// Signed in only: docs/features/transcript-search.md, "In the library".
export const transcriptMatchesQueryOptions = (
  { apiUrl, accountId, token, query }: TranscriptMatchesParams,
  api: TranscriptSearchApi | null = apiUrl === null ? null : createFetchTranscriptSearchApi({ baseUrl: apiUrl, token }),
) =>
  queryOptions({
    queryKey: libraryKeys.transcripts(apiUrl, accountId, query),
    queryFn: (): Promise<TranscriptSearchResponse> => api!.search(query),
    enabled: api !== null && accountId !== null && query !== "" && query.length <= TRANSCRIPT_QUERY_MAX_LENGTH,
    staleTime: 60 * 1000,
    retry: false,
  });

export const useTranscriptMatchesQuery = (query: string) => {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  return useQuery(
    transcriptMatchesQueryOptions({ apiUrl, accountId: libraryAccountIdOf(connection), token: connection.token, query: query.trim() }),
  );
};
