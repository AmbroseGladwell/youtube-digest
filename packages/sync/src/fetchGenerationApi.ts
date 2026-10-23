import { OurKeyGenerationStatus, Overview, OverviewUsage } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { GenerationApi } from "./GenerationApi.js";

export function createFetchGenerationApi(options: ApiRequesterOptions): GenerationApi {
  const request = createApiRequester(options);
  return {
    status: () => answered(request("GET", "/generations", OurKeyGenerationStatus)),
    usage: () => answered(request("GET", "/overview-usage", OverviewUsage)),
    generate: (body) => answered(request("POST", "/generations", Overview, { body })),
    reserve: (overviewId, shareToken) =>
      answered(
        request("POST", "/overview-reservations", OverviewUsage, {
          body: { overviewId, ...(shareToken === undefined ? {} : { shareToken }) },
        }),
      ),
    release: async (overviewId) => {
      await request("DELETE", `/overview-reservations/${encodeURIComponent(overviewId)}`, OverviewUsage);
    },
  };
}
