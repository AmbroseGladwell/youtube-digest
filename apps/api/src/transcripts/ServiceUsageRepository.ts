import type { SqlClient } from "../db/SqlClient.js";

const GLOBAL_CALLER = "global";
const CALLER_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProxySpend {
  proxied: number;
  proxyBytes: number;
}

export const usageDay = (now: Date): string => now.toISOString().slice(0, 10);

// One row per UTC day and caller for what our own service fetched, and one global row per
// day for what went through the proxy and how many bytes it carried. Kept in Postgres
// rather than memory because a restart must not hand out a second day's budget
// (docs/architecture/server-side-transcripts.md).
export class ServiceUsageRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async takeFetch(now: Date, caller: string, limit: number): Promise<boolean> {
    if (limit < 1) return false;
    await this.#sql.query("delete from service_transcript_usage where caller <> $1 and day < $2::date", [
      GLOBAL_CALLER,
      usageDay(new Date(now.getTime() - CALLER_RETENTION_DAYS * DAY_MS)),
    ]);
    const rows = await this.#sql.query(
      `insert into service_transcript_usage (day, caller, fetches) values ($1::date, $2, 1)
       on conflict (day, caller) do update set fetches = service_transcript_usage.fetches + 1
       where service_transcript_usage.fetches < $3
       returning fetches`,
      [usageDay(now), caller, limit],
    );
    return rows.length > 0;
  }

  async reserveProxy(now: Date, limit: number): Promise<boolean> {
    if (limit < 1) return false;
    const rows = await this.#sql.query(
      `insert into service_transcript_usage (day, caller, proxied) values ($1::date, $2, 1)
       on conflict (day, caller) do update set proxied = service_transcript_usage.proxied + 1
       where service_transcript_usage.proxied < $3
       returning proxied`,
      [usageDay(now), GLOBAL_CALLER, limit],
    );
    return rows.length > 0;
  }

  async releaseProxy(now: Date): Promise<void> {
    await this.#sql.query(
      "update service_transcript_usage set proxied = greatest(proxied - 1, 0) where day = $1::date and caller = $2",
      [usageDay(now), GLOBAL_CALLER],
    );
  }

  async addProxyBytes(now: Date, bytes: number): Promise<ProxySpend> {
    const [row] = await this.#sql.query<{ proxied: number; proxy_bytes: number }>(
      `update service_transcript_usage set proxy_bytes = proxy_bytes + $3
       where day = $1::date and caller = $2
       returning proxied, proxy_bytes::float8 as proxy_bytes`,
      [usageDay(now), GLOBAL_CALLER, bytes],
    );
    return { proxied: row?.proxied ?? 0, proxyBytes: row?.proxy_bytes ?? 0 };
  }

  async spendOn(day: string): Promise<ProxySpend> {
    const [row] = await this.#sql.query<{ proxied: number; proxy_bytes: number }>(
      "select proxied, proxy_bytes::float8 as proxy_bytes from service_transcript_usage where day = $1::date and caller = $2",
      [day, GLOBAL_CALLER],
    );
    return { proxied: row?.proxied ?? 0, proxyBytes: row?.proxy_bytes ?? 0 };
  }
}
