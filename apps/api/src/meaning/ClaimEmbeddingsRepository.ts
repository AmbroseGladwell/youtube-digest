import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

export interface PendingOverview {
  accountId: AccountId;
  overviewId: string;
  rev: number;
  schemaVersion: number;
  body: Record<string, unknown>;
  attempts: number;
}

export interface EmbeddedClaim {
  textHash: string;
  vector: number[];
}

export interface MeaningMatch {
  overviewId: string;
  similarity: number;
}

interface PendingRow {
  account_id: AccountId;
  id: string;
  rev: number;
  schema_version: number;
  body: Record<string, unknown>;
  attempts: number | null;
  attempted_rev: number | null;
}

const asVector = (vector: number[]) => `[${vector.join(",")}]`;

// Embeddings are derived data kept apart from the record, never on the changes feed, and
// keyed to the rev they were made from, so a regenerated overview is re-embedded rather
// than kept stale (docs/features/search-by-meaning.md, "Storage").
export class ClaimEmbeddingsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async nextPending(now: Date, maxAttempts: number): Promise<PendingOverview | null> {
    const rows = await this.#sql.query<PendingRow>(
      `select r.account_id, r.id, r.rev, r.schema_version, r.body, e.attempts, e.attempted_rev
         from records r
         left join overview_embeddings e on e.account_id = r.account_id and e.overview_id = r.id
        where r.kind = 'overview' and not r.deleted
          and (e.overview_id is null or e.embedded_rev is distinct from r.rev)
          and (e.overview_id is null or e.attempted_rev <> r.rev
               or (e.attempts < $2 and (e.not_before is null or e.not_before <= $1::timestamptz)))
        order by r.stored_at desc
        limit 1`,
      [now.toISOString(), maxAttempts],
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      accountId: row.account_id,
      overviewId: row.id,
      rev: row.rev,
      schemaVersion: row.schema_version,
      body: row.body,
      attempts: row.attempted_rev === row.rev ? (row.attempts ?? 0) : 0,
    };
  }

  async claimsOf(accountId: AccountId, overviewId: string, model: string): Promise<EmbeddedClaim[]> {
    const rows = await this.#sql.query<{ text_hash: string; embedding: string }>(
      `select text_hash, embedding::text as embedding from claim_embeddings
        where account_id = $1 and overview_id = $2 and model = $3`,
      [accountId, overviewId, model],
    );
    return rows.map((row) => ({ textHash: row.text_hash, vector: JSON.parse(row.embedding) as number[] }));
  }

  async saveEmbedded(
    pending: PendingOverview,
    { model, tokens, claims, now }: { model: string; tokens: number; claims: EmbeddedClaim[]; now: Date },
  ): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        `insert into overview_embeddings (account_id, overview_id, embedded_rev, model, tokens, attempted_rev, attempts, not_before, last_error, updated_at)
         values ($1, $2, $3, $4, $5, $3, 0, null, null, $6::timestamptz)
         on conflict (account_id, overview_id) do update set
           embedded_rev = excluded.embedded_rev, model = excluded.model, tokens = excluded.tokens,
           attempted_rev = excluded.attempted_rev, attempts = 0, not_before = null, last_error = null,
           updated_at = excluded.updated_at`,
        [pending.accountId, pending.overviewId, pending.rev, model, tokens, now.toISOString()],
      );
      await tx.query("delete from claim_embeddings where account_id = $1 and overview_id = $2", [pending.accountId, pending.overviewId]);
      for (const [position, claim] of claims.entries()) {
        await tx.query(
          `insert into claim_embeddings (account_id, overview_id, position, text_hash, model, embedding)
           values ($1, $2, $3, $4, $5, $6::vector)`,
          [pending.accountId, pending.overviewId, position, claim.textHash, model, asVector(claim.vector)],
        );
      }
    });
  }

  async recordFailure(
    pending: PendingOverview,
    { attempts, notBefore, error, now }: { attempts: number; notBefore: Date | null; error: string; now: Date },
  ): Promise<void> {
    await this.#sql.query(
      `insert into overview_embeddings (account_id, overview_id, attempted_rev, attempts, not_before, last_error, updated_at)
       values ($1, $2, $3, $4, $5::timestamptz, $6, $7::timestamptz)
       on conflict (account_id, overview_id) do update set
         attempted_rev = excluded.attempted_rev, attempts = excluded.attempts, not_before = excluded.not_before,
         last_error = excluded.last_error, updated_at = excluded.updated_at`,
      [pending.accountId, pending.overviewId, pending.rev, attempts, notBefore?.toISOString() ?? null, error, now.toISOString()],
    );
  }

  async forgetRemoved(): Promise<number> {
    const rows = await this.#sql.query<{ overview_id: string }>(
      `delete from overview_embeddings e
        where not exists (
          select 1 from records r
           where r.account_id = e.account_id and r.kind = 'overview' and r.id = e.overview_id and not r.deleted
        )
        returning e.overview_id`,
    );
    return rows.length;
  }

  // One reader's claims only, compared against the current rev of each overview: a search
  // never reaches another account, and never an embedding the record has moved past.
  async closest(accountId: AccountId, vector: number[], model: string, limit: number): Promise<MeaningMatch[]> {
    const rows = await this.#sql.query<{ overview_id: string; similarity: number }>(
      `select c.overview_id, max(1 - (c.embedding <=> $2::vector)) as similarity
         from claim_embeddings c
         join overview_embeddings e on e.account_id = c.account_id and e.overview_id = c.overview_id
         join records r on r.account_id = e.account_id and r.kind = 'overview' and r.id = e.overview_id
                       and not r.deleted and r.rev = e.embedded_rev
        where c.account_id = $1 and c.model = $3
        group by c.overview_id
        order by similarity desc
        limit $4`,
      [accountId, asVector(vector), model, limit],
    );
    return rows.map((row) => ({ overviewId: row.overview_id, similarity: Number(row.similarity) }));
  }
}
