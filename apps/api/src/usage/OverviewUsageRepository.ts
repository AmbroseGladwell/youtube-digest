import type { KeySource, OverviewUsage, Plan } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { overviewQuotas } from "./overviewQuotas.js";
import { nextUsageMonth, usageMonth } from "./usageMonth.js";

// The month is the one the slot was taken in, so a generation that started before midnight
// on the last day gives back the month it counted against.
export type OverviewReservation =
  | { reserved: true; month: string; used: number; limit: number }
  | { reserved: false; used: number; limit: number };

// One row per UTC month, account and key. A slot is reserved before generation and released
// when it fails, so an overview counts once, when it succeeds; regenerating reserves again
// (docs/architecture/tiers.md, "Counting"). Kept in Postgres, since a deploy that reset it
// would spend real money twice.
export class OverviewUsageRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async reserve(now: Date, accountId: AccountId, keySource: KeySource, limit: number): Promise<OverviewReservation> {
    const month = usageMonth(now);
    if (limit < 1) return { reserved: false, used: await this.#usedIn(month, accountId, keySource), limit };
    const [row] = await this.#sql.query<{ overviews: number }>(
      `insert into overview_usage (month, account_id, key_source, overviews) values ($1::date, $2, $3, 1)
       on conflict (month, account_id, key_source) do update set overviews = overview_usage.overviews + 1
       where overview_usage.overviews < $4
       returning overviews`,
      [month, accountId, keySource, limit],
    );
    if (row !== undefined) return { reserved: true, month, used: row.overviews, limit };
    return { reserved: false, used: await this.#usedIn(month, accountId, keySource), limit };
  }

  async release(month: string, accountId: AccountId, keySource: KeySource): Promise<void> {
    await this.#sql.query(
      `update overview_usage set overviews = greatest(overviews - 1, 0)
       where month = $1::date and account_id = $2 and key_source = $3`,
      [month, accountId, keySource],
    );
  }

  async usage(now: Date, accountId: AccountId, plan: Plan): Promise<OverviewUsage> {
    const month = usageMonth(now);
    const rows = await this.#sql.query<{ key_source: KeySource; overviews: number }>(
      "select key_source, overviews from overview_usage where month = $1::date and account_id = $2",
      [month, accountId],
    );
    const used = (keySource: KeySource) => rows.find((row) => row.key_source === keySource)?.overviews ?? 0;
    return {
      plan,
      resetsOn: nextUsageMonth(now),
      ours: { used: used("ours"), limit: overviewQuotas[plan].ours },
      own: { used: used("own"), limit: overviewQuotas[plan].own },
    };
  }

  async #usedIn(month: string, accountId: AccountId, keySource: KeySource): Promise<number> {
    const [row] = await this.#sql.query<{ overviews: number }>(
      "select overviews from overview_usage where month = $1::date and account_id = $2 and key_source = $3",
      [month, accountId, keySource],
    );
    return row?.overviews ?? 0;
  }
}
