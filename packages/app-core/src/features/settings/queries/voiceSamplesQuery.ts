import { queryOptions, useQuery } from "@tanstack/react-query";
import type { NarrationApi } from "@overview/sync";
import { useNarrationApi } from "../../player/NarrationApiContext.js";
import { settingsKeys } from "../settingsKeys.js";

export const voiceSamplesQueryOptions = (api: NarrationApi | null) =>
  queryOptions({
    queryKey: settingsKeys.voiceSamples,
    queryFn: () => api!.samples(),
    enabled: api !== null,
    staleTime: 5 * 60 * 1000,
  });

export const useVoiceSamplesQuery = () => useQuery(voiceSamplesQueryOptions(useNarrationApi()));
