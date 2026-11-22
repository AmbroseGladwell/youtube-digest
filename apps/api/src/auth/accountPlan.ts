import { Plan } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

export const accountPlan = async (sql: SqlClient, accountId: string): Promise<Plan> => {
  const [row] = await sql.query<{ plan: string }>("select plan from accounts where id = $1", [accountId]);
  return Plan.parse(row?.plan ?? "free");
};
