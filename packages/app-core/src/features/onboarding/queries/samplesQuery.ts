import { useQuery } from "@tanstack/react-query";
import { sampleKeys } from "../sampleKeys.js";
import { useSampleApi } from "../useSampleApi.js";

// Start's samples. A server that can't be asked, or doesn't answer, offers none, and Start
// keeps its field alone rather than showing a choice that can't work.
export function useSamplesQuery() {
  const sampleApi = useSampleApi();
  return useQuery({
    queryKey: sampleKeys.list(sampleApi?.apiUrl ?? null),
    queryFn: () => sampleApi!.api.list(),
    enabled: sampleApi !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
