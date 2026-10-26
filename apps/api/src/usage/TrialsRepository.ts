import { TRIAL_OVERVIEWS } from "@overview/domain";
import { generateToken } from "../auth/generateToken.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { hashedAddress } from "../http/hashedAddress.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";

// Trial overviews on our key a UTC day per address, across every token: a private window
// mints a new token, so the cap counts what costs money (docs/architecture/tiers.md, "Counting").
export const TRIAL_OVERVIEWS_PER_ADDRESS_DAILY = 3;

const ADDRESS_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialReservation =
  | { reserved: true; day: string; used: number }
  | { reserved: false; reason: "unknown" | "spent" | "address-spent"; used: number };

// The signed-out trial's count on our key, kept against a token issued to the device and,
// separately, against the address it asks from. Neither is ever the no-account library's
// contents, which OV-47 empties into the account on sign-in. Overviews made in a trial are
// remembered by id, so one moved into an account on sign-in counts on the key that made it.
export class TrialsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async issue(now: Date): Promise<string> {
    const token = generateToken();
    await this.#sql.query("insert into trial_tokens (token_hash, issued_at) values ($1, $2::timestamptz)", [
      hashToken(token),
      now.toISOString(),
    ]);
    return token;
  }

  // The token's slot first, then the address's day; a refusal from the address gives the
  // token's slot back, so only an overview both allow is counted.
  async reserve(now: Date, token: string, address: string): Promise<TrialReservation> {
    const tokenHash = hashToken(token);
    const [held] = await this.#sql.query<{ overviews: number }>(
      `update trial_tokens set overviews = overviews + 1
       where token_hash = $1 and overviews < $2
       returning overviews`,
      [tokenHash, TRIAL_OVERVIEWS],
    );
    if (held === undefined) {
      const used = await this.used(token);
      return used === null ? { reserved: false, reason: "unknown", used: 0 } : { reserved: false, reason: "spent", used };
    }
    const day = usageDay(now);
    await this.#sql.query("delete from trial_address_usage where day < $1::date", [
      usageDay(new Date(now.getTime() - ADDRESS_RETENTION_DAYS * DAY_MS)),
    ]);
    const addressKey = hashedAddress(address);
    const [counted] = await this.#sql.query<{ overviews: number }>(
      `insert into trial_address_usage (day, address, overviews) values ($1::date, $2, 1)
       on conflict (day, address) do update set overviews = trial_address_usage.overviews + 1
       where trial_address_usage.overviews < $3
       returning overviews`,
      [day, addressKey, TRIAL_OVERVIEWS_PER_ADDRESS_DAILY],
    );
    if (counted === undefined) {
      await this.#releaseToken(tokenHash);
      const [row] = await this.#sql.query<{ overviews: number }>(
        "select overviews from trial_address_usage where day = $1::date and address = $2",
        [day, addressKey],
      );
      return { reserved: false, reason: "address-spent", used: row?.overviews ?? 0 };
    }
    return { reserved: true, day, used: held.overviews };
  }

  async release(token: string, day: string, address: string): Promise<void> {
    await this.#releaseToken(hashToken(token));
    await this.#sql.query(
      "update trial_address_usage set overviews = greatest(overviews - 1, 0) where day = $1::date and address = $2",
      [day, hashedAddress(address)],
    );
  }

  // How many the token has made on our key, or null for a token this server never issued.
  async used(token: string): Promise<number | null> {
    const [row] = await this.#sql.query<{ overviews: number }>("select overviews from trial_tokens where token_hash = $1", [
      hashToken(token),
    ]);
    return row?.overviews ?? null;
  }

  async made(now: Date, overviewId: string): Promise<void> {
    await this.#sql.query(
      "insert into trial_overviews (overview_id, made_at) values ($1, $2::timestamptz) on conflict (overview_id) do nothing",
      [overviewId, now.toISOString()],
    );
  }

  async madeInTrial(overviewId: string): Promise<boolean> {
    const rows = await this.#sql.query("select 1 from trial_overviews where overview_id = $1", [overviewId]);
    return rows.length > 0;
  }

  // Once an account has counted it, a trial overview is that account's like any other.
  async forget(overviewId: string): Promise<void> {
    await this.#sql.query("delete from trial_overviews where overview_id = $1", [overviewId]);
  }

  async #releaseToken(tokenHash: string): Promise<void> {
    await this.#sql.query("update trial_tokens set overviews = greatest(overviews - 1, 0) where token_hash = $1", [
      tokenHash,
    ]);
  }
}
