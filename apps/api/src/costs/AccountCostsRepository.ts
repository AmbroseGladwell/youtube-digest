import { apiLogLines } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { usageDay } from "../transcripts/ServiceUsageRepository.js";

export type CostArea = "generation" | "embeddings" | "transcripts" | "chat" | "questions" | "speech";

export type CostPayer = { accountId: AccountId } | "signed-out";

export interface CostEntry {
  area: CostArea;
  detail: string;
  quantity: number;
  dollars: number;
}

export interface DayCost extends CostEntry {
  day: string;
  calls: number;
}

interface DayCostRow {
  day: Date | string;
  area: CostArea;
  detail: string;
  calls: number;
  quantity: number;
  dollars: number;
}

const fromRow = (row: DayCostRow): DayCost => ({
  day: typeof row.day === "string" ? row.day.slice(0, 10) : row.day.toISOString().slice(0, 10),
  area: row.area,
  detail: row.detail,
  calls: row.calls,
  quantity: Number(row.quantity),
  dollars: Number(row.dollars),
});

// What is recorded: docs/architecture/unit-economics.md, "What is recorded".
export class AccountCostsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async record(now: Date, payer: CostPayer, { area, detail, quantity, dollars }: CostEntry): Promise<void> {
    if (payer === "signed-out") {
      await this.#sql.query(
        `insert into signed_out_costs (day, area, detail, calls, quantity, dollars) values ($1, $2, $3, 1, $4, $5)
         on conflict (day, area, detail) do update set
           calls = signed_out_costs.calls + 1,
           quantity = signed_out_costs.quantity + excluded.quantity,
           dollars = signed_out_costs.dollars + excluded.dollars`,
        [usageDay(now), area, detail, quantity, dollars],
      );
      return;
    }
    await this.#sql.query(
      `insert into account_costs (day, account_id, area, detail, calls, quantity, dollars) values ($1, $2, $3, $4, 1, $5, $6)
       on conflict (day, account_id, area, detail) do update set
         calls = account_costs.calls + 1,
         quantity = account_costs.quantity + excluded.quantity,
         dollars = account_costs.dollars + excluded.dollars`,
      [usageDay(now), payer.accountId, area, detail, quantity, dollars],
    );
  }

  async recordOrLog(now: Date, payer: CostPayer, entry: CostEntry, log: { error(line: object): void }): Promise<void> {
    try {
      await this.record(now, payer, entry);
    } catch (error) {
      log.error(
        apiLogLines.costs.notRecorded({
          area: entry.area,
          detail: entry.detail,
          reason: error instanceof Error ? error.constructor.name : "unknown",
        }),
      );
    }
  }

  async monthDollars(accountId: AccountId, area: CostArea, now: Date): Promise<number> {
    const [row] = await this.#sql.query<{ dollars: number | string | null }>(
      `select sum(dollars) as dollars from account_costs where account_id = $1 and area = $2 and day >= $3::date`,
      [accountId, area, `${usageDay(now).slice(0, 7)}-01`],
    );
    return Number(row?.dollars ?? 0);
  }

  async of(payer: CostPayer): Promise<DayCost[]> {
    const rows =
      payer === "signed-out"
        ? await this.#sql.query<DayCostRow>(
            `select day, area, detail, calls, quantity, dollars from signed_out_costs order by day, area, detail`,
          )
        : await this.#sql.query<DayCostRow>(
            `select day, area, detail, calls, quantity, dollars from account_costs where account_id = $1 order by day, area, detail`,
            [payer.accountId],
          );
    return rows.map(fromRow);
  }
}
