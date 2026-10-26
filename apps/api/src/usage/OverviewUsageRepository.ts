import type { KeySource, OverviewUsage, Plan } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { overviewQuotas } from "./overviewQuotas.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";
import { nextUsageMonth, usageMonth } from "./usageMonth.js";

// The month is the one the slot was taken in, so a generation that started before midnight
// on the last day gives back the month it counted against.
export type OverviewReservation =
  | { reserved: true; month: string; used: number; limit: number }
  | { reserved: false; used: number; limit: number };

export type OurKeyDayReservation = "reserved" | "spent" | "signed-out-share-spent";

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

  // The global cap behind every plan, counted per UTC day: one slot per generation on our
  // key, given back when it fails, like the proxy's budget. Signed out has its own share of
  // it, so a trial can't spend the day an account was counting on.
  async reserveOurKeyDay(now: Date, limit: number, signedOutLimit: number | null): Promise<OurKeyDayReservation> {
    const signedOut = signedOutLimit === null ? 0 : 1;
    if (limit < 1) return "spent";
    if (signedOutLimit !== null && signedOutLimit < 1) return "signed-out-share-spent";
    const rows = await this.#sql.query(
      `insert into our_key_usage (day, generations, signed_out) values ($1::date, 1, $3)
       on conflict (day) do update set
         generations = our_key_usage.generations + 1,
         signed_out = our_key_usage.signed_out + $3
       where our_key_usage.generations < $2 and our_key_usage.signed_out + $3 <= $4
       returning generations`,
      [usageDay(now), limit, signedOut, signedOutLimit ?? limit],
    );
    if (rows.length > 0) return "reserved";
    return (await this.ourKeyGenerationsOn(usageDay(now))) < limit ? "signed-out-share-spent" : "spent";
  }

  async releaseOurKeyDay(day: string, signedOut: boolean): Promise<void> {
    await this.#sql.query(
      `update our_key_usage set
         generations = greatest(generations - 1, 0),
         signed_out = greatest(signed_out - $2, 0)
       where day = $1::date`,
      [day, signedOut ? 1 : 0],
    );
  }

  async signedOutGenerationsOn(day: string): Promise<number> {
    const [row] = await this.#sql.query<{ signed_out: number }>("select signed_out from our_key_usage where day = $1::date", [day]);
    return row?.signed_out ?? 0;
  }

  async ourKeyGenerationsOn(day: string): Promise<number> {
    const [row] = await this.#sql.query<{ generations: number }>("select generations from our_key_usage where day = $1::date", [day]);
    return row?.generations ?? 0;
  }

  async #usedIn(month: string, accountId: AccountId, keySource: KeySource): Promise<number> {
    const [row] = await this.#sql.query<{ overviews: number }>(
      "select overviews from overview_usage where month = $1::date and account_id = $2 and key_source = $3",
      [month, accountId, keySource],
    );
    return row?.overviews ?? 0;
  }
}
