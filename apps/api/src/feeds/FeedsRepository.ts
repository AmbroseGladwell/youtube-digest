import type { FeedEntry, FeedKind } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

export interface StoredFeed {
  feedUrl: string;
  kind: FeedKind;
  title: string | null;
  siteUrl: string | null;
  imageUrl: string | null;
  entries: FeedEntry[];
  etag: string | null;
  lastModified: string | null;
  fetchedAt: Date;
  checkedAt: Date;
  failures: number;
  failingSince: Date | null;
  nextTryAt: Date | null;
  gone: boolean;
}

interface FeedRow {
  feed_url: string;
  kind: FeedKind;
  title: string | null;
  site_url: string | null;
  image_url: string | null;
  entries: FeedEntry[] | string;
  etag: string | null;
  last_modified: string | null;
  fetched_at: string | Date;
  checked_at: string | Date;
  failures: number;
  failing_since: string | Date | null;
  next_try_at: string | Date | null;
  gone: boolean;
}

const dateOrNull = (value: string | Date | null): Date | null => (value === null ? null : new Date(value));

const storedFeedOf = (row: FeedRow): StoredFeed => ({
  feedUrl: row.feed_url,
  kind: row.kind,
  title: row.title,
  siteUrl: row.site_url,
  imageUrl: row.image_url,
  entries: typeof row.entries === "string" ? (JSON.parse(row.entries) as FeedEntry[]) : row.entries,
  etag: row.etag,
  lastModified: row.last_modified,
  fetchedAt: new Date(row.fetched_at),
  checkedAt: new Date(row.checked_at),
  failures: row.failures,
  failingSince: dateOrNull(row.failing_since),
  nextTryAt: dateOrNull(row.next_try_at),
  gone: row.gone,
});

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

// Never holds an account: docs/features/followed-feeds.md, "The stored copy".
export class FeedsRepository {
  #sql: SqlClient;

  constructor(sql: SqlClient) {
    this.#sql = sql;
  }

  async get(feedUrl: string): Promise<StoredFeed | null> {
    const [row] = await this.#sql.query<FeedRow>("select * from feeds where feed_url = $1", [feedUrl]);
    return row === undefined ? null : storedFeedOf(row);
  }

  async save(feed: StoredFeed): Promise<void> {
    await this.#sql.query(
      `insert into feeds (feed_url, kind, title, site_url, image_url, entries, etag, last_modified, fetched_at, checked_at,
                          failures, failing_since, next_try_at, gone)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::timestamptz, $10::timestamptz, $11, $12::timestamptz, $13::timestamptz, $14)
       on conflict (feed_url) do update set
         kind = excluded.kind, title = excluded.title, site_url = excluded.site_url, image_url = excluded.image_url,
         entries = excluded.entries, etag = excluded.etag, last_modified = excluded.last_modified,
         fetched_at = excluded.fetched_at, checked_at = excluded.checked_at, failures = excluded.failures,
         failing_since = excluded.failing_since, next_try_at = excluded.next_try_at, gone = excluded.gone`,
      [
        feed.feedUrl,
        feed.kind,
        feed.title,
        feed.siteUrl,
        feed.imageUrl,
        JSON.stringify(feed.entries),
        feed.etag,
        feed.lastModified,
        feed.fetchedAt.toISOString(),
        feed.checkedAt.toISOString(),
        feed.failures,
        iso(feed.failingSince),
        iso(feed.nextTryAt),
        feed.gone,
      ],
    );
  }

  async markChecked(feedUrl: string, at: Date): Promise<void> {
    await this.#sql.query("update feeds set checked_at = greatest(checked_at, $2::timestamptz) where feed_url = $1", [
      feedUrl,
      at.toISOString(),
    ]);
  }

  async deleteUncheckedSince(before: Date): Promise<number> {
    const deleted = await this.#sql.query<{ feed_url: string }>("delete from feeds where checked_at < $1::timestamptz returning feed_url", [
      before.toISOString(),
    ]);
    return deleted.length;
  }
}
