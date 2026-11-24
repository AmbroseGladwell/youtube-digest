import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { usageMonth } from "./usageMonth.js";

export type SaveReservation = { reserved: true; month: string } | { reserved: false; used: number };

// docs/features/kept-links.md, "The save limit".
export class CaptureSavesRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async reserve(now: Date, accountId: AccountId, limit: number): Promise<SaveReservation> {
    const month = usageMonth(now);
    if (limit < 1) {
      return { reserved: false, used: await this.usedIn(now, accountId) };
    }
    const rows = await this.#sql.query(
      `insert into capture_saves (month, account_id, saves) values ($1::date, $2, 1)
       on conflict (month, account_id) do update set saves = capture_saves.saves + 1
       where capture_saves.saves < $3
       returning saves`,
      [month, accountId, limit],
    );
    return rows.length > 0 ? { reserved: true, month } : { reserved: false, used: await this.usedIn(now, accountId) };
  }

  async release(month: string, accountId: AccountId): Promise<void> {
    await this.#sql.query("update capture_saves set saves = greatest(saves - 1, 0) where month = $1::date and account_id = $2", [
      month,
      accountId,
    ]);
  }

  async usedIn(now: Date, accountId: AccountId): Promise<number> {
    const [row] = await this.#sql.query<{ saves: number }>("select saves from capture_saves where month = $1::date and account_id = $2", [
      usageMonth(now),
      accountId,
    ]);
    return row?.saves ?? 0;
  }
}
