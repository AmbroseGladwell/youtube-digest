import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  parseSocialPostLink,
  SOCIAL_READ_PATH,
  SOCIAL_TRANSCRIPTION_PATH,
  sourceKey,
  type Plan,
  type PodcastTranscription,
  type SocialPost,
  type SocialRead,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { createPodcastTranscriptions } from "../podcasts/createPodcastTranscriptions.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { SocialPostReader } from "../social/createSocialPostReader.js";
import type { ServiceCaller } from "../transcripts/ServiceTranscripts.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";
import { accountCallerFor, startedOrThrow, vendorSpendFor } from "./vendorReadParts.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const POST_LINK = "The post's link";
const TranscriptionParams = z.object({ id: z.uuid() });

type Transcriptions = Pick<ReturnType<typeof createPodcastTranscriptions>, "offer" | "startAudio" | "status">;

interface SocialRoutesOptions {
  reader: SocialPostReader | null;
  // Speech-to-text on our GPU host; absent, no video is transcribed and none is offered.
  transcriptions: Transcriptions | null;
  planOf: (accountId: AccountId) => Promise<Plan>;
  costs: AccountCostsRepository;
  trials: TrialsRepository;
  clock: () => Date;
}

const audioOf = (post: SocialPost, mediaUrl: string | null) => ({
  sourceKey: sourceKey({ kind: post.platform, id: post.id })!,
  durationSeconds: post.durationSeconds,
  audioUrl: mediaUrl,
});

// Instagram and Facebook posts; never the link, the account, the description or the words in a log (docs/features/social-posts.md).
export const socialRoutes = (app: FastifyInstance, { reader, transcriptions, planOf, costs, trials, clock }: SocialRoutesOptions): void => {
  const accountCallerOf = accountCallerFor(planOf);
  const callerOf = async (request: FastifyRequest): Promise<ServiceCaller> =>
    request.session === null ? { address: request.clientAddress } : accountCallerOf(request);
  const spendFor = vendorSpendFor({ costs, clock, detail: "social-vendor" });

  const transcriptionsOrRefuse = (): Transcriptions => {
    if (transcriptions === null) {
      throw new ApiError("unavailable", "Posts can't be transcribed here");
    }
    return transcriptions;
  };

  const readerOrRefuse = (): SocialPostReader => {
    if (reader === null) {
      throw new ApiError("unavailable", "This server does not read Instagram or Facebook links");
    }
    return reader;
  };

  app.post(
    SOCIAL_READ_PATH,
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.socialReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<SocialRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, POST_LINK);
      const social = readerOrRefuse();
      await reserveTrialRead(request, reply, { trials, clock });
      const startedAt = clock().getTime();
      const { spend, spent } = spendFor(request, request.log);
      const { read, mediaUrl } = await social.look(url, spend, { withTranscript: true });
      const link = parseSocialPostLink(url);
      request.log.info(
        apiLogLines.social.read({
          platform: link?.platform ?? "none",
          link: link?.kind ?? "none",
          outcome: read.status === "read" ? "read" : read.reason,
          media: read.status === "read" ? read.post.media : null,
          segments: read.status === "read" ? (read.transcript?.segments.length ?? 0) : null,
          ...spent,
          ms: clock().getTime() - startedAt,
        }),
      );
      if (read.status !== "read" || read.transcript !== null || read.post.media !== "video" || transcriptions === null) {
        return read;
      }
      return { ...read, transcription: await transcriptions.offer(audioOf(read.post, mediaUrl), await callerOf(request)) };
    },
  );

  // Only when the reader asks; the file's address comes from a fresh read, never from the caller or a cached answer.
  app.post(
    SOCIAL_TRANSCRIPTION_PATH,
    { preHandler: rateLimitHook(rateLimits.transcriptionPerAddress, (request) => request.clientAddress, clock) },
    async (request, reply): Promise<PodcastTranscription> => {
      const { url } = parseOrThrow(ReadBody, request.body, POST_LINK);
      const social = readerOrRefuse();
      const stt = transcriptionsOrRefuse();
      const caller = await accountCallerOf(request);
      const { spend } = spendFor(request, request.log);
      const { read, mediaUrl } = await social.look(url, spend, { withTranscript: false });
      if (read.status === "failed") {
        throw new ApiError("transcript_unavailable", "The post couldn't be read", { post: read.reason });
      }
      if (read.post.media !== "video") {
        throw new ApiError("transcript_unavailable", "The post has no video to transcribe", { transcription: "no-audio" });
      }
      return startedOrThrow(await stt.startAudio(audioOf(read.post, mediaUrl), caller, request.log), reply, "video");
    },
  );

  app.get(`${SOCIAL_TRANSCRIPTION_PATH}/:id`, async (request): Promise<PodcastTranscription> => {
    const stt = transcriptionsOrRefuse();
    const { id } = parseOrThrow(TranscriptionParams, request.params, "The transcription");
    const transcription = await stt.status(id, await accountCallerOf(request));
    if (transcription === null) {
      throw new ApiError("not_found", "No such transcription");
    }
    return transcription;
  });
};
