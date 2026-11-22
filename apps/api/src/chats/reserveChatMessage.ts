import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type ChatScopeKind, type Plan } from "@overview/domain";
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
  scope: ChatScopeKind;
}

// The question counted before anything is asked, or the wait that says why not: docs/features/chats.md, "Asking".
export const reserveChatMessage = async (
  usage: ChatUsageRepository,
  { askedAt, accountId, plan, dailyMessages, scope }: ReserveChatMessageOptions,
  log: FastifyBaseLogger,
): Promise<Extract<ChatReservation, { reserved: true }>> => {
  const reservation = await usage.reserve(askedAt, accountId, plan, dailyMessages, scope);
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
  if (reservation.quota === "day") {
    throw new ApiError("too_many_requests", "That's the most chat for one day.", {
      quota: "chat-day",
      retryAfterSeconds: secondsToNextUsageDay(askedAt),
    });
  }
  const month = { quota: "chat-month", resetsOn: nextUsageMonth(askedAt), retryAfterSeconds: secondsToNextUsageMonth(askedAt) };
  throw reservation.quota === "month-library"
    ? new ApiError("too_many_requests", "Not enough chat left this month for a library question.", { ...month, scope: "library" })
    : new ApiError("too_many_requests", "You've used this month's chat.", month);
};
