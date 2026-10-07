import type { FastifyBaseLogger } from "fastify";
import { apiLogLines } from "@overview/domain";
import type { SqlClient } from "./SqlClient.js";

export const SLOW_QUERY_MS = 500;
const STATEMENT_LOGGED_CHARACTERS = 120;

export interface TimedSqlClientOptions {
  log: () => FastifyBaseLogger;
  slowMs?: number;
  now?: () => number;
}

// The statement is the code's own text, logged without its parameters, which are the
// reader's data (docs/architecture/errors-and-logs.md, "The database").
const statementOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, STATEMENT_LOGGED_CHARACTERS);

export function timedSqlClient(inner: SqlClient, { log, slowMs = SLOW_QUERY_MS, now = () => performance.now() }: TimedSqlClientOptions): SqlClient {
  const timed = async <T>(run: () => Promise<T>, slow: (durationMs: number) => void): Promise<T> => {
    const startedAt = now();
    try {
      return await run();
    } finally {
      const durationMs = Math.round(now() - startedAt);
      if (durationMs >= slowMs) {
        slow(durationMs);
      }
    }
  };
  const wrap = (client: SqlClient): SqlClient => ({
    query: (text, params) =>
      timed(
        () => client.query(text, params),
        (durationMs) => log().warn(apiLogLines.db.slowQuery({ durationMs, statement: statementOf(text) })),
      ),
    execute: (text) =>
      timed(
        () => client.execute(text),
        (durationMs) => log().warn(apiLogLines.db.slowQuery({ durationMs, statement: statementOf(text) })),
      ),
    transaction: (run) =>
      timed(
        () => client.transaction((tx) => run(wrap(tx))),
        (durationMs) => log().warn(apiLogLines.db.slowTransaction({ durationMs })),
      ),
    close: () => client.close(),
  });
  return wrap(inner);
}
