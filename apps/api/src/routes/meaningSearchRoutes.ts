import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, MEANING_QUERY_MAX_LENGTH, type MeaningSearchResponse } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { MeaningSearch } from "../meaning/MeaningSearch.js";

const MeaningQuery = z.object({ query: z.string().trim().min(1).max(MEANING_QUERY_MAX_LENGTH) });

// Absent an embedder, the route still answers, unavailable, so the app shows word matches
// and says meaning is off rather than failing (docs/features/search-by-meaning.md).
export function meaningSearchRoutes(app: FastifyInstance, meaning: MeaningSearch | null): void {
  app.get("/search/meaning", async (request): Promise<MeaningSearchResponse> => {
    const { query } = parseOrThrow(MeaningQuery, request.query, "The search");
    const result = meaning === null ? { available: false as const } : await meaning.search(request.session!.accountId, query);
    request.log.info(
      apiLogLines.meaning.searched({
        source: "app",
        meaningMatches: result.available ? result.matches.length : 0,
        available: result.available,
      }),
    );
    return result.available
      ? { available: true, matches: result.matches.map(({ overviewId, similarity }) => ({ overviewId, similarity })) }
      : { available: false };
  });
}
