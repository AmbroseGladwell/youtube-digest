import type { StoredTranscript, VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

// Outside the records feed: a transcript is large, never edited and re-creatable, so it is
// fetched when a device misses it rather than pulled whole at first sync
// (docs/features/transcript-storage.md, "Following the reader across devices").
export class TranscriptsRepository {
  #sql: SqlClient;
  #clock: () => Date;

  constructor(sql: SqlClient, clock: () => Date) {
    this.#sql = sql;
    this.#clock = clock;
  }

  async get(accountId: AccountId, videoId: VideoId): Promise<unknown> {
    const rows = await this.#sql.query<{ body: unknown }>(
      "select body from transcripts where account_id = $1 and video_id = $2",
      [accountId, videoId],
    );
    return rows[0]?.body ?? null;
  }

  async put(accountId: AccountId, transcript: StoredTranscript): Promise<void> {
    await this.#sql.query(
      `insert into transcripts (account_id, video_id, stored_at, body)
       values ($1, $2, $3::timestamptz, $4::jsonb)
       on conflict (account_id, video_id) do update set
         stored_at = excluded.stored_at, body = excluded.body`,
      [accountId, transcript.videoId, this.#clock().toISOString(), JSON.stringify(transcript)],
    );
  }

  // Kept only while a live note uses the video (docs/features/transcript-storage.md).
  async forgetUnlessNoted(accountId: AccountId, videoId: string): Promise<void> {
    await this.#sql.query(
      `delete from transcripts
       where account_id = $1 and video_id = $2
         and not exists (
           select 1 from records
           where account_id = $1 and kind = 'overview' and not deleted
             and body -> 'video' ->> 'id' = $2
         )`,
      [accountId, videoId],
    );
  }
}
