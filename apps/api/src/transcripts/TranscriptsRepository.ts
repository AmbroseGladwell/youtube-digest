import type { StoredTranscript, VideoId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

const liveNoteOn = (videoId: string) => `select 1 from records
  where account_id = $1 and kind = 'overview' and not deleted and body -> 'video' ->> 'id' = ${videoId}`;

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

  // Both keep a transcript only while a live note on the account uses its video
  // (docs/features/transcript-storage.md, "Kept only while a note uses it").
  async putIfNoted(accountId: AccountId, transcript: StoredTranscript): Promise<void> {
    await this.#sql.query(
      `insert into transcripts (account_id, video_id, stored_at, body)
       select $1, $2, $3::timestamptz, $4::jsonb
       where exists (${liveNoteOn("$2")})
       on conflict (account_id, video_id) do update set
         stored_at = excluded.stored_at, body = excluded.body`,
      [accountId, transcript.videoId, this.#clock().toISOString(), JSON.stringify(transcript)],
    );
  }

  async forgetUnnoted(accountId: AccountId): Promise<void> {
    await this.#sql.query(
      `delete from transcripts t
       where t.account_id = $1
         and not exists (${liveNoteOn("t.video_id")})`,
      [accountId],
    );
  }
}
