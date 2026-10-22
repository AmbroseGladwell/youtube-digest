import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OurKeyGenerationStatus } from "@overview/domain";
import { createFetchGenerationApi } from "@overview/sync";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { generationKeys } from "../generationKeys.js";

const UNAVAILABLE: OurKeyGenerationStatus = { available: false };

// Whether our server makes overviews on our key, so a reader with no key of their own is
// offered Create only when it can work. A server that can't be asked is one that won't
// (docs/architecture/tiers.md, "Generating on our key").
export const ourKeyStatusQueryOptions = (apiUrl: string | null) =>
  queryOptions({
    queryKey: generationKeys.ourKeyStatus(apiUrl),
    queryFn: (): Promise<OurKeyGenerationStatus> =>
      apiUrl === null
        ? Promise.resolve(UNAVAILABLE)
        : createFetchGenerationApi({ baseUrl: apiUrl })
            .status()
            .catch(() => UNAVAILABLE),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export const useOurKeyStatusQuery = () => useQuery(ourKeyStatusQueryOptions(useKnownApiUrl()));
