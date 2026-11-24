import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

export type ClaimOutcome = { claimed: true; until: Date } | { claimed: false; until: Date };

// docs/features/kept-links.md, "Made once".
export class CaptureClaimsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async claim(accountId: AccountId, sourceKey: string, holder: string, now: Date, until: Date): Promise<ClaimOutcome> {
    const taken = await this.#sql.query<{ until: string }>(
      `insert into capture_claims (account_id, source_key, holder, until) values ($1, $2, $3, $5::timestamptz)
       on conflict (account_id, source_key) do update set holder = excluded.holder, until = excluded.until
       where capture_claims.holder = excluded.holder or capture_claims.until <= $4::timestamptz
       returning until`,
      [accountId, sourceKey, holder, now.toISOString(), until.toISOString()],
    );
    if (taken.length > 0) {
      return { claimed: true, until };
    }
    const [held] = await this.#sql.query<{ until: string | Date }>(
      "select until from capture_claims where account_id = $1 and source_key = $2",
      [accountId, sourceKey],
    );
    return { claimed: false, until: new Date(held!.until) };
  }

  async release(accountId: AccountId, sourceKey: string, holder: string): Promise<void> {
    await this.#sql.query("delete from capture_claims where account_id = $1 and source_key = $2 and holder = $3", [
      accountId,
      sourceKey,
      holder,
    ]);
  }
}
