import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  parseTikTokLink,
  sourceKey,
  TIKTOK_READ_PATH,
  TIKTOK_TRANSCRIPTION_PATH,
  type Plan,
  type PodcastTranscription,
  type TikTokRead,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import type { createPodcastTranscriptions } from "../podcasts/createPodcastTranscriptions.js";
import type { ServiceCaller } from "../transcripts/ServiceTranscripts.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { SCRAPECREATORS_PRICE } from "../tiktok/createScrapeCreatorsTikTok.js";
import type { Spend, TikTokReader } from "../tiktok/createTikTokReader.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const TIKTOK_LINK = "The TikTok link";
const TranscriptionParams = z.object({ id: z.uuid() });

type Transcriptions = Pick<ReturnType<typeof createPodcastTranscriptions>, "offer" | "startAudio" | "status">;

interface TikTokRoutesOptions {
  reader: TikTokReader | null;
  // Speech-to-text on our GPU host; absent, no TikTok is transcribed and none is offered.
  transcriptions: Transcriptions | null;
  planOf: (accountId: AccountId) => Promise<Plan>;
  costs: AccountCostsRepository;
  trials: TrialsRepository;
  clock: () => Date;
}

interface SpendTracker {
  spend: Spend;
  spent: Spent;
}

interface Spent {
  credits: number;
  vendorStatus: number | null;
}

// Never the link, the handle or the video in a log (docs/features/tiktok-links.md, "Who may ask").
export const tiktokRoutes = (app: FastifyInstance, { reader, transcriptions, planOf, costs, trials, clock }: TikTokRoutesOptions): void => {
  const accountCallerOf = async (request: FastifyRequest): Promise<ServiceCaller> => {
    if (request.session === null) {
      throw new ApiError("unauthenticated", "Sign in to make an overview");
    }
    return { accountId: request.session.accountId, plan: await planOf(request.session.accountId) };
  };
  const callerOf = async (request: FastifyRequest): Promise<ServiceCaller> =>
    request.session === null ? { address: request.clientAddress } : accountCallerOf(request);
  const transcriptionsOrRefuse = (): Transcriptions => {
    if (transcriptions === null) {
      throw new ApiError("unavailable", "TikToks can't be transcribed here");
    }
    return transcriptions;
  };

  const readerOrRefuse = (): TikTokReader => {
    if (reader === null) {
      throw new ApiError("unavailable", "This server does not read TikTok links");
    }
    return reader;
  };

  const spendFor = (request: FastifyRequest, log: FastifyBaseLogger): SpendTracker => {
    const spent: Spent = { credits: 0, vendorStatus: null };
    const payer = request.session === null ? ("signed-out" as const) : { accountId: request.session.accountId };
    const spend: Spend = async (credits, vendorStatus) => {
      spent.credits += credits;
      spent.vendorStatus = vendorStatus;
      if (credits === 0) {
        return;
      }
      await costs.recordOrLog(
        clock(),
        payer,
        { area: "transcripts", detail: "tiktok-vendor", quantity: credits, dollars: credits * SCRAPECREATORS_PRICE.dollarsPerCredit },
        log,
      );
    };
    return { spend, spent };
  };

  app.post(
    TIKTOK_READ_PATH,
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.tiktokReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<TikTokRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, TIKTOK_LINK);
      const tiktok = readerOrRefuse();
      await reserveTrialRead(request, reply, { trials, clock });
      const startedAt = clock().getTime();
      const { spend, spent } = spendFor(request, request.log);
      const { read, mediaUrl } = await tiktok.look(url, spend, { withTranscript: true });
      request.log.info(
        apiLogLines.tiktok.read({
          link: parseTikTokLink(url)?.kind ?? "none",
          outcome: read.status === "read" ? "read" : read.reason,
          captions: read.status === "read" ? read.video.captions.length : null,
          segments: read.status === "read" ? (read.transcript?.segments.length ?? 0) : null,
          ...spent,
          ms: clock().getTime() - startedAt,
        }),
      );
      if (read.status !== "read" || read.transcript !== null || transcriptions === null) {
        return read;
      }
      const audio = {
        sourceKey: sourceKey({ kind: "tiktok", id: read.video.id })!,
        durationSeconds: read.video.durationSeconds,
        audioUrl: mediaUrl,
      };
      return { ...read, transcription: await transcriptions.offer(audio, await callerOf(request)) };
    },
  );

  // Only when the reader asks; the file's address comes from a fresh read, never from the caller (docs/features/tiktok-links.md).
  app.post(
    TIKTOK_TRANSCRIPTION_PATH,
    { preHandler: rateLimitHook(rateLimits.transcriptionPerAddress, (request) => request.clientAddress, clock) },
    async (request, reply): Promise<PodcastTranscription> => {
      const { url } = parseOrThrow(ReadBody, request.body, TIKTOK_LINK);
      const tiktok = readerOrRefuse();
      const stt = transcriptionsOrRefuse();
      const caller = await accountCallerOf(request);
      const { spend } = spendFor(request, request.log);
      const { read, mediaUrl } = await tiktok.look(url, spend, { withTranscript: false });
      if (read.status === "failed") {
        throw new ApiError("transcript_unavailable", "The TikTok couldn't be read", { tiktok: read.reason });
      }
      const audio = {
        sourceKey: sourceKey({ kind: "tiktok", id: read.video.id })!,
        durationSeconds: read.video.durationSeconds,
        audioUrl: mediaUrl,
      };
      const started = await stt.startAudio(audio, caller, request.log);
      switch (started.status) {
        case "started":
          return started.transcription;
        case "over-allowance":
          reply.header("retry-after", String(started.retryAfterSeconds));
          throw new ApiError("too_many_requests", "You've transcribed as many hours as you can this month", {
            quota: "transcription",
            usedSeconds: started.usedSeconds,
            limitSeconds: started.limitSeconds,
            retryAfterSeconds: started.retryAfterSeconds,
          });
        case "too-long":
          throw new ApiError("transcript_unavailable", "The TikTok is too long to transcribe", {
            transcription: "too-long",
            episodeSeconds: started.episodeSeconds,
          });
        case "no-audio":
          throw new ApiError("transcript_unavailable", "The TikTok offers no sound to transcribe", { transcription: "no-audio" });
      }
    },
  );

  app.get(`${TIKTOK_TRANSCRIPTION_PATH}/:id`, async (request): Promise<PodcastTranscription> => {
    const stt = transcriptionsOrRefuse();
    const { id } = parseOrThrow(TranscriptionParams, request.params, "The transcription");
    const transcription = await stt.status(id, await accountCallerOf(request));
    if (transcription === null) {
      throw new ApiError("not_found", "No such transcription");
    }
    return transcription;
  });
};
