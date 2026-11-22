import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, parseTikTokLink, type StoredTranscript, type TikTokRead } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { TikTokReader } from "../tiktok/createTikTokReader.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const TranscriptBody = z.object({ videoId: z.string().regex(/^\d{8,25}$/) });

// An account, and never the link, the handle or the video in a log: what someone watches is
// theirs. Reading a link runs on a trial, like a podcast's; the words wait for an account
// (docs/features/tiktok-links.md).
export function tiktokRoutes(
  app: FastifyInstance,
  { reader, trials, clock }: { reader: TikTokReader; trials: TrialsRepository; clock: () => Date },
): void {
  app.post(
    "/tiktok/read",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.tiktokReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<TikTokRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, "The TikTok link");
      await reserveTrialRead(request, reply, { trials, clock });
      const startedAt = clock().getTime();
      const read = await reader.read(url);
      request.log.info(
        apiLogLines.tiktok.read({
          link: parseTikTokLink(url)?.kind ?? "none",
          outcome: read.status === "read" ? "read" : read.reason,
          captions: read.status === "read" ? read.video.captions.length : null,
          ms: clock().getTime() - startedAt,
        }),
      );
      return read;
    },
  );

  app.post(
    "/tiktok/transcript",
    {
      preHandler: rateLimitHook(rateLimits.tiktokTranscriptPerAddress, (request) => request.clientAddress, clock),
    },
    async (request): Promise<StoredTranscript> => {
      const { videoId } = parseOrThrow(TranscriptBody, request.body, "The TikTok video");
      if (request.session === null) throw new ApiError("unauthenticated", "Sign in to make an overview");
      const startedAt = clock().getTime();
      try {
        const { transcript, source } = await reader.transcript(videoId);
        request.log.info(
          apiLogLines.tiktok.transcript({ source, segments: transcript.segments.length, ms: clock().getTime() - startedAt }),
        );
        return transcript;
      } catch (error) {
        if (!(error instanceof TranscriptFetchError)) throw error;
        request.log.info(apiLogLines.tiktok.transcript({ failure: error.failure, ms: clock().getTime() - startedAt }));
        throw new ApiError("transcript_unavailable", error.message, { failure: error.failure });
      }
    },
  );
}
