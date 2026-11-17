import { CHAT_MESSAGES_PER_ACCOUNT_DAILY, chatAllowances, type ChatUsage, type Plan } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { nextUsageMonth, usageMonth } from "./usageMonth.js";

export type ChatReservation =
  | { reserved: true; day: string; used: number; limit: number }
  | { reserved: false; quota: "month" | "day" | "our-key-daily"; used: number; limit: number };

// One row per account and UTC day; the month is the sum of its days. A message is reserved
// before it is asked and given back if it fails, so it counts once, when it is answered.
// Under the account's row lock, so two questions at once can't both take the last one.
// The global day lives beside overviews' in our_key_usage (docs/architecture/tiers.md).
export class ChatUsageRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async reserve(now: Date, accountId: AccountId, plan: Plan, globalDailyLimit: number): Promise<ChatReservation> {
    const day = usageDay(now);
    const limit = chatAllowances[plan];
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const [counts] = await tx.query<{ month: number | string | null; today: number | string | null }>(
        `select sum(messages) as month, sum(messages) filter (where day = $3::date) as today
         from chat_usage where account_id = $1 and day >= $2::date`,
        [accountId, usageMonth(now), day],
      );
      const month = Number(counts?.month ?? 0);
      const today = Number(counts?.today ?? 0);
      if (month >= limit) return { reserved: false, quota: "month", used: month, limit };
      if (today >= CHAT_MESSAGES_PER_ACCOUNT_DAILY)
        return { reserved: false, quota: "day", used: today, limit: CHAT_MESSAGES_PER_ACCOUNT_DAILY };
      const global = await tx.query(
        `insert into our_key_usage (day, chat_messages) values ($1::date, 1)
         on conflict (day) do update set chat_messages = our_key_usage.chat_messages + 1
         where our_key_usage.chat_messages < $2
         returning chat_messages`,
        [day, globalDailyLimit],
      );
      if (globalDailyLimit < 1 || global.length === 0) return { reserved: false, quota: "our-key-daily", used: month, limit };
      await tx.query(
        `insert into chat_usage (day, account_id, messages) values ($1::date, $2, 1)
         on conflict (account_id, day) do update set messages = chat_usage.messages + 1`,
        [day, accountId],
      );
      return { reserved: true, day, used: month + 1, limit };
    });
  }

  async release(day: string, accountId: AccountId): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await tx.query("update chat_usage set messages = greatest(messages - 1, 0) where account_id = $1 and day = $2::date", [
        accountId,
        day,
      ]);
      await tx.query("update our_key_usage set chat_messages = greatest(chat_messages - 1, 0) where day = $1::date", [day]);
    });
  }

  async usage(now: Date, accountId: AccountId, plan: Plan): Promise<ChatUsage> {
    const [row] = await this.#sql.query<{ month: number | string | null }>(
      "select sum(messages) as month from chat_usage where account_id = $1 and day >= $2::date",
      [accountId, usageMonth(now)],
    );
    return { plan, resetsOn: nextUsageMonth(now), used: Number(row?.month ?? 0), limit: chatAllowances[plan] };
  }
}
