import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, StoredTranscript, VideoId, type SourceKey } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

const TRANSCRIPT_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

const Params = z.object({ videoId: VideoId });

// Another kind's key holds a colon (docs/features/source-identity.md). An episode's words are
// fetched from their source for each reader and never kept here, so no account files one
// (docs/features/podcast-transcripts.md).
const isYouTubeKey = (key: string): boolean => !key.includes(":");

// An episode's words by its key alone, fetched afresh from where they were found, for a reader's
// device that holds the key but not the words (docs/features/podcast-transcripts.md).
export type EpisodeWords = (key: SourceKey, accountId: AccountId, log: FastifyBaseLogger) => Promise<StoredTranscript | null>;

export function transcriptRoutes(
  app: FastifyInstance,
  { transcripts, episodeWords, clock }: { transcripts: TranscriptsRepository; episodeWords: EpisodeWords; clock: () => Date },
): void {
  app.get("/transcripts/:videoId", async (request) => {
    const { videoId } = parseOrThrow(Params, request.params, "The video id");
    const accountId = request.session!.accountId;
    const transcript = isYouTubeKey(videoId)
      ? await transcripts.get(accountId, videoId)
      : await episodeWords(videoId, accountId, request.log);
    if (transcript === null) {
      throw new ApiError("not_found", "No transcript is kept for this video");
    }
    request.log.info(apiLogLines.transcripts.served());
    return transcript;
  });

  app.put("/transcripts/:videoId", { bodyLimit: TRANSCRIPT_BODY_LIMIT_BYTES }, async (request, reply) => {
    const { videoId } = parseOrThrow(Params, request.params, "The video id");
    const transcript = parseOrThrow(StoredTranscript, request.body, "The transcript");
    if (transcript.videoId !== videoId) {
      throw new ApiError("invalid_request", "The transcript is for a different video than the path names");
    }
    const fault = isYouTubeKey(videoId) ? transcriptFault(transcript, videoId) : "fetched-by-server";
    if (fault !== null) {
      request.log.warn(apiLogLines.transcripts.refused({ fault, segments: transcript.segments.length }));
      return reply.status(204).send();
    }
    const contribution = await transcripts.putIfNoted(request.session!.accountId, transcript);
    const logged = { contribution, generated: transcript.generated, segments: transcript.segments.length };
    if (contribution === "not-noted") {
      request.log.warn(apiLogLines.transcripts.notKept(logged));
    } else {
      request.log.info(apiLogLines.transcripts.stored(logged));
    }
    return reply.status(204).send();
  });

  app.get(
    "/shared-transcripts/:videoId",
    {
      config: { public: true },
      preHandler: rateLimitHook(rateLimits.sharedTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request) => {
      const { videoId } = parseOrThrow(Params, request.params, "The video id");
      const transcript = await transcripts.getShared(videoId);
      request.log.info(apiLogLines.transcripts.sharedRead({ hit: transcript !== null }));
      if (transcript === null) {
        throw new ApiError("not_found", "No shared transcript is kept for this video");
      }
      return transcript;
    },
  );
}
