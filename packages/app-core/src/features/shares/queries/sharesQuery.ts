import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Share } from "@overview/domain";
import type { ShareApi } from "@overview/sync";
import { shareKeys } from "../shareKeys.js";
import { useShareApi } from "../ShareApiContext.js";

export const sharesQueryOptions = (api: ShareApi | null) =>
  queryOptions({
    queryKey: shareKeys.list,
    queryFn: (): Promise<Share[]> => (api === null ? Promise.resolve([]) : api.list()),
    enabled: api !== null,
    // Never served stale: the view count and whether the copy is still current are the
    // two things the reader opens this to find out (docs/features/sharing.md).
    staleTime: 0,
  });

export const useSharesQuery = () => useQuery(sharesQueryOptions(useShareApi()));
