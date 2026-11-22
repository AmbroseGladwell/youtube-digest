import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type Plan } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { ChatReservation, ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";

export interface ReserveChatMessageOptions {
  askedAt: Date;
  accountId: AccountId;
  plan: Plan;
  dailyMessages: number;
}

// One message of the allowance however many passes it takes: docs/features/chats.md, "Asking".
export const reserveChatMessage = async (
  usage: ChatUsageRepository,
  { askedAt, accountId, plan, dailyMessages }: ReserveChatMessageOptions,
  log: FastifyBaseLogger,
): Promise<Extract<ChatReservation, { reserved: true }>> => {
  const reservation = await usage.reserve(askedAt, accountId, plan, dailyMessages);
  if (reservation.reserved) {
    return reservation;
  }
  if (reservation.quota === "our-key-daily") {
    log.warn(apiLogLines.chat.dailyCapSpent({ limit: dailyMessages }));
    throw new ApiError("too_many_requests", "We've answered as many questions as we can today. Try again tomorrow.", {
      quota: "chat-our-key-daily",
      retryAfterSeconds: secondsToNextUsageDay(askedAt),
    });
  }
  log.info(apiLogLines.chat.allowanceSpent({ plan, quota: reservation.quota, used: reservation.used, limit: reservation.limit }));
  throw reservation.quota === "month"
    ? new ApiError("too_many_requests", "You've asked this month's questions on us.", {
        quota: "chat-month",
        resetsOn: nextUsageMonth(askedAt),
        retryAfterSeconds: secondsToNextUsageMonth(askedAt),
      })
    : new ApiError("too_many_requests", "You've asked as many questions as you can today.", {
        quota: "chat-day",
        retryAfterSeconds: secondsToNextUsageDay(askedAt),
      });
};
