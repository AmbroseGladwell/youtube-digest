import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiLogLines, parseTikTokLink, TIKTOK_READ_PATH, type TikTokRead } from "@overview/domain";
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

interface TikTokRoutesOptions {
  reader: TikTokReader | null;
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
export const tiktokRoutes = (app: FastifyInstance, { reader, costs, trials, clock }: TikTokRoutesOptions): void => {
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
          segments: read.status === "read" ? (read.transcript?.segments.length ?? 0) : null,
          ...spent,
          ms: clock().getTime() - startedAt,
        }),
      );
      return read;
    },
  );
};
