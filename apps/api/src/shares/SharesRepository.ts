import type { SharedOverview } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { shareToken } from "./shareToken.js";

export interface ShareRow {
  token: string;
  overviewId: string;
  title: string;
  sharedAt: string;
  updatedAt: string;
  views: number;
  contentHash: string;
}

export interface PublishedShare {
  snapshot: SharedOverview;
  sharedAt: string;
  views: number;
}

interface RawShare {
  token: string;
  overview_id: string;
  title: string;
  shared_at: Date;
  updated_at: Date;
  views: string | number;
  content_hash: string;
}

const describe = (row: RawShare): ShareRow => ({
  token: row.token,
  overviewId: row.overview_id,
  title: row.title,
  sharedAt: row.shared_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  views: Number(row.views),
  contentHash: row.content_hash,
});

const LIVE_COLUMNS = `token, overview_id, snapshot -> 'note' -> 'video' ->> 'title' as title,
  shared_at, updated_at, views, content_hash`;

interface RawPublished {
  snapshot: SharedOverview;
  shared_at: Date;
  revoked_at: Date | null;
  views: string | number;
}

const published = (row: RawPublished | undefined): PublishedShare | "revoked" | null => {
  if (row === undefined) {
    return null;
  }
  if (row.revoked_at !== null) {
    return "revoked";
  }
  return { snapshot: row.snapshot, sharedAt: row.shared_at.toISOString(), views: Number(row.views) };
};

export interface PutShareInput {
  accountId: AccountId;
  overviewId: string;
  snapshot: SharedOverview;
  contentHash: string;
}

// A live link per overview, and every link ever made kept afterwards so a revoked one can
// still answer honestly. Stopping does not delete the row, it marks it, which is what lets
// /s/<token> say "no longer shared" rather than 404 (docs/features/sharing.md).
export class SharesRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  // Replaces the copy behind a live link, or mints a new one. A link the reader stopped is
  // never revived: sharing again after stopping is a new link, so anyone holding the old
  // one stays stopped.
  async put({ accountId, overviewId, snapshot, contentHash }: PutShareInput): Promise<ShareRow> {
    const now = this.#clock();
    const rows = await this.#sql.query<RawShare>(
      `insert into shares (token, account_id, overview_id, snapshot, content_hash, shared_at, updated_at)
       values ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $6::timestamptz)
       on conflict (account_id, overview_id) where revoked_at is null
       do update set snapshot = excluded.snapshot, content_hash = excluded.content_hash,
                     updated_at = excluded.updated_at
       returning ${LIVE_COLUMNS}`,
      [shareToken(), accountId, overviewId, JSON.stringify(snapshot), contentHash, now.toISOString()],
    );
    return describe(rows[0]!);
  }

  async listLive(accountId: AccountId): Promise<ShareRow[]> {
    const rows = await this.#sql.query<RawShare>(
      `select ${LIVE_COLUMNS} from shares
       where account_id = $1 and revoked_at is null
       order by shared_at desc`,
      [accountId],
    );
    return rows.map(describe);
  }

  async revoke(accountId: AccountId, token: string): Promise<boolean> {
    const rows = await this.#sql.query<{ token: string }>(
      `update shares set revoked_at = $3::timestamptz
       where account_id = $1 and token = $2 and revoked_at is null
       returning token`,
      [accountId, token, this.#clock().toISOString()],
    );
    return rows.length > 0;
  }

  // Null for a token nobody was ever given; "revoked" for one that was turned off. The page
  // tells those two apart, and the counter only moves for a copy that was actually served.
  async readAndCount(token: string): Promise<PublishedShare | "revoked" | null> {
    const rows = await this.#sql.query<RawPublished>(
      `update shares set views = views + (case when revoked_at is null then 1 else 0 end)
       where token = $1
       returning snapshot, shared_at, revoked_at, views`,
      [token],
    );
    return published(rows[0]);
  }

  // The same read without counting a visit, for the card and the audio a link preview
  // fetches after the page it has already counted.
  async peek(token: string): Promise<PublishedShare | "revoked" | null> {
    const rows = await this.#sql.query<RawPublished>(
      "select snapshot, shared_at, revoked_at, views from shares where token = $1",
      [token],
    );
    return published(rows[0]);
  }
}
