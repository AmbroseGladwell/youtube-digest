import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

export type RefreshOutcome = "written" | "full" | "no-pairs" | "failed";

export interface RefreshDue {
  now: Date;
  windowStart: Date;
  perWindow: number;
  latestAllowed: Date;
  staleBefore: Date;
}

export type RefreshBegun = { id: string } | { refused: "busy" | "not-due" };

export interface RefreshFinish {
  scopes: readonly string[];
  pairsLabelled: number;
  questionsWritten: number;
  outcome: RefreshOutcome;
}

export interface OpenedProject {
  projectId: string;
  openedAt: string;
}

const PROJECT_SCOPE = "project:";

const asIso = (value: Date | string): string => (typeof value === "string" ? new Date(value).toISOString() : value.toISOString());

export const libraryScopeKey = "library";
export const projectScopeKey = (projectId: string): string => `${PROJECT_SCOPE}${projectId}`;

// A pair once asked in a scope is never asked there again, so tombstones count too.
export const askedPairKey = (scopeKey: string, overviewIds: readonly [string, string]): string =>
  `${scopeKey}|${[...overviewIds].sort().join("|")}`;

const askedPairOfId = (id: string): string | null => {
  const parts = id.split(":");
  if (parts[0] === "library" && parts.length === 4) {
    return askedPairKey(libraryScopeKey, [parts[1]!, parts[2]!]);
  }
  if (parts[0] === "project" && parts.length === 5) {
    return askedPairKey(projectScopeKey(parts[1]!), [parts[2]!, parts[3]!]);
  }
  return null;
};

// The rules and why: docs/features/suggested-questions.md, "Slice 2: the refresh".
export class QuestionRefreshesRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async opened(accountId: AccountId, scopeKey: string, now: Date): Promise<void> {
    await this.#sql.query(
      `insert into question_scopes_opened (account_id, scope_key, opened_at) values ($1, $2, $3::timestamptz)
       on conflict (account_id, scope_key) do update set opened_at = excluded.opened_at`,
      [accountId, scopeKey, now.toISOString()],
    );
  }

  async openedProjects(accountId: AccountId): Promise<OpenedProject[]> {
    const rows = await this.#sql.query<{ scope_key: string; opened_at: Date | string }>(
      `select scope_key, opened_at from question_scopes_opened where account_id = $1 and scope_key like 'project:%' order by opened_at desc`,
      [accountId],
    );
    return rows.map((row) => ({ projectId: row.scope_key.slice(PROJECT_SCOPE.length), openedAt: asIso(row.opened_at) }));
  }

  // Counted means it labelled something, or it may have before it stopped answering.
  async begin(accountId: AccountId, { now, windowStart, perWindow, latestAllowed, staleBefore }: RefreshDue): Promise<RefreshBegun> {
    return this.#sql.transaction(async (tx) => {
      await tx.query("select id from accounts where id = $1 for update", [accountId]);
      const [running] = await tx.query<{ id: string }>(
        `select id from question_refreshes where account_id = $1 and outcome = 'running' and started_at > $2::timestamptz limit 1`,
        [accountId, staleBefore.toISOString()],
      );
      if (running !== undefined) {
        return { refused: "busy" as const };
      }
      const counted = await tx.query<{ started_at: Date | string }>(
        `select started_at from question_refreshes
          where account_id = $1 and (pairs_labelled > 0 or outcome = 'running')
          order by started_at desc limit $2`,
        [accountId, perWindow],
      );
      const latest = counted[0] === undefined ? null : asIso(counted[0].started_at);
      const inWindow = counted.filter((row) => asIso(row.started_at) > windowStart.toISOString()).length;
      if (
        latest !== null &&
        (inWindow >= perWindow || latest > latestAllowed.toISOString() || !(await this.#savedSince(tx, accountId, latest)))
      ) {
        return { refused: "not-due" as const };
      }
      const [row] = await tx.query<{ id: string }>(
        `insert into question_refreshes (account_id, started_at) values ($1, $2::timestamptz) returning id`,
        [accountId, now.toISOString()],
      );
      return { id: row!.id };
    });
  }

  async finish(id: string, now: Date, { scopes, pairsLabelled, questionsWritten, outcome }: RefreshFinish): Promise<void> {
    await this.#sql.query(
      `update question_refreshes set finished_at = $2::timestamptz, scopes = $3::text[], pairs_labelled = $4, questions_written = $5, outcome = $6
        where id = $1`,
      [id, now.toISOString(), [...scopes], pairsLabelled, questionsWritten, outcome],
    );
  }

  async askedPairs(accountId: AccountId): Promise<Set<string>> {
    const rows = await this.#sql.query<{ id: string }>(`select id from records where account_id = $1 and kind = 'suggestedQuestion'`, [
      accountId,
    ]);
    return new Set(rows.flatMap((row) => askedPairOfId(row.id) ?? []));
  }

  async #savedSince(tx: SqlClient, accountId: AccountId, since: string): Promise<boolean> {
    const [row] = await tx.query<{ id: string }>(
      `select id from records where account_id = $1 and kind = 'overview' and not deleted and stored_at > $2::timestamptz limit 1`,
      [accountId, since],
    );
    return row !== undefined;
  }
}
