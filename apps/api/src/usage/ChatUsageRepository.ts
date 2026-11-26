import {
  CHAT_LIBRARY_RESERVE_UNITS,
  CHAT_UNITS_PER_ACCOUNT_DAILY,
  CHAT_UNITS_PER_QUESTION,
  chatAllowances,
  chatUsageAllowances,
  type ChatScopeKind,
  type ChatUsage,
  type Plan,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { nextUsageMonth, usageMonth } from "./usageMonth.js";

export type ChatReservation =
  | { reserved: true; day: string; used: number; limit: number }
  | { reserved: false; quota: "month" | "month-library" | "day" | "our-key-daily"; used: number; limit: number };

export interface SpeechRefusal {
  quota: "month" | "day";
  used: number;
  limit: number;
}

// Reserved before asking under the account's row lock, limited in usage: docs/architecture/tiers.md, "Chat usage".
export class ChatUsageRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async reserve(now: Date, accountId: AccountId, plan: Plan, globalDailyQuestions: number, scope: ChatScopeKind): Promise<ChatReservation> {
    const day = usageDay(now);
    const limit = chatUsageAllowances[plan];
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const [spent] = await tx.query<{ month: number | string | null; today: number | string | null }>(
        `select sum(units) as month, sum(units) filter (where day = $3::date) as today
         from chat_usage where account_id = $1 and day >= $2::date`,
        [accountId, usageMonth(now), day],
      );
      const month = Number(spent?.month ?? 0);
      const today = Number(spent?.today ?? 0);
      if (month >= limit) {
        return { reserved: false, quota: "month", used: month, limit };
      }
      if (scope === "library" && month + CHAT_LIBRARY_RESERVE_UNITS > limit) {
        return { reserved: false, quota: "month-library", used: month, limit };
      }
      if (today >= CHAT_UNITS_PER_ACCOUNT_DAILY) {
        return { reserved: false, quota: "day", used: today, limit: CHAT_UNITS_PER_ACCOUNT_DAILY };
      }
      const [global] = await tx.query<{ chat_units: number | string }>("select chat_units from our_key_usage where day = $1::date", [day]);
      if (globalDailyQuestions < 1 || Number(global?.chat_units ?? 0) >= globalDailyQuestions * CHAT_UNITS_PER_QUESTION) {
        return { reserved: false, quota: "our-key-daily", used: month, limit };
      }
      await tx.query(
        `insert into our_key_usage (day, chat_messages) values ($1::date, 1)
         on conflict (day) do update set chat_messages = our_key_usage.chat_messages + 1`,
        [day],
      );
      await tx.query(
        `insert into chat_usage (day, account_id, messages) values ($1::date, $2, 1)
         on conflict (account_id, day) do update set messages = chat_usage.messages + 1`,
        [day, accountId],
      );
      return { reserved: true, day, used: month, limit };
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

  // An answer's real cost, in usage units, on the day its question was reserved; a failed answer settles nothing.
  async settle(day: string, accountId: AccountId, units: number, scope: ChatScopeKind): Promise<void> {
    if (units <= 0) {
      return;
    }
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        "update chat_usage set units = units + $3, library_units = library_units + $4 where account_id = $1 and day = $2::date",
        [accountId, day, units, scope === "library" ? units : 0],
      );
      await tx.query("update our_key_usage set chat_units = chat_units + $2 where day = $1::date", [day, units]);
    });
  }

  // Read aloud spends usage but asks no question: docs/features/chat-read-aloud.md, "What a play costs".
  async speechRefusal(now: Date, accountId: AccountId, plan: Plan): Promise<SpeechRefusal | null> {
    const [spent] = await this.#sql.query<{ month: number | string | null; today: number | string | null }>(
      `select sum(units) as month, sum(units) filter (where day = $3::date) as today
       from chat_usage where account_id = $1 and day >= $2::date`,
      [accountId, usageMonth(now), usageDay(now)],
    );
    const month = Number(spent?.month ?? 0);
    const limit = chatUsageAllowances[plan];
    if (month >= limit) {
      return { quota: "month", used: month, limit };
    }
    const today = Number(spent?.today ?? 0);
    return today >= CHAT_UNITS_PER_ACCOUNT_DAILY ? { quota: "day", used: today, limit: CHAT_UNITS_PER_ACCOUNT_DAILY } : null;
  }

  async spendOnSpeech(now: Date, accountId: AccountId, units: number): Promise<void> {
    if (units <= 0) {
      return;
    }
    await this.#sql.query(
      `insert into chat_usage (day, account_id, units) values ($1::date, $2, $3)
       on conflict (account_id, day) do update set units = chat_usage.units + excluded.units`,
      [usageDay(now), accountId, units],
    );
  }

  async usage(now: Date, accountId: AccountId, plan: Plan): Promise<ChatUsage> {
    const [row] = await this.#sql.query<{ month: number | string | null; units: number | string | null }>(
      "select sum(messages) as month, sum(units) as units from chat_usage where account_id = $1 and day >= $2::date",
      [accountId, usageMonth(now)],
    );
    const units = Number(row?.units ?? 0);
    const limit = chatUsageAllowances[plan];
    return {
      plan,
      resetsOn: nextUsageMonth(now),
      used: Number(row?.month ?? 0),
      limit: chatAllowances[plan],
      share: units / limit,
      libraryFits: units + CHAT_LIBRARY_RESERVE_UNITS <= limit,
    };
  }
}
