import type { FeedbackKind } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

export interface NewFeedback {
  accountId: string;
  createdAt: Date;
  surface: "web" | "extension";
  clientVersion: number;
  overviewId: string | null;
  kind: FeedbackKind | null;
  text: string;
  trail: string[];
}

export class FeedbackRepository {
  private readonly sql: SqlClient;

  constructor(sql: SqlClient) {
    this.sql = sql;
  }

  async insert(entry: NewFeedback): Promise<string> {
    const [row] = await this.sql.query<{ id: string }>(
      `insert into feedback (account_id, created_at, surface, client_version, overview_id, kind, text, trail)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [entry.accountId, entry.createdAt, entry.surface, entry.clientVersion, entry.overviewId, entry.kind, entry.text, entry.trail],
    );
    return row!.id;
  }
}
