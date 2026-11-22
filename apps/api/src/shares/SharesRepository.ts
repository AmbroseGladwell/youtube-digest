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
  hasNarration: boolean;
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
  has_narration: boolean;
}

const describe = (row: RawShare): ShareRow => ({
  token: row.token,
  overviewId: row.overview_id,
  title: row.title,
  sharedAt: row.shared_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  views: Number(row.views),
  contentHash: row.content_hash,
  hasNarration: row.has_narration,
});

const LIVE_COLUMNS = `token, overview_id, snapshot -> 'note' -> 'source' ->> 'title' as title,
  shared_at, updated_at, views, content_hash,
  coalesce(jsonb_typeof(snapshot -> 'narration') = 'object', false) as has_narration`;

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

export interface SharedOverviewRef {
  overviewId: string;
  stopped: boolean;
}

// A stopped link is marked, not deleted: docs/features/sharing.md, "The link".
export class SharesRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  // A stopped link is never revived: docs/features/sharing.md, "The link".
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

  // Null for a token never given, "revoked" for a stopped one: docs/features/sharing.md, "410, not 404".
  async readAndCount(token: string): Promise<PublishedShare | "revoked" | null> {
    const rows = await this.#sql.query<RawPublished>(
      `update shares set views = views + (case when revoked_at is null then 1 else 0 end)
       where token = $1
       returning snapshot, shared_at, revoked_at, views`,
      [token],
    );
    return published(rows[0]);
  }

  // For the card and audio a preview fetches after the page: docs/features/sharing.md, "Counting".
  async peek(token: string): Promise<PublishedShare | "revoked" | null> {
    const rows = await this.#sql.query<RawPublished>("select snapshot, shared_at, revoked_at, views from shares where token = $1", [token]);
    return published(rows[0]);
  }

  // A stopped link still answers, so what its visitors do next is counted too.
  async overviewFor(token: string): Promise<SharedOverviewRef | null> {
    const rows = await this.#sql.query<{ overview_id: string; revoked_at: Date | null }>(
      "select overview_id, revoked_at from shares where token = $1",
      [token],
    );
    const row = rows[0];
    return row === undefined ? null : { overviewId: row.overview_id, stopped: row.revoked_at !== null };
  }
}
