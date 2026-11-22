import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { OverviewUsageRepository } from "./OverviewUsageRepository.js";

export type OwnKeyReservation = { reserved: true } | { reserved: false; used: number; limit: number };

// How reservations count: docs/architecture/tiers.md, "Counting".
export class OverviewReservationsRepository {
  #sql: SqlClient;
  #usage: OverviewUsageRepository;

  constructor(sql: SqlClient, usage: OverviewUsageRepository) {
    this.#sql = sql;
    this.#usage = usage;
  }

  // A retry while the slot is held is the same reservation; once made, asking again is a regeneration.
  async reserveOwn(now: Date, accountId: AccountId, overviewId: string, limit: number): Promise<OwnKeyReservation> {
    const [held] = await this.#sql.query(
      "select 1 from overview_reservations where account_id = $1 and overview_id = $2 and held_month is not null",
      [accountId, overviewId],
    );
    if (held !== undefined) {
      return { reserved: true };
    }
    const slot = await this.#usage.reserve(now, accountId, "own", limit);
    if (!slot.reserved) {
      return slot;
    }
    await this.#sql.query(
      `insert into overview_reservations (account_id, overview_id, source, held_month, reserved_at)
       values ($1, $2, 'own', $3::date, $4::timestamptz)
       on conflict (account_id, overview_id) do update set
         source = 'own', held_month = excluded.held_month, reserved_at = excluded.reserved_at`,
      [accountId, overviewId, slot.month, now.toISOString()],
    );
    return { reserved: true };
  }

  async release(accountId: AccountId, overviewId: string): Promise<boolean> {
    const [row] = await this.#sql.query<{ held_month: string; made: boolean }>(
      `with held as (
         select held_month from overview_reservations
         where account_id = $1 and overview_id = $2 and held_month is not null
         for update
       )
       update overview_reservations set held_month = null
       from held
       where account_id = $1 and overview_id = $2
       returning to_char(held.held_month, 'YYYY-MM-DD') as held_month, made`,
      [accountId, overviewId],
    );
    if (row === undefined) {
      return false;
    }
    if (!row.made) {
      await this.#sql.query("delete from overview_reservations where account_id = $1 and overview_id = $2", [accountId, overviewId]);
    }
    await this.#usage.release(row.held_month, accountId, "own");
    return true;
  }

  // A fallback counts once, on ours: an own-key slot still held for the overview is given back.
  async madeOnOurKey(now: Date, accountId: AccountId, overviewId: string): Promise<void> {
    await this.release(accountId, overviewId);
    await this.#grant(now, accountId, overviewId, "ours");
  }

  async savedFromShare(now: Date, accountId: AccountId, overviewId: string): Promise<void> {
    await this.#grant(now, accountId, overviewId, "share");
  }

  // True when the account may hold the overview as new; the slot is spent from here.
  async claim(accountId: AccountId, overviewId: string): Promise<boolean> {
    const rows = await this.#sql.query(
      `update overview_reservations set made = true, held_month = null
       where account_id = $1 and overview_id = $2
       returning 1`,
      [accountId, overviewId],
    );
    return rows.length > 0;
  }

  async #grant(now: Date, accountId: AccountId, overviewId: string, source: "ours" | "share"): Promise<void> {
    await this.#sql.query(
      `insert into overview_reservations (account_id, overview_id, source, made, reserved_at)
       values ($1, $2, $3, true, $4::timestamptz)
       on conflict (account_id, overview_id) do update set source = excluded.source, made = true, held_month = null`,
      [accountId, overviewId, source, now.toISOString()],
    );
  }
}
