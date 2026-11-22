import { useQuery } from "@tanstack/react-query";
import { sampleKeys } from "../sampleKeys.js";
import { useSampleApi } from "../useSampleApi.js";

// A server that can't be asked, or doesn't answer, offers none, so Start shows no choice that can't work.
export const useSamplesQuery = () => {
  const sampleApi = useSampleApi();
  return useQuery({
    queryKey: sampleKeys.list(sampleApi?.apiUrl ?? null),
    queryFn: () => sampleApi!.api.list(),
    enabled: sampleApi !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
