import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { StoredTranscript, VideoId } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

const TRANSCRIPT_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

const Params = z.object({ videoId: VideoId });

export function transcriptRoutes(app: FastifyInstance, transcripts: TranscriptsRepository): void {
  app.get("/transcripts/:videoId", async (request) => {
    const { videoId } = parseOrThrow(Params, request.params, "The video id");
    const transcript = await transcripts.get(request.session!.accountId, videoId);
    if (transcript === null) {
      throw new ApiError("not_found", "No transcript is kept for this video");
    }
    return transcript;
  });

  app.put("/transcripts/:videoId", { bodyLimit: TRANSCRIPT_BODY_LIMIT_BYTES }, async (request, reply) => {
    const { videoId } = parseOrThrow(Params, request.params, "The video id");
    const transcript = parseOrThrow(StoredTranscript, request.body, "The transcript");
    if (transcript.videoId !== videoId) {
      throw new ApiError("invalid_request", "The transcript is for a different video than the path names");
    }
    await transcripts.putIfNoted(request.session!.accountId, transcript);
    return reply.status(204).send();
  });
}
