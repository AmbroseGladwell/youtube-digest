import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { Plan, PodcastTranscription } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { ApiError } from "../http/ApiError.js";
import type { AudioStart } from "../podcasts/createPodcastTranscriptions.js";
import type { ServiceCaller } from "../transcripts/ServiceTranscripts.js";
import { SCRAPECREATORS_PRICE } from "../tiktok/createScrapeCreatorsTikTok.js";
import type { Spend } from "../tiktok/createTikTokReader.js";

export interface Spent {
  credits: number;
  vendorStatus: number | null;
}

export interface SpendTracker {
  spend: Spend;
  spent: Spent;
}

export const accountCallerFor =
  (planOf: (accountId: AccountId) => Promise<Plan>) =>
  async (request: FastifyRequest): Promise<ServiceCaller> => {
    if (request.session === null) {
      throw new ApiError("unauthenticated", "Sign in to make an overview");
    }
    return { accountId: request.session.accountId, plan: await planOf(request.session.accountId) };
  };

interface VendorSpendOptions {
  costs: AccountCostsRepository;
  clock: () => Date;
  detail: string;
}

// Every ScrapeCreators credit goes into the cost tally under its detail (docs/architecture/spend.md).
export const vendorSpendFor =
  ({ costs, clock, detail }: VendorSpendOptions) =>
  (request: FastifyRequest, log: FastifyBaseLogger): SpendTracker => {
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
        { area: "transcripts", detail, quantity: credits, dollars: credits * SCRAPECREATORS_PRICE.dollarsPerCredit },
        log,
      );
    };
    return { spend, spent };
  };

export const startedOrThrow = (started: AudioStart, reply: FastifyReply, noun: string): PodcastTranscription => {
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
      throw new ApiError("transcript_unavailable", `The ${noun} is too long to transcribe`, {
        transcription: "too-long",
        episodeSeconds: started.episodeSeconds,
      });
    case "no-audio":
      throw new ApiError("transcript_unavailable", `The ${noun} offers no sound to transcribe`, { transcription: "no-audio" });
  }
};
