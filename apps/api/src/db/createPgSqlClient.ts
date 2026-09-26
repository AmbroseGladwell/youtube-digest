import pg from "pg";
import type { SqlClient } from "./SqlClient.js";

type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

function clientOver(queryable: Queryable, transaction: SqlClient["transaction"]): SqlClient {
  return {
    async query<Row>(text: string, params: unknown[] = []) {
      const result = await queryable.query(text, params);
      return result.rows as Row[];
    },
    async execute(text: string) {
      await queryable.query(text);
    },
    transaction,
    close: async () => {},
  };
}

export function createPgSqlClient(pool: pg.Pool): SqlClient {
  const transaction: SqlClient["transaction"] = async (run) => {
    const connection = await pool.connect();
    try {
      await connection.query("begin");
      const result = await run(clientOver(connection, (nested) => nested(clientOver(connection, transaction))));
      await connection.query("commit");
      return result;
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
  };
  return { ...clientOver(pool, transaction), close: () => pool.end() };
}
