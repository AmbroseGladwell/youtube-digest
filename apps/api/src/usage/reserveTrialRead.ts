import type { FastifyReply, FastifyRequest } from "fastify";
import { apiLogLines, TRIAL_READS, TRIAL_READS_PER_ADDRESS_DAILY, TRIAL_TOKEN_HEADER } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { TrialsRepository } from "./TrialsRepository.js";

// Signed out, a link is read on the device's trial, which allows a few reads beside its one
// overview, whether the link is an article or a podcast episode (docs/features/onboarding.md,
// "Any kind of link"). An account reads without counting.
export async function reserveTrialRead(
  request: FastifyRequest,
  reply: FastifyReply,
  { trials, clock }: { trials: TrialsRepository; clock: () => Date },
): Promise<void> {
  if (request.session !== null) return;
  const trialToken = request.headers[TRIAL_TOKEN_HEADER];
  if (typeof trialToken !== "string") {
    throw new ApiError("unauthenticated", "Sign in, or start a trial, to read a link");
  }
  const now = clock();
  const reservation = await trials.reserveRead(now, trialToken, request.clientAddress);
  if (reservation.reserved) return;
  if (reservation.reason === "unknown") {
    throw new ApiError("unauthenticated", "This trial isn't known here", { trial: "unknown" });
  }
  if (reservation.reason === "spent") {
    request.log.warn(apiLogLines.articles.trialReadsSpent({ used: reservation.used, limit: TRIAL_READS }));
    throw new ApiError("too_many_requests", "You've read the links you can without an account", { quota: "trial-reads" });
  }
  const retryAfterSeconds = secondsToNextUsageDay(now);
  request.log.warn(apiLogLines.articles.trialReadAddressSpent({ used: reservation.used, limit: TRIAL_READS_PER_ADDRESS_DAILY }));
  reply.header("retry-after", String(retryAfterSeconds));
  throw new ApiError("too_many_requests", "Links read without an account are used up for today", {
    quota: "trial-reads-address",
    retryAfterSeconds,
  });
}
