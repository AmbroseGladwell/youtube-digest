import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, TRANSCRIPT_QUERY_MAX_LENGTH, type TranscriptSearchResponse } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { itemTranscriptMatches, type TranscriptMatchesDeps } from "../transcripts/transcriptMatches.js";

const TranscriptQuery = z.object({ query: z.string().trim().min(1).max(TRANSCRIPT_QUERY_MAX_LENGTH) });

export const transcriptSearchRoutes = (app: FastifyInstance, deps: TranscriptMatchesDeps): void => {
  app.get("/search/transcripts", async (request): Promise<TranscriptSearchResponse> => {
    const { query } = parseOrThrow(TranscriptQuery, request.query, "The search");
    const matches = await itemTranscriptMatches(deps, request.session!.accountId, query);
    request.log.info(apiLogLines.transcripts.searched({ source: "app", matches: matches.length }));
    return {
      matches: matches.map(({ id, mentions, moments }) => ({ overviewId: id, mentions, moments })),
    };
  });
};
