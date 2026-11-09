import { queryOptions, useQuery } from "@tanstack/react-query";
import { MEANING_QUERY_MAX_LENGTH, type MeaningSearchResponse } from "@overview/domain";
import { createFetchMeaningSearchApi, type MeaningSearchApi } from "@overview/sync";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { libraryKeys } from "../libraryKeys.js";

const UNAVAILABLE: MeaningSearchResponse = { available: false };

export interface MeaningMatchesParams {
  apiUrl: string | null;
  accountId: string | null;
  token: string | null;
  query: string;
}

// Only a signed-in library has embeddings on our server; anywhere else the search stays
// word-only and offers nothing about meaning (docs/features/search-by-meaning.md).
export const meaningMatchesQueryOptions = (
  { apiUrl, accountId, token, query }: MeaningMatchesParams,
  api: MeaningSearchApi | null = apiUrl === null ? null : createFetchMeaningSearchApi({ baseUrl: apiUrl, token }),
) =>
  queryOptions({
    queryKey: libraryKeys.meaning(apiUrl, accountId, query),
    queryFn: (): Promise<MeaningSearchResponse> =>
      api === null ? Promise.resolve(UNAVAILABLE) : api.search(query).catch(() => UNAVAILABLE),
    enabled: api !== null && accountId !== null && query !== "" && query.length <= MEANING_QUERY_MAX_LENGTH,
    staleTime: 60 * 1000,
    retry: false,
  });

export function useMeaningMatchesQuery(query: string) {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  return useQuery(
    meaningMatchesQueryOptions({ apiUrl, accountId: libraryAccountIdOf(connection), token: connection.token, query: query.trim() }),
  );
}
