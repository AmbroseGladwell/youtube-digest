import type { SqlClient } from "../db/SqlClient.js";
import { usageMonth } from "../usage/usageMonth.js";

const RECHECK_MS = 60_000;

// What Modal has cost this month, speech and speech-to-text together, from the metered costs.
const SPENT_THIS_MONTH = `
  select coalesce(sum(dollars), 0) as dollars from (
    select dollars from account_costs where day >= $1::date and ((area = 'speech' and detail like '%-modal') or (area = 'transcripts' and detail = 'speech-to-text'))
    union all
    select dollars from signed_out_costs where day >= $1::date and ((area = 'speech' and detail like '%-modal') or (area = 'transcripts' and detail = 'speech-to-text'))
  ) spent`;

export interface ModalSpendGuardOptions {
  sql: SqlClient;
  monthlyDollars: number | null;
  clock: () => Date;
  onClosed: (spent: number, limit: number) => void;
}

// Before Modal's usage limit, until the month turns: docs/features/tts-pre-rendered-speech.md, "On Modal (OV-423)".
export class ModalSpendGuard {
  #options: ModalSpendGuardOptions;
  #open = true;
  #checkedAt = Number.NEGATIVE_INFINITY;
  #checking: Promise<void> | null = null;

  constructor(options: ModalSpendGuardOptions) {
    this.#options = options;
  }

  open = (): boolean => {
    if (this.#options.monthlyDollars === null) {
      return true;
    }
    if (this.#options.clock().getTime() - this.#checkedAt >= RECHECK_MS && this.#checking === null) {
      this.#checking = this.check().finally(() => {
        this.#checking = null;
      });
    }
    return this.#open;
  };

  async check(): Promise<void> {
    const { sql, monthlyDollars, clock, onClosed } = this.#options;
    if (monthlyDollars === null) {
      return;
    }
    const now = clock();
    this.#checkedAt = now.getTime();
    const [row] = await sql.query<{ dollars: number | string }>(SPENT_THIS_MONTH, [usageMonth(now)]);
    const spent = Number(row?.dollars ?? 0);
    const open = spent < monthlyDollars;
    if (this.#open && !open) {
      onClosed(spent, monthlyDollars);
    }
    this.#open = open;
  }
}
