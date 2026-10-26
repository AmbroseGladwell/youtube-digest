import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { OverviewReservation, OverviewUsageRepository } from "./OverviewUsageRepository.js";

export type OwnKeyReservation = { reserved: true } | { reserved: false; used: number; limit: number };

// One row per overview an account may push as new: made on our key, saved from a share, or
// reserved on the reader's own key before the device generates. `held_month` is set while
// an own-key slot can still be given back, which is until the overview is pushed or made
// on our key instead (docs/architecture/tiers.md, "Counting").
export class OverviewReservationsRepository {
  #sql: SqlClient;
  #usage: OverviewUsageRepository;

  constructor(sql: SqlClient, usage: OverviewUsageRepository) {
    this.#sql = sql;
    this.#usage = usage;
  }

  // A second ask for the same overview while its slot is still held is the same reservation,
  // so a retried request never counts twice. Once made, asking again is a regeneration and
  // counts again.
  async reserveOwn(now: Date, accountId: AccountId, overviewId: string, limit: number): Promise<OwnKeyReservation> {
    const [held] = await this.#sql.query(
      "select 1 from overview_reservations where account_id = $1 and overview_id = $2 and held_month is not null",
      [accountId, overviewId],
    );
    if (held !== undefined) return { reserved: true };
    const slot = await this.#usage.reserve(now, accountId, "own", limit);
    if (!slot.reserved) return slot;
    await this.#sql.query(
      `insert into overview_reservations (account_id, overview_id, source, held_month, reserved_at)
       values ($1, $2, 'own', $3::date, $4::timestamptz)
       on conflict (account_id, overview_id) do update set
         source = 'own', held_month = excluded.held_month, reserved_at = excluded.reserved_at`,
      [accountId, overviewId, slot.month, now.toISOString()],
    );
    return { reserved: true };
  }

  // Only a slot not yet pushed can be given back, so a reservation can't be released once
  // its overview is in the account.
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
    if (row === undefined) return false;
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

  // An overview made on our key in a signed-out trial and moved in on sign-in counts on the
  // account's month on our key, the key that made it (docs/architecture/tiers.md, "Counting").
  async movedFromTrial(now: Date, accountId: AccountId, overviewId: string, limit: number): Promise<OverviewReservation> {
    const slot = await this.#usage.reserve(now, accountId, "ours", limit);
    if (slot.reserved) await this.#grant(now, accountId, overviewId, "ours");
    return slot;
  }

  async savedFromShare(now: Date, accountId: AccountId, overviewId: string): Promise<void> {
    await this.#grant(now, accountId, overviewId, "share");
  }

  // Taken as the overview is pushed: true when the account may hold it as new. The slot is
  // spent from here on.
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
