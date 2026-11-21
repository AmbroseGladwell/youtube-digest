import { TRIAL_READS, TRIAL_READS_PER_ADDRESS_DAILY } from "@overview/domain";
import { generateToken } from "../auth/generateToken.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { hashedAddress } from "../http/hashedAddress.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";

const ADDRESS_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialReadReservation = { reserved: true } | { reserved: false; reason: "unknown" | "spent" | "address-spent"; used: number };

// The signed-out trial: a token issued to the device, so onboarding can read the reader's link,
// and suggest topics for it, before there's an account. It makes nothing (OV-327). Reads are
// counted against the token and, separately, against the address it asks from, whose hash is
// kept a week.
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

  async isKnown(token: string): Promise<boolean> {
    const rows = await this.#sql.query("select 1 from trial_tokens where token_hash = $1", [hashToken(token)]);
    return rows.length > 0;
  }

  // A read is counted whether or not the page can be read, since fetching it is the work. The
  // token's slot first, then the address's day; a refusal from the address gives the token's back.
  async reserveRead(now: Date, token: string, address: string): Promise<TrialReadReservation> {
    const tokenHash = hashToken(token);
    const [held] = await this.#sql.query<{ reads: number }>(
      "update trial_tokens set reads = reads + 1 where token_hash = $1 and reads < $2 returning reads",
      [tokenHash, TRIAL_READS],
    );
    if (held === undefined) {
      const [row] = await this.#sql.query<{ reads: number }>("select reads from trial_tokens where token_hash = $1", [tokenHash]);
      return row === undefined ? { reserved: false, reason: "unknown", used: 0 } : { reserved: false, reason: "spent", used: row.reads };
    }
    const day = usageDay(now);
    await this.#sql.query("delete from trial_address_usage where day < $1::date", [
      usageDay(new Date(now.getTime() - ADDRESS_RETENTION_DAYS * DAY_MS)),
    ]);
    const [counted] = await this.#sql.query<{ reads: number }>(
      `insert into trial_address_usage (day, address, reads) values ($1::date, $2, 1)
       on conflict (day, address) do update set reads = trial_address_usage.reads + 1
       where trial_address_usage.reads < $3
       returning reads`,
      [day, hashedAddress(address), TRIAL_READS_PER_ADDRESS_DAILY],
    );
    if (counted === undefined) {
      await this.#sql.query("update trial_tokens set reads = greatest(reads - 1, 0) where token_hash = $1", [tokenHash]);
      return { reserved: false, reason: "address-spent", used: TRIAL_READS_PER_ADDRESS_DAILY };
    }
    return { reserved: true };
  }
}
