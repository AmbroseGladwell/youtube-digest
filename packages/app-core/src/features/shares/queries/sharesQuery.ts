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
    // Why never stale: docs/features/sharing.md, "Making and managing a link".
    staleTime: 0,
  });

export const useSharesQuery = () => useQuery(sharesQueryOptions(useShareApi()));
