import { normaliseEmail } from "./normaliseEmail.js";
import type { Plan } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

// Until billing exists (OV-18) the only way an account becomes Plus: set by hand, from
// the command line (docs/features/mcp-connector.md, "Plus").
export async function setAccountPlan(sql: SqlClient, email: string, plan: Plan): Promise<boolean> {
  const rows = await sql.query<{ id: string }>("update accounts set plan = $2 where email = $1 returning id", [
    normaliseEmail(email),
    plan,
  ]);
  return rows.length > 0;
}
