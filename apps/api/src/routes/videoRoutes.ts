import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, VideoId, type VideoRead } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { OurKeyGenerator } from "../generation/OurKeyGenerator.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { ServiceCaller, ServiceTranscripts } from "../transcripts/ServiceTranscripts.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";
import { checkVideoKind } from "../videos/checkVideoKind.js";
import type { VideoKindsRepository } from "../videos/VideoKindsRepository.js";
import type { VideoReader } from "../videos/youTubeDataApiVideoReader.js";

const Body = z.object({ videoId: VideoId });

export interface VideoRoutesOptions {
  reader: VideoReader | null;
  generator: OurKeyGenerator | null;
  service: ServiceTranscripts | null;
  kinds: VideoKindsRepository;
  trials: TrialsRepository;
  sql: SqlClient;
  clock: () => Date;
}

// Like an article's or episode's read: an account or a trial token, and never the video in a log.
export const videoRoutes = (app: FastifyInstance, { reader, generator, service, kinds, trials, sql, clock }: VideoRoutesOptions): void => {
  app.post(
    "/videos/read",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.videoReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<VideoRead> => {
      const { videoId } = parseOrThrow(Body, request.body, "The video id");
      if (reader === null) {
        throw new ApiError("unavailable", "This server does not read videos itself");
      }
      await reserveTrialRead(request, reply, { trials, clock });
      const now = clock();
      const video = await reader(videoId).catch(() => undefined);
      if (video === undefined || video === null) {
        const reason = video === null ? "not-found" : "unavailable";
        request.log.info(apiLogLines.videos.read({ outcome: reason, noteKind: null, ms: clock().getTime() - now.getTime() }));
        return { status: "failed", reason };
      }
      const caller: ServiceCaller =
        request.session === null
          ? { address: request.clientAddress }
          : { accountId: request.session.accountId, plan: await accountPlan(sql, request.session.accountId) };
      const { noteKind, transcript } = await checkVideoKind(videoId, video, caller, { generator, service, kinds, now, log: request.log });
      request.log.info(apiLogLines.videos.read({ outcome: "read", noteKind, ms: clock().getTime() - now.getTime() }));
      return { status: "read", video, noteKind, transcript };
    },
  );
};
