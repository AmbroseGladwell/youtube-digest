import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type Plan } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { ChatReservation, ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";

// One message of the reader's allowance, taken before anything is asked, or the wait that says
// why not: the month, the day, or everyone's day on us (docs/features/chats.md, "Asking"). Every
// kind of chat counts the same, one message however many passes it takes.
export const reserveChatMessage = async (
  usage: ChatUsageRepository,
  { askedAt, accountId, plan, dailyMessages }: { askedAt: Date; accountId: AccountId; plan: Plan; dailyMessages: number },
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
