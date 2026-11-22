import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiLogLines, parseTikTokLink, type StoredTranscript, type TikTokRead } from "@overview/domain";
import { TranscriptFetchError } from "@overview/transcripts";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { SCRAPECREATORS_PRICE } from "../tiktok/createScrapeCreatorsTikTok.js";
import type { Spend, TikTokReader } from "../tiktok/createTikTokReader.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { reserveTrialRead } from "../usage/reserveTrialRead.js";

const ReadBody = z.object({ url: z.string().min(1).max(2048) });
const TranscriptBody = z.object({
  url: z
    .url()
    .max(2048)
    .refine((url) => parseTikTokLink(url)?.kind === "video", "A TikTok video's address"),
});

interface Spent {
  credits: number;
  vendorStatus: number | null;
}

// An account, and never the link, the handle or the video in a log: what someone watches is
// theirs. Reading a link runs on a trial, like a podcast's; the words wait for an account. Without
// the vendor's key, both say TikTok isn't read here (docs/features/tiktok-links.md).
export function tiktokRoutes(
  app: FastifyInstance,
  {
    reader,
    costs,
    trials,
    clock,
  }: { reader: TikTokReader | null; costs: AccountCostsRepository; trials: TrialsRepository; clock: () => Date },
): void {
  const readerOrRefuse = (): TikTokReader => {
    if (reader === null) throw new ApiError("unavailable", "This server does not read TikTok links");
    return reader;
  };

  const spendFor = (request: FastifyRequest, log: FastifyBaseLogger): { spend: Spend; spent: Spent } => {
    const spent: Spent = { credits: 0, vendorStatus: null };
    const payer = request.session === null ? ("signed-out" as const) : { accountId: request.session.accountId };
    const spend: Spend = async (credits, vendorStatus) => {
      spent.credits += credits;
      spent.vendorStatus = vendorStatus;
      if (credits === 0) return;
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
    "/tiktok/read",
    {
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.tiktokReadPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply): Promise<TikTokRead> => {
      const { url } = parseOrThrow(ReadBody, request.body, "The TikTok link");
      const tiktok = readerOrRefuse();
      await reserveTrialRead(request, reply, { trials, clock });
      const startedAt = clock().getTime();
      const { spend, spent } = spendFor(request, request.log);
      const read = await tiktok.read(url, spend);
      request.log.info(
        apiLogLines.tiktok.read({
          link: parseTikTokLink(url)?.kind ?? "none",
          outcome: read.status === "read" ? "read" : read.reason,
          captions: read.status === "read" ? read.video.captions.length : null,
          ...spent,
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
      const { url } = parseOrThrow(TranscriptBody, request.body, "The TikTok video");
      if (request.session === null) throw new ApiError("unauthenticated", "Sign in to make an overview");
      const tiktok = readerOrRefuse();
      const startedAt = clock().getTime();
      const { spend, spent } = spendFor(request, request.log);
      try {
        const { transcript, source } = await tiktok.transcript(url, spend);
        request.log.info(
          apiLogLines.tiktok.transcript({ source, segments: transcript.segments.length, ...spent, ms: clock().getTime() - startedAt }),
        );
        return transcript;
      } catch (error) {
        if (!(error instanceof TranscriptFetchError)) throw error;
        request.log.info(apiLogLines.tiktok.transcript({ failure: error.failure, ...spent, ms: clock().getTime() - startedAt }));
        throw new ApiError("transcript_unavailable", error.message, { failure: error.failure });
      }
    },
  );
}
