import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { RecordKind } from "./RecordKind.js";
import { storedRecordFromRow, type RecordRow, type StoredRecord } from "./StoredRecord.js";
import type { WriteDecision } from "./WriteDecision.js";

export interface WriteOutcome {
  kind: RecordKind;
  id: string;
  rev: number;
  seq: number;
}

export interface WriteOperation {
  kind: RecordKind;
  id: string;
  decide: (current: StoredRecord | null) => WriteDecision;
}

export interface ChangesPage {
  changes: StoredRecord[];
  next: number;
  more: boolean;
}

const RECORD_COLUMNS = "kind, id, schema_version, rev, seq, updated_at, deleted, body";

// Every write allocates the account's next seq first, and that update row-locks the
// account for the rest of the transaction: one account's writes commit in seq order, so a
// puller can never advance past a seq that is still in flight
// (docs/features/sync-api.md).
export class RecordsRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  async write(accountId: AccountId, operations: WriteOperation[]): Promise<Array<WriteOutcome | null>> {
    return this.#sql.transaction(async (tx) => {
      const outcomes: Array<WriteOutcome | null> = [];
      for (const { kind, id, decide } of operations) {
        const seq = await this.#allocateSeq(tx, accountId);
        const current = await this.#get(tx, accountId, kind, id);
        const decision = decide(current);
        if (decision.action === "nothing") {
          outcomes.push(null);
          continue;
        }
        const rev = (current?.rev ?? 0) + 1;
        const stored = decision.action === "tombstone" ? { schemaVersion: current!.schemaVersion, updatedAt: null, body: null } : decision;
        await tx.query(
          `insert into records (account_id, kind, id, schema_version, rev, seq, updated_at, stored_at, deleted, body)
           values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::jsonb)
           on conflict (account_id, kind, id) do update set
             schema_version = excluded.schema_version, rev = excluded.rev, seq = excluded.seq,
             updated_at = excluded.updated_at, stored_at = excluded.stored_at,
             deleted = excluded.deleted, body = excluded.body`,
          [
            accountId,
            kind,
            id,
            stored.schemaVersion,
            rev,
            seq,
            stored.updatedAt,
            this.#clock().toISOString(),
            decision.action === "tombstone",
            stored.body === null ? null : JSON.stringify(stored.body),
          ],
        );
        outcomes.push({ kind, id, rev, seq });
      }
      return outcomes;
    });
  }

  async listChanges(accountId: AccountId, since: number, limit: number): Promise<ChangesPage> {
    const rows = await this.#sql.query<RecordRow>(
      `select ${RECORD_COLUMNS} from records where account_id = $1 and seq > $2 order by seq limit $3`,
      [accountId, since, limit + 1],
    );
    const changes = rows.slice(0, limit).map(storedRecordFromRow);
    return {
      changes,
      next: changes.at(-1)?.seq ?? since,
      more: rows.length > limit,
    };
  }

  async #allocateSeq(tx: SqlClient, accountId: AccountId): Promise<number> {
    const rows = await tx.query<{ last_seq: number | string | bigint }>(
      "update accounts set last_seq = last_seq + 1 where id = $1 returning last_seq",
      [accountId],
    );
    return Number(rows[0]!.last_seq);
  }

  async #get(tx: SqlClient, accountId: AccountId, kind: RecordKind, id: string): Promise<StoredRecord | null> {
    const rows = await tx.query<RecordRow>(
      `select ${RECORD_COLUMNS} from records where account_id = $1 and kind = $2 and id = $3`,
      [accountId, kind, id],
    );
    return rows[0] === undefined ? null : storedRecordFromRow(rows[0]);
  }
}
