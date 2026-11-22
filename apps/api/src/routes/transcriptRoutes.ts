import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, StoredTranscript, VideoId, type SourceKey } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { transcriptFault } from "../transcripts/transcriptFault.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

const TRANSCRIPT_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

const Params = z.object({ videoId: VideoId });

// Another kind's key holds a colon: docs/features/source-identity.md, "Why YouTube's key is unprefixed".
const isYouTubeKey = (key: string): boolean => !key.includes(":");

// docs/features/podcast-transcripts.md, "Each reader's own copy".
export type EpisodeWords = (key: SourceKey, accountId: AccountId, log: FastifyBaseLogger) => Promise<StoredTranscript | null>;

// Fetched for the account: docs/features/transcript-storage.md, "Following the reader across devices".
export type VideoWords = (videoId: VideoId, accountId: AccountId, log: FastifyBaseLogger) => Promise<StoredTranscript | null>;

export interface TranscriptRoutesOptions {
  transcripts: TranscriptsRepository;
  episodeWords: EpisodeWords;
  videoWords: VideoWords;
}

export const transcriptRoutes = (app: FastifyInstance, { transcripts, episodeWords, videoWords }: TranscriptRoutesOptions): void => {
  // A TikTok's words come only with a read, which costs a credit, so another device has the kept copy or none.
  const wordsFetchedAfresh = (key: VideoId, accountId: AccountId, log: FastifyBaseLogger): Promise<StoredTranscript | null> => {
    if (isYouTubeKey(key)) {
      return videoWords(key, accountId, log);
    }
    return key.startsWith("tiktok:") ? Promise.resolve(null) : episodeWords(key, accountId, log);
  };

  const fetchedFor = async (accountId: AccountId, videoId: VideoId, log: FastifyBaseLogger): Promise<StoredTranscript | null> => {
    if (!(await transcripts.hasLiveNote(accountId, videoId))) {
      return null;
    }
    const fetched = await wordsFetchedAfresh(videoId, accountId, log);
    if (fetched === null || transcriptFault(fetched, videoId) !== null) {
      return null;
    }
    await transcripts.putIfNoted(accountId, fetched);
    return fetched;
  };

  app.get("/transcripts/:videoId", async (request) => {
    const { videoId } = parseOrThrow(Params, request.params, "The video id");
    const accountId = request.session!.accountId;
    const kept = await transcripts.get(accountId, videoId);
    const transcript = kept ?? (await fetchedFor(accountId, videoId, request.log));
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
    const fault = transcriptFault(transcript, videoId);
    if (fault !== null) {
      request.log.warn(apiLogLines.transcripts.refused({ fault, segments: transcript.segments.length }));
      return reply.status(204).send();
    }
    const kept = await transcripts.putIfNoted(request.session!.accountId, transcript);
    const logged = { kept, generated: transcript.generated, segments: transcript.segments.length };
    if (kept === "not-noted") {
      request.log.warn(apiLogLines.transcripts.notKept(logged));
    } else {
      request.log.info(apiLogLines.transcripts.stored(logged));
    }
    return reply.status(204).send();
  });

  // The shared cache is gone (OV-295); an older client still asks before fetching for itself.
  app.get("/shared-transcripts/:videoId", { config: { public: true } }, async () => {
    throw new ApiError("not_found", "No transcript is kept for every reader");
  });
};
