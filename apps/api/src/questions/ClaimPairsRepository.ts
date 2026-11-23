import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

export interface ClaimPair {
  first: string;
  second: string;
  firstPosition: number;
  secondPosition: number;
  similarity: number;
}

interface ClaimPairRow {
  first_id: string;
  second_id: string;
  first_position: number;
  second_position: number;
  similarity: number | string;
}

const fromRow = (row: ClaimPairRow): ClaimPair => ({
  first: row.first_id,
  second: row.second_id,
  firstPosition: row.first_position,
  secondPosition: row.second_position,
  similarity: Number(row.similarity),
});

// Current revs only, and never the big picture, which connects everything to its neighbours (docs/features/connections.md).
const CONNECTING_CLAIMS = `
  connecting as (
    select c.overview_id, c.position, c.embedding
      from claim_embeddings c
      join overview_embeddings e on e.account_id = c.account_id and e.overview_id = c.overview_id
      join records r on r.account_id = e.account_id and r.kind = 'overview' and r.id = e.overview_id
                    and not r.deleted and r.rev = e.embedded_rev
     where c.account_id = $1 and c.model = $2
       and not (c.position = 0 and coalesce(btrim(r.body->>'bigPicture'), '') <> '')
  )`;

// Candidates by code from the stored claim embeddings: docs/features/suggested-questions.md, "Candidates".
export class ClaimPairsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async recentlySaved(accountId: AccountId, model: string, limit: number): Promise<string[]> {
    const rows = await this.#sql.query<{ id: string }>(
      `select r.id from records r
         join overview_embeddings e on e.account_id = r.account_id and e.overview_id = r.id and e.embedded_rev = r.rev and e.model = $2
        where r.account_id = $1 and r.kind = 'overview' and not r.deleted
        order by r.body->>'savedAt' desc, r.id
        limit $3`,
      [accountId, model, limit],
    );
    return rows.map((row) => row.id);
  }

  // Each of the given overviews' closest partners anywhere in the library, by its best pair of claims.
  async closestPartners(accountId: AccountId, model: string, overviewIds: readonly string[], perOverview: number): Promise<ClaimPair[]> {
    if (overviewIds.length === 0) {
      return [];
    }
    const rows = await this.#sql.query<ClaimPairRow>(
      `with ${CONNECTING_CLAIMS},
       best as (
         select distinct on (m.overview_id, o.overview_id)
                m.overview_id as first_id, o.overview_id as second_id, m.position as first_position, o.position as second_position,
                1 - (m.embedding <=> o.embedding) as similarity
           from connecting m
           join connecting o on o.overview_id <> m.overview_id
          where m.overview_id = any($3::text[])
          order by m.overview_id, o.overview_id, m.embedding <=> o.embedding
       ),
       ranked as (
         select *, row_number() over (partition by first_id order by similarity desc, second_id) as place from best
       )
       select first_id, second_id, first_position, second_position, similarity from ranked where place <= $4
        order by first_id, place`,
      [accountId, model, [...overviewIds], perOverview],
    );
    return rows.map(fromRow);
  }

  // Every pair among the given overviews, each once, by its best pair of claims.
  async pairsAmong(accountId: AccountId, model: string, overviewIds: readonly string[]): Promise<ClaimPair[]> {
    if (overviewIds.length < 2) {
      return [];
    }
    const rows = await this.#sql.query<ClaimPairRow>(
      `with ${CONNECTING_CLAIMS},
       among as (select * from connecting where overview_id = any($3::text[]))
       select first_id, second_id, first_position, second_position, similarity from (
         select distinct on (m.overview_id, o.overview_id)
                m.overview_id as first_id, o.overview_id as second_id, m.position as first_position, o.position as second_position,
                1 - (m.embedding <=> o.embedding) as similarity
           from among m
           join among o on o.overview_id > m.overview_id
          order by m.overview_id, o.overview_id, m.embedding <=> o.embedding
       ) best
       order by similarity desc, first_id, second_id`,
      [accountId, model, [...overviewIds]],
    );
    return rows.map(fromRow);
  }
}
