import type { SqlClient } from "../db/SqlClient.js";

export type NarrationStepStatus = "pending" | "done" | "skipped" | "not_configured" | "failed";
export type ErasureStepStatus = "pending" | "queued" | "skipped" | "not_configured" | "failed";

// The audit record of one deletion: what was captured before the rows went, and how each
// step outside the transaction ended, so an unfinished erasure is visible rather than
// assumed (docs/features/account-deletion.md).
export interface AccountDeletion {
  id: string;
  accountId: string;
  anonymousId: string | null;
  narrationKeys: string[];
  narration: NarrationStepStatus;
  postHogAccount: ErasureStepStatus;
  postHogAnonymous: ErasureStepStatus;
  lastError: string | null;
  deletedAt: Date;
  finishedAt: Date | null;
}

interface AccountDeletionRow {
  id: string;
  account_id: string;
  anonymous_id: string | null;
  narration_keys: string[];
  narration_status: NarrationStepStatus;
  posthog_account_status: ErasureStepStatus;
  posthog_anonymous_status: ErasureStepStatus;
  last_error: string | null;
  deleted_at: Date | string;
  finished_at: Date | string | null;
}

const COLUMNS =
  "id, account_id, anonymous_id, narration_keys, narration_status, posthog_account_status, posthog_anonymous_status, last_error, deleted_at, finished_at";

const fromRow = (row: AccountDeletionRow): AccountDeletion => ({
  id: row.id,
  accountId: row.account_id,
  anonymousId: row.anonymous_id,
  narrationKeys: row.narration_keys,
  narration: row.narration_status,
  postHogAccount: row.posthog_account_status,
  postHogAnonymous: row.posthog_anonymous_status,
  lastError: row.last_error,
  deletedAt: new Date(row.deleted_at),
  finishedAt: row.finished_at === null ? null : new Date(row.finished_at),
});

export interface StepStatuses {
  narration: NarrationStepStatus;
  postHogAccount: ErasureStepStatus;
  postHogAnonymous: ErasureStepStatus;
}

const TERMINAL = new Set<string>(["done", "queued", "skipped"]);

export const deletionIsFinished = ({ narration, postHogAccount, postHogAnonymous }: StepStatuses): boolean =>
  [narration, postHogAccount, postHogAnonymous].every((status) => TERMINAL.has(status));

export class AccountDeletionsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async insert(deletion: {
    accountId: string;
    anonymousId: string | null;
    narrationKeys: string[];
    narration: NarrationStepStatus;
    postHogAccount: ErasureStepStatus;
    postHogAnonymous: ErasureStepStatus;
    now: Date;
  }): Promise<AccountDeletion> {
    const rows = await this.#sql.query<AccountDeletionRow>(
      `insert into account_deletions
         (account_id, anonymous_id, narration_keys, narration_status, posthog_account_status, posthog_anonymous_status, deleted_at)
       values ($1, $2, $3::jsonb, $4, $5, $6, $7::timestamptz)
       returning ${COLUMNS}`,
      [
        deletion.accountId,
        deletion.anonymousId,
        JSON.stringify(deletion.narrationKeys),
        deletion.narration,
        deletion.postHogAccount,
        deletion.postHogAnonymous,
        deletion.now.toISOString(),
      ],
    );
    return fromRow(rows[0]!);
  }

  async get(id: string): Promise<AccountDeletion | null> {
    const rows = await this.#sql.query<AccountDeletionRow>(`select ${COLUMNS} from account_deletions where id = $1`, [id]);
    return rows[0] === undefined ? null : fromRow(rows[0]);
  }

  async listUnfinished(): Promise<AccountDeletion[]> {
    const rows = await this.#sql.query<AccountDeletionRow>(
      `select ${COLUMNS} from account_deletions where finished_at is null order by deleted_at`,
    );
    return rows.map(fromRow);
  }

  async recordSteps(id: string, steps: StepStatuses, lastError: string | null, now: Date): Promise<AccountDeletion> {
    const rows = await this.#sql.query<AccountDeletionRow>(
      `update account_deletions
         set narration_status = $2, posthog_account_status = $3, posthog_anonymous_status = $4, last_error = $5,
             finished_at = case when $6 then $7::timestamptz else null end
       where id = $1
       returning ${COLUMNS}`,
      [id, steps.narration, steps.postHogAccount, steps.postHogAnonymous, lastError, deletionIsFinished(steps), now.toISOString()],
    );
    return fromRow(rows[0]!);
  }
}
