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

// Another kind's key holds a colon (docs/features/source-identity.md). An episode's words the
// account hasn't uploaded are fetched afresh from where they were found (podcast-transcripts.md).
const isYouTubeKey = (key: string): boolean => !key.includes(":");

// An episode's words by its key alone, fetched afresh from where they were found, for a reader's
// device that holds the key but not the words (docs/features/podcast-transcripts.md).
export type EpisodeWords = (key: SourceKey, accountId: AccountId, log: FastifyBaseLogger) => Promise<StoredTranscript | null>;

// A video's captions our server fetches for an account that has a note on it but no copy yet:
// a copy saved from a shared link, or a device that never uploaded one. Null where our server
// doesn't fetch, or couldn't (docs/features/transcript-storage.md, "Each account's own copy").
export type VideoWords = (videoId: VideoId, accountId: AccountId, log: FastifyBaseLogger) => Promise<StoredTranscript | null>;

export function transcriptRoutes(
  app: FastifyInstance,
  { transcripts, episodeWords, videoWords }: { transcripts: TranscriptsRepository; episodeWords: EpisodeWords; videoWords: VideoWords },
): void {
  // The words an account has a note on but no copy of, fetched for it and kept as its own.
  const fetchedFor = async (accountId: AccountId, videoId: VideoId, log: FastifyBaseLogger): Promise<StoredTranscript | null> => {
    if (!(await transcripts.hasLiveNote(accountId, videoId))) return null;
    const fetched = isYouTubeKey(videoId) ? await videoWords(videoId, accountId, log) : await episodeWords(videoId, accountId, log);
    if (fetched === null || transcriptFault(fetched, videoId) !== null) return null;
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

  // The shared cache is gone (OV-295). An older client still asks it before fetching for itself,
  // and is told there is nothing, so it carries on down its own rungs.
  app.get("/shared-transcripts/:videoId", { config: { public: true } }, async () => {
    throw new ApiError("not_found", "No transcript is kept for every reader");
  });
}
