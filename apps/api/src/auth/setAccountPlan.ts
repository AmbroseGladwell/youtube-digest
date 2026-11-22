import { normaliseEmail } from "./normaliseEmail.js";
import type { Plan } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

// Set by hand until billing exists (OV-18).
export const setAccountPlan = async (sql: SqlClient, email: string, plan: Plan): Promise<boolean> => {
  const rows = await sql.query<{ id: string }>("update accounts set plan = $2 where email = $1 returning id", [
    normaliseEmail(email),
    plan,
  ]);
  return rows.length > 0;
};
