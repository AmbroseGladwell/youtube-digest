import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { SqlClient } from "./SqlClient.js";

// The test database: real Postgres, in process, running the same migration files
// (docs/conventions/backend-testing-guide.md).
export function createPgliteSqlClient(db: PGlite): SqlClient {
  const over = (queryable: PGlite | Transaction, transaction: SqlClient["transaction"]): SqlClient => ({
    async query<Row>(text: string, params: unknown[] = []) {
      const result = await queryable.query<Row>(text, params);
      return result.rows;
    },
    async execute(text: string) {
      await queryable.exec(text);
    },
    transaction,
    close: async () => {},
  });
  const transaction: SqlClient["transaction"] = (run) =>
    db.transaction((tx) => run(over(tx, (nested) => nested(over(tx, transaction)))));
  return { ...over(db, transaction), close: () => db.close() };
}
